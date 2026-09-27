/**
 * Paint layers: image layers whose pixels live in a live `<canvas>`, painted by the
 * brush engine. They behave like any other layer (move, scale, rotate, mask,
 * styles, treatments) because they are FabricImages.
 */
import { FabricImage, Point, util, type FabricObject } from 'fabric'
import { dabBounds, dabsTo, newDabCursor, smoothSample, unionRect, type BrushSample, type BrushSettings, type Rect } from './brush'

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

/** Pre-rendered dab: a colored disc with a hardness falloff, drawn scaled per dab. */
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

export type StrokeResult = { rect: Rect; before: ImageData; after: ImageData }

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
  private readonly sprite: HTMLCanvasElement
  private readonly cursor = newDabCursor()
  private smoothed: BrushSample | null = null
  private dirty: Rect | null = null

  readonly layer: FabricImage

  constructor(layer: FabricImage, brush: BrushSettings) {
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
    this.sprite = dabSprite(this.brush.size / 2, this.brush.hardness, brush.erase ? '#000000' : brush.color)
  }

  /** Feed input samples in paint-canvas pixels. Returns the rect repainted this call. */
  addSamples(samples: BrushSample[]): Rect | null {
    const dabs = []
    for (const raw of samples) {
      this.smoothed = smoothSample(this.smoothed, raw, this.brush.smoothing)
      dabs.push(...dabsTo(this.cursor, this.smoothed, this.brush))
    }
    if (dabs.length === 0) return null
    for (const dab of dabs) {
      this.bufferCtx.globalAlpha = dab.alpha
      this.bufferCtx.drawImage(this.sprite, dab.x - dab.radius, dab.y - dab.radius, dab.radius * 2, dab.radius * 2)
    }
    this.bufferCtx.globalAlpha = 1
    const rect = dabBounds(dabs, this.canvas.width, this.canvas.height)
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
