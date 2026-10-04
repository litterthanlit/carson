/**
 * Copy Machine — a deterministic model of a toner photocopier.
 *
 * Every pass is a physical cause, not a filter look:
 * - wobble: paper and drum slip, a seeded displacement field
 * - drag: the original moved while the scan bar ran, so each scanline catches it
 *   at a different offset and fast moves smear along the slip
 * - toner: ink spreads (dot gain), sits on a clustered halftone screen, mottles
 *   in solids, speckles the paper and pinholes the blacks
 * - bands / streaks: toner starvation across the scan, dirt and scratches on
 *   the drum along it
 * - edge: the lid left open — black creeping in from the frame
 * - generations: a copy of a copy, resized each time, losing and thickening detail
 *
 * Pure, seeded and headless-testable; the worker and export run the same code.
 */
import { createSeededRandom } from './random'

export type CopyMachineParams = {
  // tonal (CM-1)
  contrast: number
  grain: number
  voids: number
  // spatial
  wobble: number
  wobbleFreq: number
  drag: number
  dragAngle: number
  bands: number
  /** Drum dirt and scratches running along the scan direction. */
  streaks: number
  /** Lid-open black border creeping in from the frame. */
  edge: number
  /** Copy of a copy: how many times the sheet went through the machine (1–8). */
  generations: number
  /** Reduce/enlarge per generation, in percent (100 = same size). */
  copyScale: number
  // companion (CM-2)
  ghost: number
  ghostOffset: number
}

export const COPY_MACHINE_DEFAULTS: CopyMachineParams = {
  contrast: 75,
  grain: 60,
  voids: 15,
  wobble: 35,
  wobbleFreq: 50,
  drag: 40,
  dragAngle: 90,
  bands: 25,
  streaks: 20,
  edge: 0,
  generations: 1,
  copyScale: 100,
  ghost: 20,
  ghostOffset: 3,
}

export const MAX_COPY_GENERATIONS = 8

const MAX_WOBBLE_PX = 12
const MAX_DRAG_PX = 24
/** Allow 2× from grid tension (slider 100 → scale 2) without exploding garbage values. */
const MAX_PARAM_AFTER_TENSION = 200

function clampParam(value: number): number {
  return Math.max(0, Math.min(MAX_PARAM_AFTER_TENSION, value))
}

/** Grid/instrument tension multiplier. Scatter uses the same 0.1 floor. */
export function copyMachineTensionScale(tensionScale = 1): number {
  if (!Number.isFinite(tensionScale)) return 1
  return Math.max(0.1, tensionScale)
}

/** Scale 0–100 intensity params; leave scan angle, generations and copy size alone. */
export function scaleCopyMachineParams(params: CopyMachineParams, tensionScale = 1): CopyMachineParams {
  const scale = copyMachineTensionScale(tensionScale)
  if (scale === 1) return params
  return {
    ...params,
    contrast: params.contrast * scale,
    grain: params.grain * scale,
    voids: params.voids * scale,
    wobble: params.wobble * scale,
    wobbleFreq: params.wobbleFreq * scale,
    drag: params.drag * scale,
    bands: params.bands * scale,
    streaks: params.streaks * scale,
    edge: params.edge * scale,
    ghost: params.ghost * scale,
    ghostOffset: params.ghostOffset * scale,
  }
}

/** Export/display pixel scale — amplitude is in canvas px, so 4× export must be 4× displacement. */
export function copyMachinePixelScale(exportScale = 1): number {
  if (!Number.isFinite(exportScale) || exportScale <= 0) return 1
  return exportScale
}

function paramUnit(value: number): number {
  return clampParam(value) / 100
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function cloneImageData(imageData: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height)
}

function buildValueNoiseGrid(cols: number, rows: number, random: () => number): Float32Array {
  const grid = new Float32Array(cols * rows)
  for (let i = 0; i < grid.length; i++) {
    grid[i] = random() * 2 - 1
  }
  return grid
}

function sampleGridBilinear(
  grid: Float32Array,
  cols: number,
  rows: number,
  u: number,
  v: number,
): number {
  const x = u * (cols - 1)
  const y = v * (rows - 1)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(x0 + 1, cols - 1)
  const y1 = Math.min(y0 + 1, rows - 1)
  const fx = x - x0
  const fy = y - y0

  const v00 = grid[y0 * cols + x0]
  const v10 = grid[y0 * cols + x1]
  const v01 = grid[y1 * cols + x0]
  const v11 = grid[y1 * cols + x1]
  const top = v00 + (v10 - v00) * fx
  const bottom = v01 + (v11 - v01) * fx
  return top + (bottom - top) * fy
}

function sampleBilinearRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): [number, number, number, number] {
  const clampedX = Math.max(0, Math.min(width - 1, x))
  const clampedY = Math.max(0, Math.min(height - 1, y))
  const x0 = Math.floor(clampedX)
  const y0 = Math.floor(clampedY)
  const x1 = Math.min(x0 + 1, width - 1)
  const y1 = Math.min(y0 + 1, height - 1)
  const fx = clampedX - x0
  const fy = clampedY - y0

  const i00 = (y0 * width + x0) * 4
  const i10 = (y0 * width + x1) * 4
  const i01 = (y1 * width + x0) * 4
  const i11 = (y1 * width + x1) * 4

  const channels: [number, number, number, number] = [0, 0, 0, 0]
  for (let c = 0; c < 4; c++) {
    const top = data[i00 + c] + (data[i10 + c] - data[i00 + c]) * fx
    const bottom = data[i01 + c] + (data[i11 + c] - data[i01 + c]) * fx
    channels[c] = Math.round(top + (bottom - top) * fy)
  }
  return channels
}

/** Seeded xy displacement field — 2 floats per pixel (dx, dy). */
export function buildDisplacementField(
  width: number,
  height: number,
  params: Pick<CopyMachineParams, 'wobble' | 'wobbleFreq'>,
  random: () => number,
  exportScale = 1,
): Float32Array {
  const field = new Float32Array(width * height * 2)
  const pixelScale = copyMachinePixelScale(exportScale)
  const amplitude = paramUnit(params.wobble) * MAX_WOBBLE_PX * pixelScale
  if (amplitude < 0.01 || width < 1 || height < 1) return field

  const freq = paramUnit(params.wobbleFreq)
  const cellSize = Math.max(4, Math.round(lerp(48, 6, freq) * pixelScale))
  const cols = Math.max(2, Math.ceil(width / cellSize) + 1)
  const rows = Math.max(2, Math.ceil(height / cellSize) + 1)

  const gridX = buildValueNoiseGrid(cols, rows, random)
  const gridY = buildValueNoiseGrid(cols, rows, random)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width
      const v = y / height
      const idx = (y * width + x) * 2
      field[idx] = sampleGridBilinear(gridX, cols, rows, u, v) * amplitude
      field[idx + 1] = sampleGridBilinear(gridY, cols, rows, u, v) * amplitude
    }
  }

  return field
}

/** Inverse-map warp: each output pixel samples the source at field-offset coordinates. */
export function applyDisplacement(imageData: ImageData, field: Float32Array): ImageData {
  const { width, height, data } = imageData
  const out = new ImageData(width, height)
  const outData = out.data

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const fi = (y * width + x) * 2
      const sx = x + field[fi]
      const sy = y + field[fi + 1]
      const [r, g, b, a] = sampleBilinearRgba(data, width, height, sx, sy)
      const oi = (y * width + x) * 4
      outData[oi] = r
      outData[oi + 1] = g
      outData[oi + 2] = b
      outData[oi + 3] = a
    }
  }

  return out
}

type ScanAxes = {
  /** Scan bar travels along y (true) or x. */
  alongY: boolean
  /** Unit vector of the slip — the direction the original was pushed. */
  ux: number
  uy: number
}

function scanAxes(dragAngle: number): ScanAxes {
  const angle = (dragAngle * Math.PI) / 180
  const ux = Math.cos(angle)
  const uy = Math.sin(angle)
  return { alongY: Math.abs(uy) >= Math.abs(ux), ux, uy }
}

/**
 * Scan drift — the original moved while the bar was running.
 *
 * The bar exposes one scanline at a time, so a push mid-scan gives every later
 * line a growing offset: the image stretches, shears or steps along the slip.
 * While the hand is moving, the exposure slit catches the paper in motion, so
 * those lines smear in proportion to the speed. A faint per-line jitter is the
 * carriage vibrating.
 */
export function applyDrag(
  imageData: ImageData,
  params: Pick<CopyMachineParams, 'drag' | 'dragAngle'>,
  random: () => number,
  exportScale = 1,
): ImageData {
  const pixelScale = copyMachinePixelScale(exportScale)
  const strength = paramUnit(params.drag)
  const maxLength = strength * MAX_DRAG_PX * pixelScale
  if (maxLength < 0.5) return cloneImageData(imageData)

  const { width, height, data } = imageData
  const { alongY, ux, uy } = scanAxes(params.dragAngle)
  const lines = alongY ? height : width

  // Velocity of the original per scanline: a few pushes, each a smooth bump.
  const velocity = new Float32Array(lines)
  const pushes = 1 + Math.floor(random() * 3)
  for (let push = 0; push < pushes; push++) {
    const center = random() * lines
    const half = Math.max(2, lines * (0.03 + random() * 0.12))
    const travel = (0.35 + random() * 0.65) * maxLength * 2.2 * (random() < 0.3 ? -1 : 1)
    for (let s = Math.max(0, Math.floor(center - half)); s < Math.min(lines, Math.ceil(center + half)); s++) {
      const t = 1 - Math.abs(s - center) / half
      // Triangle bump normalised so the whole push travels `travel` px.
      velocity[s] += (travel * t) / half
    }
  }
  const offset = new Float32Array(lines)
  let run = 0
  let low = 0
  let high = 0
  for (let s = 0; s < lines; s++) {
    run += velocity[s]
    offset[s] = run
    low = Math.min(low, run)
    high = Math.max(high, run)
  }
  // Keep the drifted copy centred on the sheet.
  const centre = (low + high) / 2
  const jitter = new Float32Array(lines)
  for (let s = 0; s < lines; s++) {
    offset[s] -= centre
    jitter[s] = (random() - 0.5) * 0.7 * strength * pixelScale
  }

  const slit = 5 * pixelScale
  const out = new ImageData(width, height)
  const outData = out.data
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = alongY ? y : x
      const shift = offset[s]
      const smear = Math.min(maxLength * 1.5, Math.abs(velocity[s]) * slit)
      const baseX = x - ux * shift + (alongY ? jitter[s] : 0)
      const baseY = y - uy * shift + (alongY ? 0 : jitter[s])
      const oi = (y * width + x) * 4
      const taps = smear < 0.5 ? 1 : Math.min(12, Math.ceil(smear) + 1)
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let tap = 0; tap < taps; tap++) {
        const along = taps === 1 ? 0 : (tap / (taps - 1)) * smear
        const [sr, sg, sb, sa] = sampleBilinearRgba(data, width, height, baseX - ux * along, baseY - uy * along)
        r += sr
        g += sg
        b += sb
        a += sa
      }
      outData[oi] = Math.round(r / taps)
      outData[oi + 1] = Math.round(g / taps)
      outData[oi + 2] = Math.round(b / taps)
      outData[oi + 3] = Math.round(a / taps)
    }
  }
  return out
}

/** CM-0 convenience: displacement field + drag in one deterministic pass. */
export function applySpatialPasses(
  imageData: ImageData,
  params: Pick<CopyMachineParams, 'wobble' | 'wobbleFreq' | 'drag' | 'dragAngle'>,
  random: () => number,
  exportScale = 1,
): ImageData {
  const { width, height } = imageData
  const field = buildDisplacementField(width, height, params, random, exportScale)
  const warped = applyDisplacement(imageData, field)
  return applyDrag(warped, params, random, exportScale)
}

export function copyMachineParamsFromRecord(params: Record<string, number>): CopyMachineParams {
  return {
    contrast: params.contrast ?? COPY_MACHINE_DEFAULTS.contrast,
    grain: params.grain ?? COPY_MACHINE_DEFAULTS.grain,
    voids: params.voids ?? COPY_MACHINE_DEFAULTS.voids,
    wobble: params.wobble ?? COPY_MACHINE_DEFAULTS.wobble,
    wobbleFreq: params.wobbleFreq ?? COPY_MACHINE_DEFAULTS.wobbleFreq,
    drag: params.drag ?? COPY_MACHINE_DEFAULTS.drag,
    dragAngle: params.dragAngle ?? COPY_MACHINE_DEFAULTS.dragAngle,
    bands: params.bands ?? COPY_MACHINE_DEFAULTS.bands,
    streaks: params.streaks ?? COPY_MACHINE_DEFAULTS.streaks,
    edge: params.edge ?? COPY_MACHINE_DEFAULTS.edge,
    generations: params.generations ?? COPY_MACHINE_DEFAULTS.generations,
    copyScale: params.copyScale ?? COPY_MACHINE_DEFAULTS.copyScale,
    ghost: params.ghost ?? COPY_MACHINE_DEFAULTS.ghost,
    ghostOffset: params.ghostOffset ?? COPY_MACHINE_DEFAULTS.ghostOffset,
  }
}

/**
 * Xerox by generation (1–10): the same copier, run the way an office copier
 * degrades a sheet that's been copied again and again — more passes, darker
 * toner, more grit, a dirtier drum, and by the late generations the original
 * slipping under the bar. No ghost: that's a separate misregistration.
 */
export function copyMachineParamsFromGeneration(generation: number): CopyMachineParams {
  const g = Math.max(1, Math.min(10, Number.isFinite(generation) ? generation : 5))
  return {
    ...COPY_MACHINE_DEFAULTS,
    generations: Math.max(1, Math.min(5, Math.ceil(g / 2))),
    copyScale: 100,
    contrast: 52 + g * 4.5,
    grain: 26 + g * 5,
    voids: g * 2,
    wobble: 8 + g * 2,
    drag: g > 5 ? (g - 5) * 9 : 0,
    bands: 8 + g * 3,
    streaks: 4 + g * 3,
    edge: 0,
    ghost: 0,
  }
}

export function copyMachineParamsToRecord(params: CopyMachineParams): Record<string, number> {
  return { ...params }
}

export type TonalParams = Pick<CopyMachineParams, 'contrast' | 'grain' | 'bands' | 'voids'> &
  Partial<Pick<CopyMachineParams, 'streaks' | 'edge' | 'dragAngle'>>

/** Toner black — never quite #000 on a real copy. */
const TONER = 18

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(1e-6, edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/**
 * An opaque source (a photo, a scanned scrap) copies as a sheet: white paper
 * with toner on it. A layer with transparency (type, a cut shape) copies as
 * toner alone, so it overprints whatever sits underneath.
 */
export function isOpaqueSource(imageData: ImageData): boolean {
  const { data } = imageData
  const total = data.length / 4
  if (total === 0) return false
  let opaque = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] > 250) opaque++
  return opaque / total >= 0.85
}

/** Ink coverage 0–1 composited over white paper. */
function inkPlane(imageData: ImageData): Float32Array {
  const { data } = imageData
  const ink = new Float32Array(data.length / 4)
  for (let p = 0, i = 0; p < ink.length; p++, i += 4) {
    const luminance = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255
    ink[p] = (1 - luminance) * (data[i + 3] / 255)
  }
  return ink
}

/** Separable running-sum box blur, two passes ≈ tent. */
function boxBlur(plane: Float32Array, width: number, height: number, radius: number): Float32Array {
  const r = Math.round(radius)
  if (r < 1) return plane
  const temp = new Float32Array(plane.length)
  const out = new Float32Array(plane.length)
  const pass = (src: Float32Array, dst: Float32Array, horizontal: boolean) => {
    const outer = horizontal ? height : width
    const inner = horizontal ? width : height
    const at = (o: number, i: number) => {
      const c = i < 0 ? 0 : i >= inner ? inner - 1 : i
      return horizontal ? src[o * width + c] : src[c * width + o]
    }
    const span = 2 * r + 1
    for (let o = 0; o < outer; o++) {
      let sum = 0
      for (let i = -r; i <= r; i++) sum += at(o, i)
      for (let i = 0; i < inner; i++) {
        if (horizontal) dst[o * width + i] = sum / span
        else dst[i * width + o] = sum / span
        sum += at(o, i + r + 1) - at(o, i - r)
      }
    }
  }
  pass(plane, temp, true)
  pass(temp, out, false)
  pass(out, temp, true)
  pass(temp, out, false)
  return out
}

/** Separable max filter — grayscale dilation by `radius` px. */
function dilate(plane: Float32Array, width: number, height: number, radius: number): Float32Array {
  if (radius < 1) return plane
  const temp = new Float32Array(plane.length)
  const out = new Float32Array(plane.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let best = 0
      for (let k = Math.max(0, x - radius); k <= Math.min(width - 1, x + radius); k++) best = Math.max(best, plane[y * width + k])
      temp[y * width + x] = best
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let best = 0
      for (let k = Math.max(0, y - radius); k <= Math.min(height - 1, y + radius); k++) best = Math.max(best, temp[k * width + x])
      out[y * width + x] = best
    }
  }
  return out
}

/** Smooth seeded noise in -1..1 with roughly `cell`-px features. */
function noisePlane(width: number, height: number, cell: number, random: () => number): Float32Array {
  const cols = Math.max(2, Math.ceil(width / Math.max(2, cell)) + 1)
  const rows = Math.max(2, Math.ceil(height / Math.max(2, cell)) + 1)
  const grid = buildValueNoiseGrid(cols, rows, random)
  const plane = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      plane[y * width + x] = sampleGridBilinear(grid, cols, rows, x / width, y / height)
    }
  }
  return plane
}

/** Smooth seeded noise along one axis, -1..1. */
function noiseLine(length: number, cell: number, random: () => number): Float32Array {
  const knots = Math.max(2, Math.ceil(length / Math.max(2, cell)) + 1)
  const grid = buildValueNoiseGrid(knots, 2, random)
  const line = new Float32Array(length)
  for (let i = 0; i < length; i++) line[i] = sampleGridBilinear(grid, knots, 2, i / Math.max(1, length), 0)
  return line
}

function stampDisc(
  plane: Float32Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  apply: (value: number, coverage: number) => number,
) {
  const x0 = Math.max(0, Math.floor(cx - radius - 1))
  const x1 = Math.min(width - 1, Math.ceil(cx + radius + 1))
  const y0 = Math.max(0, Math.floor(cy - radius - 1))
  const y1 = Math.min(height - 1, Math.ceil(cy + radius + 1))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      const coverage = Math.max(0, Math.min(1, radius + 0.5 - distance))
      if (coverage <= 0) continue
      const i = y * width + x
      plane[i] = apply(plane[i], coverage)
    }
  }
}

/**
 * Toner density: ink spread (dot gain) → clustered halftone screen → copier
 * curve, with grain roughening the threshold so edges come out ragged.
 */
function tonerDensity(
  ink: Float32Array,
  width: number,
  height: number,
  params: TonalParams,
  random: () => number,
  pixelScale: number,
): Float32Array {
  const contrast = Math.min(1.5, paramUnit(params.contrast))
  const grain = Math.min(1.5, paramUnit(params.grain))
  // Toner spreads out of every mark (dot gain): grow ink first, then soften.
  // Growing rather than only blurring keeps hairlines alive — they get bolder,
  // as on a dark copy — while flat midtones keep their tone.
  const grown = dilate(ink, width, height, Math.round(Math.max(0, contrast - 0.5) * 1.6 * pixelScale))
  const softened = boxBlur(grown, width, height, Math.max(1, 0.8 * pixelScale))
  const gain = 1 + 0.5 * contrast
  const blurred = softened.map((value) => Math.min(1, value * gain))
  // Darker machines lay more toner: the threshold drops and strokes thicken.
  const threshold = 0.5 - 0.1 * contrast
  const soft = Math.max(0.025, 0.3 - 0.19 * contrast)
  const period = Math.max(2.5, 3.4 * pixelScale)
  const freq = (2 * Math.PI) / period
  const screen = 0.3 * Math.min(1, contrast)
  const rough = 0.16 * grain
  const mix = Math.min(1, contrast * 1.4)
  const density = new Float32Array(ink.length)
  const c45 = Math.SQRT1_2
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      // 45° clustered dot: midtones break into dots, solids and paper stay put.
      const u = (x + y) * c45 * freq
      const v = (x - y) * c45 * freq
      const dot = (Math.cos(u) + Math.cos(v)) * 0.25
      const t = threshold + dot * screen + (random() - 0.5) * rough
      const curved = smoothstep(t - soft, t + soft, blurred[i])
      density[i] = ink[i] + (curved - ink[i]) * mix
    }
  }
  return density
}

/**
 * The toner side of a copy, on top of whatever the spatial passes did.
 * Contrast drives spread and curve; grain drives specks, pinholes, ragged edges
 * and solid mottle; bands starve toner across the scan; streaks run along it;
 * voids drop toner out in irregular patches; edge brings in the lid shadow.
 */
export function applyTonalPasses(
  imageData: ImageData,
  params: TonalParams,
  random: () => number,
  exportScale = 1,
): ImageData {
  const { width, height } = imageData
  const out = cloneImageData(imageData)
  if (width < 1 || height < 1) return out
  const pixelScale = copyMachinePixelScale(exportScale)
  const opaque = isOpaqueSource(imageData)
  const grain = Math.min(1.5, paramUnit(params.grain))
  const { alongY } = scanAxes(params.dragAngle ?? COPY_MACHINE_DEFAULTS.dragAngle)
  const lines = alongY ? height : width
  const across = alongY ? width : height

  const density = tonerDensity(inkPlane(imageData), width, height, params, random, pixelScale)

  // Mottle: solids never lie down evenly.
  if (grain > 0.01) {
    const mottle = noisePlane(width, height, 12 * pixelScale, random)
    const amount = 0.13 * Math.min(1, grain)
    for (let i = 0; i < density.length; i++) {
      const solid = smoothstep(0.55, 1, density[i])
      density[i] *= 1 - amount * solid * (0.5 + 0.5 * mottle[i])
    }
  }

  // Bands: toner starvation in stripes across the direction of travel.
  const bands = Math.min(1.5, paramUnit(params.bands))
  if (bands > 0.01) {
    const profile = new Float32Array(lines).fill(1)
    const count = Math.max(2, Math.round(2 + bands * 7))
    for (let band = 0; band < count; band++) {
      const center = random() * lines
      const half = Math.max(2, (0.01 + random() * 0.07) * lines)
      const depth = (0.2 + random() * 0.5) * Math.min(1, bands)
      for (let s = Math.max(0, Math.floor(center - half)); s < Math.min(lines, Math.ceil(center + half)); s++) {
        const falloff = smoothstep(0, 1, 1 - Math.abs(s - center) / half)
        profile[s] = Math.min(profile[s], 1 - depth * falloff)
      }
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) density[y * width + x] *= profile[alongY ? y : x]
    }
  }

  // Streaks: dirt on the glass prints a line, a scratched drum drops one out.
  const streaks = Math.min(1.5, paramUnit(params.streaks ?? 0))
  if (streaks > 0.01) {
    const count = Math.round(streaks * 6 + random() * 2)
    for (let streak = 0; streak < count; streak++) {
      const position = random() * across
      const halfWidth = (0.35 + random() * 1.1) * pixelScale
      const dark = random() < 0.62
      const strength = 0.45 + random() * 0.5
      const flicker = noiseLine(lines, 40 * pixelScale, random)
      const from = Math.max(0, Math.floor(position - halfWidth - 1))
      const to = Math.min(across - 1, Math.ceil(position + halfWidth + 1))
      for (let q = from; q <= to; q++) {
        const coverage = Math.max(0, Math.min(1, halfWidth + 0.5 - Math.abs(q + 0.5 - position)))
        if (coverage <= 0) continue
        for (let s = 0; s < lines; s++) {
          // Streaks break up along their length instead of ruling a perfect line.
          const present = smoothstep(-0.35, 0.1, flicker[s]) * coverage * strength
          if (present <= 0) continue
          const i = alongY ? s * width + q : q * width + s
          density[i] = dark ? density[i] + (1 - density[i]) * present : density[i] * (1 - present)
        }
      }
    }
  }

  // Grain: loose toner on the paper, pinholes in the solids.
  if (grain > 0.01) {
    const speckChance = 0.0011 * grain * grain
    const pinholeChance = 0.006 * grain
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const value = density[y * width + x]
        const roll = random()
        if (value < 0.2 && roll < speckChance) {
          const radius = (0.45 + random() * 1.1) * pixelScale
          const weight = 0.55 + random() * 0.45
          stampDisc(density, width, height, x + random(), y + random(), radius, (d, c) => d + (weight - d) * c * (weight > d ? 1 : 0))
        } else if (value > 0.8 && roll < pinholeChance) {
          const radius = (0.35 + random() * 0.8) * pixelScale
          stampDisc(density, width, height, x + random(), y + random(), radius, (d, c) => d * (1 - 0.85 * c))
        }
      }
    }
  }

  // Voids: irregular dropouts where the paper didn't take toner.
  const voids = Math.min(1.5, paramUnit(params.voids))
  if (voids > 0.01) {
    const count = Math.max(1, Math.round(voids * 6))
    const shortSide = Math.min(width, height)
    for (let blob = 0; blob < count; blob++) {
      const cx = random() * width
      const cy = random() * height
      const radius = Math.max(3, (0.02 + random() * 0.1) * shortSide * Math.min(1, voids))
      const lobes = [random(), random(), random()].map((value) => value * Math.PI * 2)
      const x0 = Math.max(0, Math.floor(cx - radius * 1.4))
      const x1 = Math.min(width - 1, Math.ceil(cx + radius * 1.4))
      const y0 = Math.max(0, Math.floor(cy - radius * 1.4))
      const y1 = Math.min(height - 1, Math.ceil(cy + radius * 1.4))
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const angle = Math.atan2(y - cy, x - cx)
          const reach =
            radius *
            (1 + 0.22 * Math.sin(angle * 2 + lobes[0]) + 0.14 * Math.sin(angle * 3 + lobes[1]) + 0.08 * Math.sin(angle * 5 + lobes[2]))
          const distance = Math.hypot(x - cx, y - cy)
          const coverage = 1 - smoothstep(reach * 0.7, reach, distance)
          if (coverage > 0) density[y * width + x] *= 1 - 0.95 * coverage
        }
      }
    }
  }

  // Edge: the lid was up, so the glass beyond the sheet prints black.
  const edge = Math.min(1.5, paramUnit(params.edge ?? 0))
  if (edge > 0.01) {
    const reach = edge * 0.09 * Math.min(width, height)
    const wander = noisePlane(width, height, Math.max(8, reach * 1.5), random)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x
        const distance = Math.min(x, y, width - 1 - x, height - 1 - y) + wander[i] * reach * 0.45
        const shadow = 1 - smoothstep(reach * 0.15, reach, distance)
        density[i] = Math.max(density[i], shadow * 0.94)
      }
    }
  }

  const { data } = out
  for (let p = 0, i = 0; p < density.length; p++, i += 4) {
    const d = Math.max(0, Math.min(1, density[p]))
    if (opaque) {
      const value = Math.round(255 * (1 - d) + TONER * d)
      data[i] = value
      data[i + 1] = value
      data[i + 2] = value
    } else {
      data[i] = TONER
      data[i + 1] = TONER
      data[i + 2] = TONER
      data[i + 3] = Math.round(255 * d)
    }
  }
  return out
}

/**
 * One more trip through the machine: reduce or enlarge about the centre, and
 * lose a little resolution doing it — the soft step the next toner pass then
 * hardens into thicker, rounder, eroded forms.
 */
export function resampleGeneration(imageData: ImageData, copyScale: number, exportScale = 1): ImageData {
  const { width, height, data } = imageData
  const scale = Math.max(0.25, Math.min(4, copyScale / 100))
  const pixelScale = copyMachinePixelScale(exportScale)
  const out = new ImageData(width, height)
  const outData = out.data
  // A reduced sheet leaves white glass margin; a transparent layer stays transparent.
  if (isOpaqueSource(imageData)) outData.fill(255)
  const cx = width / 2
  const cy = height / 2
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = cx + (x + 0.5 - cx) / scale - 0.5
      const sy = cy + (y + 0.5 - cy) / scale - 0.5
      const oi = (y * width + x) * 4
      if (sx < -0.5 || sy < -0.5 || sx > width - 0.5 || sy > height - 0.5) continue
      const [r, g, b, a] = sampleBilinearRgba(data, width, height, sx, sy)
      outData[oi] = r
      outData[oi + 1] = g
      outData[oi + 2] = b
      outData[oi + 3] = a
    }
  }
  // Optics and toner never resolve the full original: soften before re-toning.
  const radius = Math.max(1, Math.round(0.6 * pixelScale))
  const channels = [0, 1, 2, 3].map((c) => {
    const plane = new Float32Array(width * height)
    for (let p = 0; p < plane.length; p++) plane[p] = outData[p * 4 + c]
    return boxBlur(plane, width, height, radius)
  })
  for (let p = 0; p < width * height; p++) {
    for (let c = 0; c < 4; c++) outData[p * 4 + c] = Math.round(channels[c][p])
  }
  return out
}

/** Full Copy Machine render: spatial warp, then toner — repeated for each generation. */
export function renderCopyMachinePass(
  imageData: ImageData,
  params: CopyMachineParams,
  random: () => number,
  exportScale = 1,
): ImageData {
  let output = applyTonalPasses(applySpatialPasses(imageData, params, random, exportScale), params, random, exportScale)
  const generations = Math.max(1, Math.min(MAX_COPY_GENERATIONS, Math.round(params.generations ?? 1)))
  for (let generation = 1; generation < generations; generation++) {
    output = resampleGeneration(output, params.copyScale ?? 100, exportScale)
    // Each pass slips a little on its own; the drag only happened once.
    const field = buildDisplacementField(
      output.width,
      output.height,
      { wobble: params.wobble * 0.35, wobbleFreq: params.wobbleFreq },
      random,
      exportScale,
    )
    output = applyTonalPasses(applyDisplacement(output, field), params, random, exportScale)
  }
  return output
}

export type CopyMachineChainStep = {
  seed: number
  enabled: boolean
  params: Record<string, number>
}

export function applyCopyMachineChain(
  sourceImageData: ImageData,
  treatments: CopyMachineChainStep[],
  exportScale = 1,
  tensionScale = 1,
): ImageData {
  let imageData = sourceImageData
  for (const treatment of treatments) {
    if (!treatment.enabled) continue
    const params = scaleCopyMachineParams(copyMachineParamsFromRecord(treatment.params), tensionScale)
    const random = createSeededRandom(treatment.seed)
    imageData = renderCopyMachinePass(imageData, params, random, exportScale)
  }
  return imageData
}

/** Ghost companion — tonal only (the other drum pass), no spatial warp. */
export function renderCopyMachineGhostPass(
  imageData: ImageData,
  params: TonalParams,
  random: () => number,
  exportScale = 1,
): ImageData {
  return applyTonalPasses(imageData, params, random, exportScale)
}

/** ghost 0..100 → companion opacity (0 when off). */
export function copyMachineGhostOpacity(ghost: number): number {
  return paramUnit(ghost) * 0.4
}

/** Pixel offset for the misregistration echo (right + slightly up). */
export function copyMachineGhostDelta(ghostOffset: number): { dx: number; dy: number } {
  const offset = Math.max(0, ghostOffset)
  return {
    dx: offset,
    dy: -offset * 0.45,
  }
}

/** Shared misprint/ghost placement for the misprint instrument and Copy Machine companions. */
export function misprintCompanionPose(options: {
  left: number
  top: number
  angle: number
  offset: number
  opacity: number
}) {
  const { dx, dy } = copyMachineGhostDelta(options.offset)
  return {
    left: options.left + dx,
    top: options.top + dy,
    angle: options.angle - options.offset * 0.18,
    opacity: options.opacity,
    globalCompositeOperation: 'multiply' as const,
  }
}

/**
 * CM-3 — per-layer seeds for a poster-scope copier pass.
 * One master seed; each layer gets `seed + layerIndex` so the pass feels unified but stays re-rollable per layer.
 */
export function copyMachineLayerSeeds(masterSeed: number, layerCount: number): number[] {
  const count = Math.max(0, Math.floor(layerCount))
  const base = Math.floor(masterSeed) >>> 0
  return Array.from({ length: count }, (_, index) => (base + index) >>> 0)
}
