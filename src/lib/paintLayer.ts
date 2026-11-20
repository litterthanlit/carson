/**
 * Paint layers: image layers whose pixels live in a live `<canvas>`, painted by the
 * brush engine. They behave like any other layer (move, scale, rotate, mask,
 * styles, treatments) because they are FabricImages.
 *
 * Supports five physical brush tips:
 * - round: smooth pressure-sensitive disc
 * - ink-blot: organic lumpy solvent ink pool with jagged 1-bit stippled edges
 * - solvent-rub: directional combed dry-brush rubbed-toner filaments
 * - smudge: picks up real ink from the poster backdrop beneath the cursor and
 *   drags it out into combed dry-brush toner streaks on the paint layer
 * - debris: stamps irregular torn toner flakes, lint shards, and scanner dust
 */
import { FabricImage, Point, util, type FabricObject } from 'fabric'
import {
  dabBounds,
  dabsTo,
  newDabCursor,
  smoothSample,
  unionRect,
  type BrushSample,
  type BrushSettings,
  type Dab,
  type Rect,
} from './brush'
import { createSeededRandom } from './random'

export const PAINT_LAYER_KEY = 'paintLayer'
export const PAINT_VERSION_KEY = 'paintVersion'

/** Keep a paint layer's backing canvas bounded (a 300dpi A2 is ~35MP). */
export const PAINT_MAX_PIXELS = 16_000_000

export function paintCanvasSize(posterWidth: number, posterHeight: number) {
  const scale = Math.min(1, Math.sqrt(PAINT_MAX_PIXELS / Math.max(1, posterWidth * posterHeight)))
  return { width: Math.max(1, Math.round(posterWidth * scale)), height: Math.max(1, Math.round(posterHeight * scale)) }
}

export function isPaintLayer(object: unknown): object is FabricImage {
  return Boolean(object && (object as Record<string, unknown>)[PAINT_LAYER_KEY]) && object instanceof FabricImage
}

export function paintVersion(object: FabricObject): number {
  return Number((object as unknown as Record<string, unknown>)[PAINT_VERSION_KEY] ?? 0)
}

export function bumpPaintVersion(object: FabricObject) {
  object.set({ [PAINT_VERSION_KEY]: paintVersion(object) + 1, dirty: true } as Partial<FabricObject>)
}

/** A transparent paint layer covering the poster. */
export function createPaintLayer(posterWidth: number, posterHeight: number): FabricImage {
  const size = paintCanvasSize(posterWidth, posterHeight)
  const element = document.createElement('canvas')
  element.width = size.width
  element.height = size.height
  return new FabricImage(element, {
    left: 0,
    top: 0,
    scaleX: posterWidth / size.width,
    scaleY: posterHeight / size.height,
    // The element changes under the brush; always draw it fresh.
    objectCaching: false,
    // A poster-sized layer must not swallow clicks: only painted pixels are hit.
    perPixelTargetFind: true,
    [PAINT_LAYER_KEY]: true,
    [PAINT_VERSION_KEY]: 1,
  } as Partial<FabricImage>)
}

/**
 * The layer's pixels as a writable canvas. Paint layers revived from a save or a
 * history snapshot come back as `<img>`; convert them on first paint.
 */
export function ensurePaintCanvas(image: FabricImage): HTMLCanvasElement {
  const element = image.getElement() as HTMLCanvasElement | HTMLImageElement
  if (element instanceof HTMLCanvasElement) return element
  const canvas = document.createElement('canvas')
  canvas.width = (element as HTMLImageElement).naturalWidth || image.width || 1
  canvas.height = (element as HTMLImageElement).naturalHeight || image.height || 1
  canvas.getContext('2d')?.drawImage(element, 0, 0)
  image.setElement(canvas)
  image.set({ objectCaching: false } as Partial<FabricImage>)
  return canvas
}

/** Poster-space point → paint-canvas pixel, through the layer's full transform. */
export function posterToPaintPixel(image: FabricImage, x: number, y: number) {
  const local = util.transformPoint(new Point(x, y), util.invertTransform(image.calcTransformMatrix()))
  return { x: local.x + (image.width ?? 0) / 2, y: local.y + (image.height ?? 0) / 2 }
}

/** Paint-canvas pixels per poster pixel (for sizing the brush). */
export function paintPixelsPerPosterPixel(image: FabricImage) {
  const sx = Math.abs(image.scaleX ?? 1)
  const sy = Math.abs(image.scaleY ?? 1)
  return 1 / Math.max(1e-6, Math.sqrt(sx * sy))
}

/** '#abc' / '#aabbcc' → '#aabbcc'. */
function normalizeHex(color: string) {
  const clean = color.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0').slice(0, 6)
  return `#${full}`
}

function hexToRgb(color: string): [number, number, number] {
  const hex = normalizeHex(color).slice(1)
  return [
    parseInt(hex.slice(0, 2), 16) || 0,
    parseInt(hex.slice(2, 4), 16) || 0,
    parseInt(hex.slice(4, 6), 16) || 0,
  ]
}

const scratch = new Map<string, HTMLCanvasElement>()

/** Reusable full-size scratch canvas, cleared (strokes would otherwise allocate ~64MB each). */
function scratchCanvas(name: string, width: number, height: number) {
  let canvas = scratch.get(name)
  if (!canvas || canvas.width !== width || canvas.height !== height) {
    canvas = makeCanvas(width, height)
    scratch.set(name, canvas)
  } else {
    canvas.getContext('2d')!.clearRect(0, 0, width, height)
  }
  return canvas
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(1e-6, edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Pre-rendered round dab: a colored disc with a hardness falloff, drawn scaled per dab. */
function dabSprite(radius: number, hardness: number, color: string) {
  const size = Math.max(4, Math.min(1024, Math.ceil(radius * 2)))
  const sprite = makeCanvas(size, size)
  const ctx = sprite.getContext('2d')!
  const r = size / 2
  const gradient = ctx.createRadialGradient(r, r, 0, r, r, r)
  const hard = Math.min(0.98, Math.max(0, hardness))
  const hex = normalizeHex(color)
  gradient.addColorStop(0, hex)
  gradient.addColorStop(hard, hex)
  // Fade to a transparent version of the same color: no dark fringe at soft edges.
  gradient.addColorStop(1, `${hex}00`)
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(r, r, r, 0, Math.PI * 2)
  ctx.fill()
  return sprite
}

/**
 * Organic multi-lobe solvent ink-pool sprite with crisp 1-bit paper-tooth
 * stipple edges and tiny surrounding ink micro-flecks.
 */
function inkBlotSprite(radius: number, hardness: number, color: string, seed: number) {
  const size = Math.max(16, Math.min(512, Math.ceil(radius * 2.6)))
  const sprite = makeCanvas(size, size)
  const ctx = sprite.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const data = img.data
  const [cr, cg, cb] = hexToRgb(color)
  const rand = createSeededRandom(seed)
  const half = size / 2
  const baseR = size * 0.34
  const p1 = rand() * Math.PI * 2
  const p2 = rand() * Math.PI * 2
  const p3 = rand() * Math.PI * 2
  const aspect = 0.72 + rand() * 0.52
  const crisp = 0.45 + 0.5 * Math.min(1, Math.max(0, hardness))

  // Small coarse value-noise grid for lumpy organic edge wander.
  const gridN = 10
  const grid = new Float32Array(gridN * gridN)
  for (let i = 0; i < grid.length; i++) grid[i] = rand() * 2 - 1
  const sampleGrid = (u: number, v: number) => {
    const gx = Math.max(0, Math.min(gridN - 1.001, u * (gridN - 1)))
    const gy = Math.max(0, Math.min(gridN - 1.001, v * (gridN - 1)))
    const x0 = Math.floor(gx)
    const y0 = Math.floor(gy)
    const fx = gx - x0
    const fy = gy - y0
    const top = grid[y0 * gridN + x0] + (grid[y0 * gridN + x0 + 1] - grid[y0 * gridN + x0]) * fx
    const bot = grid[(y0 + 1) * gridN + x0] + (grid[(y0 + 1) * gridN + x0 + 1] - grid[(y0 + 1) * gridN + x0]) * fx
    return top + (bot - top) * fy
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - half) / aspect
      const dy = y + 0.5 - half
      const theta = Math.atan2(dy, dx)
      const lobe =
        1 +
        0.22 * Math.sin(theta * 2 + p1) +
        0.18 * Math.sin(theta * 3 + p2) +
        0.11 * Math.sin(theta * 5 + p3)
      const lump = sampleGrid(x / size, y / size) * 0.28
      const dist = Math.hypot(dx, dy) / Math.max(1, baseR * (lobe + lump))
      const raw = 1 - smoothstep(0.55, 1.28, dist)
      if (raw <= 0.01) continue
      // High-contrast 1-bit paper-tooth stipple around the ink pool's frayed edge.
      const tooth = (rand() * 2 - 1) * 0.36
      const alpha = raw > 0.78 ? 1 : smoothstep(0.42 + tooth - 0.08 * (1 - crisp), 0.52 + tooth, raw)
      if (alpha <= 0.01) continue
      const i = (y * size + x) * 4
      data[i] = cr
      data[i + 1] = cg
      data[i + 2] = cb
      data[i + 3] = Math.round(alpha * 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  return sprite
}

/**
 * Directional combed dry-brush rubbed-toner sprite: parallel 1–2px fibrous
 * filaments running along +X (rotated at stamp time to match stroke direction).
 */
function solventRubSprite(radius: number, color: string, seed: number) {
  const size = Math.max(16, Math.min(512, Math.ceil(radius * 2.4)))
  const sprite = makeCanvas(size, size)
  const ctx = sprite.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const data = img.data
  const [cr, cg, cb] = hexToRgb(color)
  const rand = createSeededRandom(seed)
  const half = size / 2

  // Across-axis bristle comb profile (y): sharp filaments separated by dry gaps.
  const bristles = new Float32Array(size)
  let prev = rand()
  for (let y = 0; y < size; y++) {
    const radial = 1 - Math.abs((y + 0.5 - half) / half)
    const v = prev * 0.35 + rand() * 0.65
    prev = v
    bristles[y] = Math.max(0, radial) ** 0.7 * (v > 0.44 ? (v - 0.35) / 0.65 : 0)
  }

  for (let y = 0; y < size; y++) {
    const b = bristles[y]
    if (b <= 0.02) continue
    for (let x = 0; x < size; x++) {
      const along = 1 - Math.abs((x + 0.5 - half) / half)
      if (along <= 0) continue
      const raw = b * along ** 0.85
      const stipple = rand() * 0.62
      const alpha = smoothstep(stipple - 0.06, stipple + 0.06, raw * 1.05)
      if (alpha <= 0.02) continue
      const i = (y * size + x) * 4
      data[i] = cr
      data[i + 1] = cg
      data[i + 2] = cb
      data[i + 3] = Math.round(alpha * 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  return sprite
}

/**
 * Jagged irregular torn toner flake + companion micro-shards for scanner-glass
 * margin debris.
 */
function debrisSprite(radius: number, color: string, seed: number) {
  const size = Math.max(16, Math.min(384, Math.ceil(radius * 2.4)))
  const sprite = makeCanvas(size, size)
  const ctx = sprite.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const data = img.data
  const [cr, cg, cb] = hexToRgb(color)
  const rand = createSeededRandom(seed)
  const half = size / 2

  const rx = size * (0.14 + rand() * 0.16)
  const ry = rx * (0.28 + rand() * 0.45)
  const p1 = rand() * Math.PI * 2
  const p2 = rand() * Math.PI * 2
  const p3 = rand() * Math.PI * 2
  const notched = rand() < 0.55
  const notchX = (rand() < 0.5 ? -1 : 1) * rx * 0.55
  const notchY = (rand() - 0.5) * ry * 0.7
  const notchR = rx * 0.42

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - half
      const dy = y + 0.5 - half
      const theta = Math.atan2(dy, dx)
      const warp =
        1 +
        0.34 * Math.sin(theta * 2 + p1) +
        0.24 * Math.sin(theta * 3 + p2) +
        0.16 * Math.sin(theta * 5 + p3)
      const dist = Math.hypot(dx / Math.max(1, rx), dy / Math.max(1, ry))
      let cov = 1 - smoothstep(warp * 0.72, warp + (rand() - 0.5) * 0.25, dist)
      if (notched && cov > 0) {
        cov *= smoothstep(notchR * 0.65, notchR * 1.1, Math.hypot(dx - notchX, dy - notchY))
      }
      if (cov <= 0.04) continue
      const i = (y * size + x) * 4
      data[i] = cr
      data[i + 1] = cg
      data[i + 2] = cb
      data[i + 3] = Math.round(Math.min(1, cov) * 255)
    }
  }
  ctx.putImageData(img, 0, 0)

  // Add 2–4 tiny companion micro-shards & specks around the flake.
  ctx.fillStyle = normalizeHex(color)
  const shards = 2 + Math.floor(rand() * 4)
  for (let s = 0; s < shards; s++) {
    const a = rand() * Math.PI * 2
    const d = rx * (1.2 + rand() * 1.8)
    const sx = half + Math.cos(a) * d
    const sy = half + Math.sin(a) * d
    const sr = Math.max(1, rx * (0.08 + rand() * 0.16))
    ctx.beginPath()
    ctx.ellipse(sx, sy, sr, sr * (0.4 + rand() * 0.7), rand() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
  return sprite
}

export type StrokeSessionOptions = {
  /** Snapshot of the visible poster canvas at stroke start (used by the Smudge tip). */
  backdrop?: HTMLCanvasElement | null
  /** Deterministic seed for organic print brush tips (defaults to clock-derived). */
  seed?: number
}

export type StrokeResult = { rect: Rect; before: ImageData; after: ImageData }

const SMUDGE_BRISTLES = 24

/**
 * One brush stroke on a paint layer. Dabs accumulate in a stroke buffer at `flow`;
 * each frame the dirty rectangle is rebuilt as "layer before the stroke" + "stroke
 * buffer at `opacity`" (or erased through it). That is Photoshop's flow/opacity
 * model: overlapping dabs build up within a stroke but never exceed its opacity.
 */
export class StrokeSession {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly before: HTMLCanvasElement
  private readonly buffer: HTMLCanvasElement
  private readonly bufferCtx: CanvasRenderingContext2D
  private readonly brush: BrushSettings
  private readonly sprites: HTMLCanvasElement[]
  private readonly rand: () => number
  private readonly backdropPixels: Uint8ClampedArray | null
  private readonly backdropWidth: number
  private readonly backdropHeight: number
  private readonly bristleCharge: Float32Array
  private readonly bristleGain: Float32Array
  private readonly cursor = newDabCursor()
  private smoothed: BrushSample | null = null
  private dirty: Rect | null = null
  private dabIndex = 0

  readonly layer: FabricImage

  constructor(layer: FabricImage, brush: BrushSettings, options: StrokeSessionOptions = {}) {
    this.layer = layer
    this.canvas = ensurePaintCanvas(layer)
    this.ctx = this.canvas.getContext('2d')!
    const { width, height } = this.canvas
    this.before = scratchCanvas('before', width, height)
    this.before.getContext('2d')!.drawImage(this.canvas, 0, 0)
    this.buffer = scratchCanvas('buffer', width, height)
    this.bufferCtx = this.buffer.getContext('2d')!
    // Brush size is in poster px; convert to paint-canvas px for this layer.
    this.brush = { ...brush, size: brush.size * paintPixelsPerPosterPixel(layer) }
    const seed = (options.seed ?? ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0)) >>> 0
    this.rand = createSeededRandom(seed)
    const tipColor = brush.erase ? '#000000' : brush.color
    const tip = brush.erase ? 'round' : (brush.tip ?? 'round')

    if (tip === 'ink-blot') {
      this.sprites = Array.from({ length: 6 }, (_, i) =>
        inkBlotSprite(this.brush.size / 2, this.brush.hardness, tipColor, seed + i * 97 + 1),
      )
    } else if (tip === 'solvent-rub') {
      this.sprites = Array.from({ length: 5 }, (_, i) =>
        solventRubSprite(this.brush.size / 2, tipColor, seed + i * 131 + 3),
      )
    } else if (tip === 'debris') {
      this.sprites = Array.from({ length: 8 }, (_, i) =>
        debrisSprite(this.brush.size / 2, tipColor, seed + i * 173 + 7),
      )
    } else {
      this.sprites = [dabSprite(this.brush.size / 2, this.brush.hardness, tipColor)]
    }

    // Smudge tip: read visible poster pixels at stroke start so dragging over
    // editable text/artwork physically pulls real ink into dry-brush streaks.
    this.bristleCharge = new Float32Array(SMUDGE_BRISTLES)
    this.bristleGain = new Float32Array(SMUDGE_BRISTLES)
    for (let b = 0; b < SMUDGE_BRISTLES; b++) {
      // Combed irregular filament weights across the smudge width.
      const edge = 1 - Math.abs((b + 0.5) / SMUDGE_BRISTLES - 0.5) * 2
      this.bristleGain[b] = edge ** 0.55 * (0.25 + 0.75 * this.rand() ** 1.3)
    }
    if (tip === 'smudge' && options.backdrop && options.backdrop.width > 0 && options.backdrop.height > 0) {
      const bCtx = options.backdrop.getContext('2d')
      this.backdropWidth = options.backdrop.width
      this.backdropHeight = options.backdrop.height
      this.backdropPixels = bCtx ? bCtx.getImageData(0, 0, this.backdropWidth, this.backdropHeight).data : null
    } else {
      this.backdropPixels = null
      this.backdropWidth = 0
      this.backdropHeight = 0
    }
  }

  /** Sample ink darkness (0 paper … 1 solid black) from the captured poster backdrop. */
  private sampleBackdropInk(x: number, y: number): number {
    const data = this.backdropPixels
    if (!data) return 0
    const sx = Math.round((x / Math.max(1, this.canvas.width)) * this.backdropWidth)
    const sy = Math.round((y / Math.max(1, this.canvas.height)) * this.backdropHeight)
    if (sx < 0 || sy < 0 || sx >= this.backdropWidth || sy >= this.backdropHeight) return 0
    const i = (sy * this.backdropWidth + sx) * 4
    const alpha = data[i + 3] / 255
    if (alpha < 0.02) return 0
    const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255
    return Math.max(0, Math.min(1, (1 - lum) * alpha))
  }

  private stampSmudgeDab(dab: Dab) {
    const ctx = this.bufferCtx
    const angle = dab.angle ?? 0
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const nx = -sin
    const ny = cos
    const hex = normalizeHex(this.brush.color)
    const bristleSpan = dab.radius * 1.9
    const step = bristleSpan / SMUDGE_BRISTLES
    const decay = 0.8 + 0.16 * Math.min(1, this.brush.hardness)
    const pickup = 0.55 + 0.45 * dab.alpha

    ctx.fillStyle = hex
    for (let b = 0; b < SMUDGE_BRISTLES; b++) {
      const offset = ((b + 0.5) / SMUDGE_BRISTLES - 0.5) * bristleSpan
      const bx = dab.x + nx * offset
      const by = dab.y + ny * offset
      const sampled = this.sampleBackdropInk(bx, by)
      const nextCharge = Math.max(this.bristleCharge[b] * decay, sampled * pickup)
      this.bristleCharge[b] = nextCharge

      const strength = nextCharge * this.bristleGain[b]
      if (strength < 0.06) continue
      // High-contrast 1-bit stipple breakup as the rubbed ink runs dry.
      if (strength < 0.65 && this.rand() > strength * 1.25) continue

      const segLen = Math.max(1.5, dab.radius * (0.28 + 0.45 * strength))
      const segW = Math.max(0.85, step * (0.45 + 0.65 * strength))
      ctx.save()
      ctx.translate(bx, by)
      ctx.rotate(angle)
      ctx.globalAlpha = Math.min(1, strength * 1.25)
      ctx.fillRect(-segLen * 0.5, -segW * 0.5, segLen, segW)
      ctx.restore()
    }
  }

  private stampDab(dab: Dab) {
    const tip = this.brush.erase ? 'round' : (this.brush.tip ?? 'round')
    if (tip === 'round') {
      this.bufferCtx.globalAlpha = dab.alpha
      this.bufferCtx.drawImage(this.sprites[0], dab.x - dab.radius, dab.y - dab.radius, dab.radius * 2, dab.radius * 2)
      return
    }
    if (tip === 'smudge') {
      this.stampSmudgeDab(dab)
      return
    }

    const sprite = this.sprites[this.dabIndex % this.sprites.length]
    this.dabIndex += 1
    const ctx = this.bufferCtx
    ctx.save()
    ctx.translate(dab.x, dab.y)
    if (tip === 'solvent-rub') {
      ctx.rotate((dab.angle ?? 0) + (this.rand() - 0.5) * 0.08)
      const r = dab.radius * 1.2
      ctx.globalAlpha = Math.min(1, dab.alpha * (0.75 + 0.35 * this.rand()))
      ctx.drawImage(sprite, -r, -r, r * 2, r * 2)
    } else if (tip === 'ink-blot') {
      ctx.rotate(this.rand() * Math.PI * 2)
      const jitter = 0.82 + this.rand() * 0.42
      const r = dab.radius * 1.25 * jitter
      ctx.globalAlpha = Math.min(1, dab.alpha * (0.85 + 0.2 * this.rand()))
      ctx.drawImage(sprite, -r, -r, r * 2, r * 2)
    } else if (tip === 'debris') {
      const scatterR = dab.radius * 0.65
      const a = this.rand() * Math.PI * 2
      ctx.translate(Math.cos(a) * scatterR * this.rand(), Math.sin(a) * scatterR * this.rand())
      ctx.rotate(this.rand() * Math.PI * 2)
      const r = dab.radius * (0.55 + this.rand() * 0.75)
      ctx.globalAlpha = Math.min(1, dab.alpha * (0.85 + 0.15 * this.rand()))
      ctx.drawImage(sprite, -r, -r, r * 2, r * 2)
    }
    ctx.restore()
  }

  /** Feed input samples in paint-canvas pixels. Returns the rect repainted this call. */
  addSamples(samples: BrushSample[]): Rect | null {
    const dabs: Dab[] = []
    for (const raw of samples) {
      this.smoothed = smoothSample(this.smoothed, raw, this.brush.smoothing)
      dabs.push(...dabsTo(this.cursor, this.smoothed, this.brush))
    }
    if (dabs.length === 0) return null
    for (const dab of dabs) this.stampDab(dab)
    this.bufferCtx.globalAlpha = 1
    // Organic tips can extend slightly past dab.radius; pad dirty bounds to match.
    const tip = this.brush.erase ? 'round' : (this.brush.tip ?? 'round')
    const padFactor = tip === 'round' ? 1 : tip === 'debris' ? 2.1 : 1.5
    const paddedDabs =
      padFactor === 1 ? dabs : dabs.map((dab) => ({ ...dab, radius: dab.radius * padFactor }))
    const rect = dabBounds(paddedDabs, this.canvas.width, this.canvas.height)
    if (!rect) return null
    this.composite(rect)
    this.dirty = unionRect(this.dirty, rect)
    return rect
  }

  private composite(rect: Rect) {
    const { x, y, width, height } = rect
    const ctx = this.ctx
    ctx.save()
    ctx.globalAlpha = 1
    // Not 'copy': that operator clears everything outside the drawn region.
    ctx.clearRect(x, y, width, height)
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(this.before, x, y, width, height, x, y, width, height)
    ctx.globalCompositeOperation = this.brush.erase ? 'destination-out' : 'source-over'
    ctx.globalAlpha = this.brush.opacity
    ctx.drawImage(this.buffer, x, y, width, height, x, y, width, height)
    ctx.restore()
  }

  /** Finish the stroke; returns undo data for the touched region, or null if nothing changed. */
  end(): StrokeResult | null {
    const rect = this.dirty
    if (!rect) return null
    const before = this.before.getContext('2d')!.getImageData(rect.x, rect.y, rect.width, rect.height)
    const after = this.ctx.getImageData(rect.x, rect.y, rect.width, rect.height)
    return { rect, before, after }
  }
}

/** Write stored pixels back into a paint layer (undo/redo). */
export function writePaintPixels(layer: FabricImage, rect: Rect, pixels: ImageData) {
  const canvas = ensurePaintCanvas(layer)
  canvas.getContext('2d')?.putImageData(pixels, rect.x, rect.y)
  bumpPaintVersion(layer)
}
