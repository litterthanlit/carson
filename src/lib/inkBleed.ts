/**
 * Ink load — how much ink actually reached the paper, and where.
 *
 * A worn roller, a tired drum or a stamp pad never ink evenly. The load drifts
 * across the sheet in long trains along the feed, so one line of type floods
 * while the next one starves, and the change runs across a single word:
 * - flood: wet ink squeezes out past the edge of every stroke, by the same
 *   distance all round — counters close, letters run into each other, and
 *   surface tension rounds the pooled ink into one blob
 * - wick: the wet edge follows the paper fibres, so it comes out lumpy and furred
 * - starve: too little ink lands on the tooth of the paper only — strokes thin,
 *   break into chunks and speckle
 * - slur: wet ink drags along the feed in streaks and hairlines
 *
 * Spread and erosion are distances, measured with an exact distance transform
 * and scaled to the type's own stroke weight, so the same setting reads the
 * same on 12 pt and 300 pt. Pure, seeded and headless-testable.
 */

import {
  pressInkPlane,
  SHEET_SALT,
  sheetFractal,
  sheetGrain,
  sheetLine,
  sheetNoise,
  type SheetPatch,
} from './press'

export type InkLoadParams = {
  /** How far ink floods past the edge where the sheet is wettest, 0–100. */
  bleed: number
  /** How badly ink drops out where the sheet is driest, 0–100. */
  starve: number
  /** Wet ink dragged along the feed, 0–100. */
  slur: number
  /** Feed direction in degrees — ink trains and slurs run along it. */
  dragAngle: number
}

export const INK_LOAD_DEFAULTS: InkLoadParams = {
  bleed: 0,
  starve: 0,
  slur: 0,
  dragAngle: 0,
}

const MAX_PARAM = 200
const INF = 1e20

function unit(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(MAX_PARAM, value)) / 100
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(1e-6, edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** True when the ink stage changes nothing — and so must draw no random numbers. */
export function inkLoadIsIdle(params: Partial<InkLoadParams>): boolean {
  return unit(params.bleed) < 0.005 && unit(params.starve) < 0.005 && unit(params.slur) < 0.005
}

/**
 * One row of the Felzenszwalb–Huttenlocher squared distance transform. `src`
 * receives, for every sample, the index of the sample it is nearest to.
 */
function distance1d(
  f: Float64Array,
  n: number,
  d: Float64Array,
  src: Int32Array,
  v: Int32Array,
  z: Float64Array,
) {
  let k = 0
  v[0] = 0
  z[0] = -INF
  z[1] = INF
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    while (s <= z[k]) {
      k--
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = INF
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    const dq = q - v[k]
    d[q] = dq * dq + f[v[k]]
    src[q] = v[k]
  }
}

export type FeatureTransform = {
  /** Exact Euclidean distance to the nearest feature pixel. */
  distance: Float32Array
  /** Index of that nearest feature pixel (-1 when there are none). */
  nearest: Int32Array
}

/** Exact distance and nearest-pixel map to every pixel where `feature` holds. */
export function featureTransform(feature: Uint8Array, width: number, height: number): FeatureTransform {
  const size = Math.max(width, height)
  const f = new Float64Array(size)
  const d = new Float64Array(size)
  const src = new Int32Array(size)
  const v = new Int32Array(size)
  const z = new Float64Array(size + 1)
  const count = width * height
  const distance = new Float32Array(count)
  const nearest = new Int32Array(count).fill(-1)
  let any = false
  for (let i = 0; i < count; i++) if (feature[i]) any = true
  if (!any) return { distance: distance.fill(Infinity), nearest }

  // Columns: nearest feature row within each column.
  const grid = new Float64Array(count)
  const row = new Int32Array(count)
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) f[y] = feature[y * width + x] ? 0 : INF
    distance1d(f, height, d, src, v, z)
    for (let y = 0; y < height; y++) {
      grid[y * width + x] = d[y]
      row[y * width + x] = src[y]
    }
  }
  // Rows: nearest column, carrying the row found for it.
  for (let y = 0; y < height; y++) {
    const offset = y * width
    for (let x = 0; x < width; x++) f[x] = grid[offset + x]
    distance1d(f, width, d, src, v, z)
    for (let x = 0; x < width; x++) {
      const column = src[x]
      distance[offset + x] = Math.sqrt(d[x])
      nearest[offset + x] = row[offset + column] * width + column
    }
  }
  return { distance, nearest }
}

export type InkDistanceField = {
  /** Signed distance to the ink edge in px: negative inside a stroke, positive outside. */
  signed: Float32Array
  /** Nearest edge pixel of the ink, for every pixel (-1 when there is no edge). */
  edge: Int32Array
  /** 1 where the pixel is an ink pixel touching paper. */
  isEdge: Uint8Array
}

/**
 * Signed distance to the ink edge and, for every pixel, the edge pixel it is
 * nearest to. Antialiased edge pixels use their coverage for sub-pixel
 * placement. The raster's own border is not an edge: a photo running off the
 * frame has no edge there to bleed from.
 */
export function inkDistanceField(ink: Float32Array, width: number, height: number): InkDistanceField {
  const count = width * height
  const isEdge = new Uint8Array(count)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (ink[i] < 0.5) continue
      if (
        (x > 0 && ink[i - 1] < 0.5) ||
        (x < width - 1 && ink[i + 1] < 0.5) ||
        (y > 0 && ink[i - width] < 0.5) ||
        (y < height - 1 && ink[i + width] < 0.5)
      ) {
        isEdge[i] = 1
      }
    }
  }
  const { distance, nearest } = featureTransform(isEdge, width, height)
  const signed = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const d = distance[i]
    if (!Number.isFinite(d)) {
      // No edge anywhere: all paper or all ink.
      signed[i] = ink[i] >= 0.5 ? -INF : INF
      continue
    }
    // Edge pixel centres sit half a pixel inside the edge.
    const value = ink[i] >= 0.5 ? -(d + 0.5) : d - 0.5
    signed[i] = Math.abs(value) < 1 ? 0.5 - ink[i] : value
  }
  return { signed, edge: nearest, isEdge }
}

/** The typical stroke never reads wider than this share of the raster's short side. */
const MAX_STROKE_SHARE = 0.2
/** A stroke heavier than this many typical strokes floods no further — a slab is not a letter. */
const MAX_LOCAL_STROKES = 2.5

/**
 * Typical stroke half-width in px: the depth of the distance field along the
 * centre lines of the strokes (its ridge). Counting ridge pixels weighs each
 * stroke by its length, not its area, so a slab of black or a dark photo
 * doesn't swamp the type around it. Bleed and erosion scale with it, so a
 * hairline and a heavy stroke flood in proportion.
 */
export function strokeHalfWidth(signed: Float32Array, width: number, height: number): number {
  // Histogram in quarter-pixel bins: exact enough, and linear on a 4K raster.
  const binsPerPx = 4
  const bins = new Uint32Array(1024 * binsPerPx)
  let count = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const depth = -signed[i]
      if (depth <= 0.75) continue
      // A crest across the stroke: no lower than either side and above one of
      // them. Along the stroke the depth stays flat, which is not a crest.
      const left = -signed[i - 1]
      const right = -signed[i + 1]
      const up = -signed[i - width]
      const down = -signed[i + width]
      const ridgeX = depth >= left && depth >= right && (depth > left || depth > right)
      const ridgeY = depth >= up && depth >= down && (depth > up || depth > down)
      if (!ridgeX && !ridgeY) continue
      bins[Math.min(bins.length - 1, Math.floor(depth * binsPerPx))]++
      count++
    }
  }
  const cap = Math.max(1, MAX_STROKE_SHARE * Math.min(width, height))
  if (count < 4) return 1
  const target = count * 0.5
  let seen = 0
  for (let bin = 0; bin < bins.length; bin++) {
    seen += bins[bin]
    if (seen >= target) return Math.max(1, Math.min(cap, (bin + 0.5) / binsPerPx))
  }
  return cap
}

export type InkWidths = {
  /** Half-width of the stroke each pixel belongs to or lies beside. */
  stroke: Float32Array
  /** Half-width of the paper the nearest edge faces: a counter, a letter gap, or open sheet (capped). */
  gap: Float32Array
}

/**
 * Stroke and gap half-widths at every pixel. From each edge pixel the
 * distance field is climbed twice: inward to the centre line of its stroke,
 * and outward to the middle of the counter or letter gap it faces. Every other
 * pixel takes the widths of the edge it is nearest to. Small type beside a
 * slab of black floods as small type, ink pools deeper where strokes meet,
 * and tight letter spacing is measured rather than assumed. `typical` (see
 * strokeHalfWidth) bounds both, so a slab or a dark photo can't run for miles.
 */
export function localInkWidths(field: InkDistanceField, width: number, height: number, typical: number): InkWidths {
  const { signed, edge, isEdge } = field
  const cap = Math.max(2, typical * MAX_LOCAL_STROKES)
  const maxSteps = Math.ceil(cap * 1.5) + 2
  // Raw distances, not the antialiased ones, so each climb is monotone.
  const inkDepth = (i: number) => {
    const value = -signed[i]
    return value > -1 && value < 1 ? (value > 0 ? 0.5 : -0.5) : value
  }
  const paperDepth = (i: number) => -inkDepth(i)
  const climb = (start: number, height_: (i: number) => number) => {
    let current = start
    let level = height_(current)
    for (let step = 0; step < maxSteps; step++) {
      const cx = current % width
      const cy = (current - cx) / width
      let best = current
      for (let dy = -1; dy <= 1; dy++) {
        const ny = cy + dy
        if (ny < 0 || ny >= height) continue
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx
          if ((dx === 0 && dy === 0) || nx < 0 || nx >= width) continue
          const n = ny * width + nx
          const value = height_(n)
          if (value > level + 1e-3) {
            best = n
            level = value
          }
        }
      }
      if (best === current) break
      current = best
    }
    return Math.max(0.5, Math.min(cap, level))
  }
  const strokeAtEdge = new Float32Array(signed.length)
  const gapAtEdge = new Float32Array(signed.length)
  for (let i = 0; i < signed.length; i++) {
    if (!isEdge[i]) continue
    strokeAtEdge[i] = climb(i, inkDepth)
    gapAtEdge[i] = climb(i, paperDepth)
  }
  const stroke = new Float32Array(signed.length)
  const gap = new Float32Array(signed.length)
  for (let i = 0; i < stroke.length; i++) {
    const nearest = edge[i]
    stroke[i] = nearest >= 0 ? strokeAtEdge[nearest] : 1
    gap[i] = nearest >= 0 ? gapAtEdge[nearest] : cap
  }
  return { stroke, gap }
}

/** Smooth seeded noise in -1..1 with separate feature sizes along x and y. */
function valueNoise(
  width: number,
  height: number,
  cellX: number,
  cellY: number,
  random: () => number,
): Float32Array {
  const cx = Math.max(1, cellX)
  const cy = Math.max(1, cellY)
  const cols = Math.ceil(width / cx) + 2
  const rows = Math.ceil(height / cy) + 2
  const grid = new Float32Array(cols * rows)
  for (let i = 0; i < grid.length; i++) grid[i] = random() * 2 - 1
  // Column lattice index and smoothed weight are the same on every row.
  const column = new Int32Array(width)
  const weight = new Float32Array(width)
  for (let x = 0; x < width; x++) {
    const gx = x / cx
    const x0 = Math.floor(gx)
    const tx = gx - x0
    column[x] = x0
    weight[x] = tx * tx * (3 - 2 * tx)
  }
  const plane = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    const gy = y / cy
    const y0 = Math.floor(gy)
    const ty = gy - y0
    const fy = ty * ty * (3 - 2 * ty)
    const top = y0 * cols
    const bottom = top + cols
    const out = y * width
    for (let x = 0; x < width; x++) {
      const i = column[x]
      const fx = weight[x]
      const a = grid[top + i] + (grid[top + i + 1] - grid[top + i]) * fx
      const b = grid[bottom + i] + (grid[bottom + i + 1] - grid[bottom + i]) * fx
      plane[out + x] = a + (b - a) * fy
    }
  }
  return plane
}

/** Sum of octaves, each half the size and half the weight, normalised to about -1..1. */
function fractalNoise(
  width: number,
  height: number,
  cellX: number,
  cellY: number,
  octaves: number,
  random: () => number,
): Float32Array {
  const out = new Float32Array(width * height)
  let weight = 1
  let total = 0
  for (let octave = 0; octave < octaves; octave++) {
    const scale = 2 ** octave
    const layer = valueNoise(width, height, cellX / scale, cellY / scale, random)
    for (let i = 0; i < out.length; i++) out[i] += layer[i] * weight
    total += weight
    weight *= 0.5
  }
  // Value noise rarely reaches its extremes; stretch it back toward -1..1.
  const gain = 1.6 / total
  for (let i = 0; i < out.length; i++) out[i] = Math.max(-1, Math.min(1, out[i] * gain))
  return out
}

/** Running-sum box pass along each row, edges clamped. */
function boxRows(src: Float32Array, dst: Float32Array, width: number, height: number, r: number) {
  const span = 2 * r + 1
  const last = width - 1
  for (let y = 0; y < height; y++) {
    const base = y * width
    let sum = src[base] * (r + 1)
    for (let i = 1; i <= r; i++) sum += src[base + Math.min(i, last)]
    for (let x = 0; x < width; x++) {
      dst[base + x] = sum / span
      const add = x + r + 1
      const drop = x - r
      sum += src[base + (add > last ? last : add)] - src[base + (drop < 0 ? 0 : drop)]
    }
  }
}

/** Running-sum box pass down each column, walked row by row so memory is read in order. */
function boxColumns(src: Float32Array, dst: Float32Array, width: number, height: number, r: number) {
  const span = 2 * r + 1
  const last = height - 1
  const sums = new Float64Array(width)
  for (let x = 0; x < width; x++) sums[x] = src[x] * (r + 1)
  for (let i = 1; i <= r; i++) {
    const row = Math.min(i, last) * width
    for (let x = 0; x < width; x++) sums[x] += src[row + x]
  }
  for (let y = 0; y < height; y++) {
    const out = y * width
    const add = Math.min(y + r + 1, last) * width
    const drop = Math.max(y - r, 0) * width
    for (let x = 0; x < width; x++) {
      dst[out + x] = sums[x] / span
      sums[x] += src[add + x] - src[drop + x]
    }
  }
}

/** Separable running-sum box blur, two passes ≈ tent. */
function boxBlur(plane: Float32Array, width: number, height: number, radius: number): Float32Array {
  const r = Math.round(radius)
  if (r < 1) return plane
  const temp = new Float32Array(plane.length)
  const out = new Float32Array(plane.length)
  boxRows(plane, temp, width, height, r)
  boxColumns(temp, out, width, height, r)
  boxRows(out, temp, width, height, r)
  boxColumns(temp, out, width, height, r)
  return out
}

type Plane = { data: Float32Array; width: number; height: number; scale: number }

/** Half-size box average. */
function halve(plane: Plane): Plane {
  const width = Math.max(1, Math.ceil(plane.width / 2))
  const height = Math.max(1, Math.ceil(plane.height / 2))
  const data = new Float32Array(width * height)
  const src = plane.data
  const sw = plane.width
  for (let y = 0; y < height; y++) {
    const y0 = Math.min(plane.height - 1, y * 2)
    const y1 = Math.min(plane.height - 1, y * 2 + 1)
    for (let x = 0; x < width; x++) {
      const x0 = Math.min(sw - 1, x * 2)
      const x1 = Math.min(sw - 1, x * 2 + 1)
      data[y * width + x] = (src[y0 * sw + x0] + src[y0 * sw + x1] + src[y1 * sw + x0] + src[y1 * sw + x1]) * 0.25
    }
  }
  return { data, width, height, scale: plane.scale * 2 }
}

/** Bilinear read of a reduced plane at a full-size pixel. */
function sampleReduced(plane: Plane, x: number, y: number): number {
  if (plane.scale === 1) return plane.data[y * plane.width + x]
  const u = Math.max(0, Math.min(plane.width - 1, (x + 0.5) / plane.scale - 0.5))
  const v = Math.max(0, Math.min(plane.height - 1, (y + 0.5) / plane.scale - 0.5))
  const x0 = Math.floor(u)
  const y0 = Math.floor(v)
  const x1 = Math.min(plane.width - 1, x0 + 1)
  const y1 = Math.min(plane.height - 1, y0 + 1)
  const fx = u - x0
  const fy = v - y0
  const d = plane.data
  const w = plane.width
  const top = d[y0 * w + x0] + (d[y0 * w + x1] - d[y0 * w + x0]) * fx
  const bottom = d[y1 * w + x0] + (d[y1 * w + x1] - d[y1 * w + x0]) * fx
  return top + (bottom - top) * fy
}

/**
 * Box blurs at radius 1, 2, 4 … up to `widest`. Past radius 2 each one runs
 * on a plane halved once more, so a wide blur costs no more than a narrow one.
 */
function blurOctaves(plane: Float32Array, width: number, height: number, widest: number): Plane[] {
  const levels: Plane[] = [{ data: boxBlur(plane, width, height, 1), width, height, scale: 1 }]
  let reduced: Plane = { data: plane, width, height, scale: 1 }
  for (let radius = 2; radius <= Math.max(1, widest); radius *= 2) {
    if (radius > 2) reduced = halve(reduced)
    const r = radius / reduced.scale
    levels.push({ ...reduced, data: boxBlur(reduced.data, reduced.width, reduced.height, r) })
  }
  return levels
}

type FeedAxes = {
  /** Feed runs along x (rows are feed lines) or along y. */
  alongX: boolean
  /** +1 when ink is dragged toward increasing x/y. */
  sign: 1 | -1
}

function feedAxes(dragAngle: number): FeedAxes {
  const angle = (dragAngle * Math.PI) / 180
  const ux = Math.cos(angle)
  const uy = Math.sin(angle)
  const alongX = Math.abs(ux) >= Math.abs(uy)
  return { alongX, sign: (alongX ? ux : uy) >= 0 ? 1 : -1 }
}

/**
 * Ink load across the sheet, -1 (bone dry) … +1 (flooded). Trains run long
 * along the feed and short across it, so neighbouring lines of type differ
 * while a single line drifts from one end to the other.
 */
export function inkLoadField(
  width: number,
  height: number,
  params: Pick<InkLoadParams, 'bleed' | 'starve' | 'dragAngle'>,
  scale: number,
  random: () => number,
): Float32Array {
  const bleed = unit(params.bleed)
  const starve = unit(params.starve)
  const { alongX } = feedAxes(params.dragAngle)
  const along = alongX ? width : height
  const across = alongX ? height : width
  // A train runs a few letters along the feed and about half a line across it.
  const cellAlong = Math.min(along, scale * 24)
  const cellAcross = Math.max(scale * 4, Math.min(across * 0.3, scale * 9))
  const field = fractalNoise(
    width,
    height,
    alongX ? cellAlong : cellAcross,
    alongX ? cellAcross : cellAlong,
    3,
    random,
  )
  return shapeInkLoad(field, bleed, starve)
}

/**
 * Raw ink trains (-1..1) to load. Only bleed asked for → most of the sheet
 * floods; only starve → most of it starves; both → the sheet splits between
 * them with clean ink in between. Shapes in place.
 */
function shapeInkLoad(field: Float32Array, bleed: number, starve: number): Float32Array {
  const wet = bleed + starve > 0 ? bleed / (bleed + starve) : 0.5
  const bias = (wet - 0.5) * 1.5
  for (let i = 0; i < field.length; i++) {
    const n = field[i] + bias
    // Most of a wet sheet only swells; full flood is the rare puddle. Dry
    // patches fall off faster, the way a roller skips.
    field[i] = n > 0 ? smoothstep(0.05, 0.9, n) ** 2 : -(smoothstep(0.05, 0.85, -n) ** 1.2)
  }
  return field
}

/** Ink load over a raster's patch of the press sheet: the same trains under every layer. */
export function sheetInkLoadField(
  patch: SheetPatch,
  width: number,
  height: number,
  params: Pick<InkLoadParams, 'bleed' | 'starve'>,
): Float32Array {
  return shapeInkLoad(pressInkPlane(patch, width, height), unit(params.bleed), unit(params.starve))
}

export type InkLoadResult = {
  /** Coverage after re-inking, 0 paper … 1 solid. */
  ink: Float32Array
  /** 0 dry … 1 flooded — where wet ink has filled the screen and evened the solid. */
  wet: Float32Array
}

/**
 * Re-ink a coverage plane (0 paper … 1 solid ink) the way an uneven press or
 * drum would lay it down. Returns new planes; the input is untouched.
 *
 * With a `sheet`, the ink trains, paper and slur come from the poster's press
 * at this raster's place on it, and the feed is the press's — so layers on one
 * poster flood, starve and drag together. Without one, the raster is its own
 * sheet, drawn from `random` (posters made before the press).
 */
export function applyInkLoad(
  ink: Float32Array,
  width: number,
  height: number,
  params: Partial<InkLoadParams>,
  random: () => number,
  pixelScale = 1,
  sheet?: SheetPatch,
): InkLoadResult {
  const bleed = unit(params.bleed)
  const starve = unit(params.starve)
  const slur = unit(params.slur)
  const out = new Float32Array(ink)
  const wetMask = new Float32Array(ink.length)
  if (width < 2 || height < 2 || inkLoadIsIdle(params)) return { ink: out, wet: wetMask }
  const dragAngle = sheet ? sheet.press.feedAngle : (params.dragAngle ?? INK_LOAD_DEFAULTS.dragAngle)

  const px = Math.max(0.5, pixelScale)
  const field = inkDistanceField(ink, width, height)
  const signed = field.signed
  // Local weight sets how far ink travels; the typical weight sets the grain of
  // the paper and the ink trains, which belong to the whole sheet.
  const stroke = strokeHalfWidth(signed, width, height)
  const { stroke: local, gap } = localInkWidths(field, width, height, stroke)

  const inkParams = { bleed: params.bleed ?? 0, starve: params.starve ?? 0 }
  const load =
    bleed > 0 || starve > 0
      ? sheet
        ? sheetInkLoadField(sheet, width, height, inkParams)
        : inkLoadField(width, height, { ...inkParams, dragAngle }, stroke, random)
      : new Float32Array(ink.length)

  // How far ink travels at full load: past half a stroke into open paper, and
  // past the middle of a counter or letter gap only where the sheet runs
  // wettest — so heavy, tight type swells before it fuses, as in print.
  // Starvation eats into the stroke but never all of it.
  const spreadAt = (i: number) => bleed * (Math.min(local[i] * 1.3, gap[i] * 1.6) + 1.5 * px)
  const erodeAt = (i: number) => Math.min(1, starve) * local[i] * 0.7

  // Paper the ink meets: lumps a stroke wide, fibres a pixel or two long, tooth per grain.
  const { lumps, fibres, chunks, tooth } = sheet
    ? sheetPaper(sheet, width, height, stroke)
    : localPaper(width, height, stroke, px, random)

  // Coverage of a pixel whose centre sits `inside` px inside an edge: a one
  // pixel ramp, so with no load the antialiased edge comes back unchanged.
  const cover = (inside: number) => (inside <= -0.5 ? 0 : inside >= 0.5 ? 1 : inside + 0.5)
  for (let i = 0; i < ink.length; i++) {
    const l = load[i]
    const sd = signed[i]
    if (l >= 0) {
      const spread = l * spreadAt(i)
      // The wet edge wanders with the paper: big lumps, then furred fibres.
      const wander = spread > 0.05 ? lumps[i] * spread * 0.28 + fibres[i] * (0.35 * px + spread * 0.14) : 0
      out[i] = Math.max(ink[i], cover(spread + wander - sd))
      wetMask[i] = smoothstep(0.05, 0.35, l)
    } else {
      const dry = -l * Math.min(1, starve)
      if (dry <= 0) continue
      // Strokes thin from the edge, hairlines go first, and chunks fall out
      // where the paper sat low. Paper-side tones (a photo's lights) keep
      // their tooth but have no edge to lose.
      const edge = sd > 0.5 ? 1 : cover(fibres[i] * dry * 0.6 * px - dry * erodeAt(i) - sd)
      const drop = chunks[i] * 0.85 + tooth[i] * 0.22
      const keep = smoothstep(dry * 1.9 - 1.25, dry * 1.9 - 1.1, drop)
      out[i] = Math.min(ink[i], edge) * keep
    }
  }

  // Surface tension: pooled ink rounds off and fills the corners it ran into,
  // over a reach set by how far it ran — so blurs come in octaves and each
  // pixel reads the one that matches its own stroke.
  if (bleed > 0.01) {
    let widest = 0
    for (let i = 0; i < out.length; i++) if (wetMask[i] > 0) widest = Math.max(widest, spreadAt(i))
    const levels = blurOctaves(out, width, height, widest * 0.22)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x
        const w = wetMask[i]
        if (w <= 0) continue
        const want = Math.max(1, spreadAt(i) * 0.22)
        const level = Math.min(levels.length - 1, Math.max(0, Math.log2(want)))
        const lo = Math.floor(level)
        const hi = Math.min(levels.length - 1, lo + 1)
        const t = level - lo
        const near = sampleReduced(levels[lo], x, y)
        const tension = t > 0 ? near + (sampleReduced(levels[hi], x, y) - near) * t : near
        const pooled = smoothstep(0.42, 0.58, tension)
        out[i] = out[i] + (Math.max(pooled, ink[i] * 0.999) - out[i]) * w
      }
    }
  }

  if (slur > 0.01) {
    if (sheet) applySheetSlur(out, load, width, height, slur, sheet, stroke, px)
    else applySlur(out, load, width, height, slur, feedAxes(dragAngle), stroke, px, random)
  }
  return { ink: out, wet: wetMask }
}

type Paper = { lumps: Float32Array; fibres: Float32Array; chunks: Float32Array; tooth: Float32Array }

/** The raster as its own sheet of paper. Draw order is fixed: older copies depend on it. */
function localPaper(width: number, height: number, stroke: number, px: number, random: () => number): Paper {
  const lumps = valueNoise(width, height, stroke * 1.6, stroke * 1.6, random)
  const fibres = fractalNoise(width, height, 2.6 * px, 1.3 * px, 2, random)
  const chunks = fractalNoise(width, height, stroke * 2.2, stroke * 1.8, 2, random)
  const tooth = new Float32Array(width * height)
  const toothField = valueNoise(width, height, 1.1 * px, 1.1 * px, random)
  for (let i = 0; i < tooth.length; i++) tooth[i] = toothField[i] * 0.7 + (random() * 2 - 1) * 0.3
  return { lumps, fibres, chunks, tooth }
}

/**
 * The press's sheet under this raster: fibres lie along the feed (the paper's
 * grain), and every layer reads the same tooth where they overlap. Lumps and
 * chunks keep the scale of this layer's strokes.
 */
function sheetPaper(sheet: SheetPatch, width: number, height: number, stroke: number): Paper {
  const strokePx = stroke * sheet.unit
  const lumps = sheetNoise(sheet, width, height, strokePx * 1.6, strokePx * 1.6, SHEET_SALT.lumps)
  const fibres = sheetFractal(sheet, width, height, 2.6, 1.3, 2, SHEET_SALT.fibres)
  const chunks = sheetFractal(sheet, width, height, strokePx * 2.2, strokePx * 1.8, 2, SHEET_SALT.chunks)
  const toothField = sheetNoise(sheet, width, height, 1.1, 1.1, SHEET_SALT.tooth)
  const grain = sheetGrain(sheet, width, height, Math.max(0.75, sheet.unit), SHEET_SALT.grain)
  const tooth = new Float32Array(width * height)
  for (let i = 0; i < tooth.length; i++) tooth[i] = toothField[i] * 0.7 + grain[i] * 0.3
  return { lumps, fibres, chunks, tooth }
}

/**
 * Wet ink dragged along the feed. Each feed line slips by its own amount, so
 * most lines get a short tail and a few pull out long hairlines; dry ink
 * barely moves.
 */
function applySlur(
  plane: Float32Array,
  load: Float32Array,
  width: number,
  height: number,
  slur: number,
  axes: FeedAxes,
  stroke: number,
  px: number,
  random: () => number,
) {
  const lines = axes.alongX ? height : width
  const length = axes.alongX ? width : height
  const reach = slur * (stroke * 6 + 12 * px)
  // Slips come in runs a pixel or two wide — a fibre, a burr on the roller.
  const run = Math.max(1, Math.round(2 * px))
  // Dragged ink skips as the paper lifts, so long pulls break into dashes.
  const flicker = valueNoise(length * 2, 1, 7 * px, 7 * px, random)
  let tail = 0
  let offset = 0
  for (let line = 0; line < lines; line++) {
    if (line % run === 0) {
      const roll = random()
      // Mostly short smears, now and then a long pull.
      tail = reach * (0.04 + 0.3 * roll ** 3 + (roll > 0.88 ? 0.4 + 1.2 * random() : 0))
      offset = Math.floor(random() * length)
    }
    dragLine(plane, load, width, axes, line, length, tail, (step) => flicker[step + offset])
  }
}

/**
 * Slur on the press: a slip belongs to a line across the feed of the whole
 * sheet, so it marks every layer that crosses that line, and its dashes fall
 * at the same places along it.
 */
function applySheetSlur(
  plane: Float32Array,
  load: Float32Array,
  width: number,
  height: number,
  slur: number,
  sheet: SheetPatch,
  stroke: number,
  px: number,
) {
  const axes = feedAxes(sheet.press.feedAngle)
  const lines = axes.alongX ? height : width
  const length = axes.alongX ? width : height
  const reach = slur * (stroke * 6 + 12 * px)
  // Runs two poster px wide, numbered from the sheet's edge, not the layer's.
  const origin = axes.alongX ? sheet.originY : sheet.originX
  const runPx = 2
  const dashes = sheetNoise(sheet, width, height, 7, runPx, SHEET_SALT.dashes)
  let lastRun = Number.NaN
  let tail = 0
  for (let line = 0; line < lines; line++) {
    const runIndex = Math.floor((origin + (line + 0.5) * sheet.unit) / runPx)
    if (runIndex !== lastRun) {
      lastRun = runIndex
      const roll = sheetLine(sheet.press, SHEET_SALT.slur, runIndex)
      const pull = sheetLine(sheet.press, SHEET_SALT.slur + 32, runIndex)
      tail = reach * (0.04 + 0.3 * roll ** 3 + (roll > 0.88 ? 0.4 + 1.2 * pull : 0))
    }
    dragLine(plane, load, width, axes, line, length, tail, (_step, i) => dashes[i])
  }
}

/** Drag wet ink down one feed line, carrying a decaying tail past each stroke. */
function dragLine(
  plane: Float32Array,
  load: Float32Array,
  width: number,
  axes: FeedAxes,
  line: number,
  length: number,
  tail: number,
  dash: (step: number, i: number) => number,
) {
  const decay = Math.exp(-1 / Math.max(0.5, tail))
  let carried = 0
  for (let step = 0; step < length; step++) {
    const s = axes.sign > 0 ? step : length - 1 - step
    const i = axes.alongX ? line * width + s : s * width + line
    const value = plane[i]
    if (carried > value) {
      const dashes = smoothstep(-0.45, 0.05, dash(step, i))
      plane[i] = Math.max(value, carried * dashes)
    }
    // Wet ink travels; starved ink stays where it landed.
    const l = load[i]
    const wet = l >= 0 ? 0.6 + 0.4 * l : 0.6 * (1 + l)
    carried = Math.max(value * wet, carried * decay)
  }
}
