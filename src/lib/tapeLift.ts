/**
 * Tape lift — the oldest transfer trick in the paste-up room.
 *
 * Lay tape over printed type by hand, rub it down with a thumbnail, peel it
 * off. The toner lets go of the paper unevenly: harder where the thumb
 * pressed, along the paper's fibres rather than in a clean fade, best of all
 * right at the tape's edges where it stuck hardest. Where the tape gripped
 * too well it tears the paper's skin off with it. What leaves the sheet is
 * exactly what arrives on the tape, so the print and the strip are two halves
 * of one accident — and the strip usually gets stuck back down nearby,
 * a little askew.
 *
 * This module is the physics, on plain arrays: the band where the tape went
 * down, the pressure of the burnishing, the fibre structure of the paper, and
 * from those the lift and tear maps. Rasters and Fabric live in the treatment.
 */
import { createSeededRandom } from './random'

export type TapeLiftParams = {
  /** 0–100: how hard the tape was rubbed down. */
  pressure: number
  /** 0–100: tape width as a share of the layer's depth across the tape. */
  width: number
  /** Degrees: tape direction relative to the layer's own horizontal. */
  angle: number
  /** 0–100: where across the layer the tape went down. */
  position: number
  /** 0–100: how far the lifted strip is stuck back down; 0 throws it away. */
  relay: number
  /** 0–100: how much paper skin tears off with the tape. */
  tear: number
  /** 0 = clear packing tape, 1 = masking tape. */
  tape: number
  /** 1 = the strip is stuck back sticky side up, so the lifted print reads mirrored. */
  mirror: number
}

export const TAPE_LIFT_DEFAULTS: TapeLiftParams = {
  pressure: 62,
  width: 55,
  angle: 0,
  position: 50,
  relay: 55,
  tear: 30,
  tape: 0,
  mirror: 0,
}

export function tapeLiftParamsFromRecord(params: Record<string, number>): TapeLiftParams {
  const read = (key: keyof TapeLiftParams) => (Number.isFinite(params[key]) ? params[key] : TAPE_LIFT_DEFAULTS[key])
  return {
    pressure: read('pressure'),
    width: read('width'),
    angle: read('angle'),
    position: read('position'),
    relay: read('relay'),
    tear: read('tear'),
    tape: read('tape') >= 0.5 ? 1 : 0,
    mirror: read('mirror') >= 0.5 ? 1 : 0,
  }
}

type Vec = { x: number; y: number }

/** A layer's frame in poster space: centre, unit axes, half extents. */
export type LayerFrame = { center: Vec; ex: Vec; ey: Vec; halfW: number; halfH: number }

/** Where the tape went down, in poster space. */
export type TapeBand = {
  center: Vec
  /** Unit vector along the tape. */
  dir: Vec
  /** Unit vector across the tape. */
  normal: Vec
  length: number
  width: number
}

const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y

/**
 * Lay the tape across the layer. Hands aren't rulers: the strip lands a
 * couple of degrees off and a touch off-centre, and it always runs past the
 * print on both ends.
 */
export function tapeBand(frame: LayerFrame, params: TapeLiftParams, random: () => number): TapeBand {
  const angle = ((params.angle + (random() - 0.5) * 5) * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dir = { x: frame.ex.x * cos + frame.ey.x * sin, y: frame.ex.y * cos + frame.ey.y * sin }
  let normal = { x: -dir.y, y: dir.x }
  if (dot(normal, frame.ey) < 0) normal = { x: -normal.x, y: -normal.y }

  const across = (Math.max(0, Math.min(100, params.position)) / 100 - 0.5) * 2 * frame.halfH * 0.85
  const anchor = {
    x: frame.center.x + frame.ey.x * across,
    y: frame.center.y + frame.ey.y * across,
  }
  const corners = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sy) => ({
      x: frame.center.x + frame.ex.x * frame.halfW * sx + frame.ey.x * frame.halfH * sy,
      y: frame.center.y + frame.ex.y * frame.halfW * sx + frame.ey.y * frame.halfH * sy,
    })),
  )
  const along = corners.map((corner) => dot({ x: corner.x - anchor.x, y: corner.y - anchor.y }, dir))
  const depth = corners.map((corner) => dot({ x: corner.x - anchor.x, y: corner.y - anchor.y }, normal))
  const low = Math.min(...along)
  const high = Math.max(...along)
  const span = Math.max(1, Math.max(...depth) - Math.min(...depth))
  const width = Math.max(span * 0.08, (Math.max(5, Math.min(100, params.width)) / 100) * span)
  const overhang = (high - low) * (0.08 + random() * 0.08) + width * 0.4
  const middle = (low + high) / 2 + (random() - 0.5) * width * 0.3
  return {
    center: { x: anchor.x + dir.x * middle, y: anchor.y + dir.y * middle },
    dir,
    normal,
    length: high - low + overhang * 2,
    width,
  }
}

/** Where the lifted strip gets stuck back down, or null if it went in the bin. */
export function relaidPose(band: TapeBand, params: TapeLiftParams, random: () => number) {
  const amount = Math.max(0, Math.min(100, params.relay)) / 100
  if (amount <= 0) return null
  const side = random() < 0.5 ? -1 : 1
  const across = band.width * (0.3 + amount * 1.1) * side
  const along = band.length * (random() - 0.5) * 0.14 * amount
  return {
    center: {
      x: band.center.x + band.normal.x * across + band.dir.x * along,
      y: band.center.y + band.normal.y * across + band.dir.y * along,
    },
    angle: (Math.atan2(band.dir.y, band.dir.x) * 180) / Math.PI + (random() - 0.5) * 14 * amount,
    mirrored: params.mirror >= 0.5,
  }
}

export function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(1e-6, edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Smooth value noise 0–1 with features about `cell` px across. */
export function valueNoise(width: number, height: number, cell: number, random: () => number): Float32Array {
  const cols = Math.max(2, Math.ceil(width / cell) + 2)
  const rows = Math.max(2, Math.ceil(height / cell) + 2)
  const grid = new Float32Array(cols * rows)
  for (let i = 0; i < grid.length; i++) grid[i] = random()
  const out = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    const gy = y / cell
    const y0 = Math.floor(gy)
    const fy = gy - y0
    const sy = fy * fy * (3 - 2 * fy)
    for (let x = 0; x < width; x++) {
      const gx = x / cell
      const x0 = Math.floor(gx)
      const fx = gx - x0
      const sx = fx * fx * (3 - 2 * fx)
      const a = grid[y0 * cols + x0]
      const b = grid[y0 * cols + x0 + 1]
      const c = grid[(y0 + 1) * cols + x0]
      const d = grid[(y0 + 1) * cols + x0 + 1]
      out[y * width + x] = a + (b - a) * sx + (c - a + (a - b + d - c) * sx) * sy
    }
  }
  return out
}

/**
 * How hard each spot of the tape was rubbed, 0–1, on a tape raster of
 * width (along the tape) × height (across it). A thumbnail works in short
 * strokes across the strip; the end you start peeling from lets go more
 * easily; the factory edges always grip.
 */
export function pressureField(width: number, height: number, params: TapeLiftParams, random: () => number): Float32Array {
  const pressure = Math.max(0, Math.min(100, params.pressure)) / 100
  const step = 4
  const cols = Math.ceil(width / step) + 1
  const rows = Math.ceil(height / step) + 1
  const strokes = Array.from({ length: Math.min(48, Math.round(4 + (width / Math.max(1, height)) * 2.5)) }, () => {
    const angle = Math.PI / 2 + (random() - 0.5) * 1.2
    return {
      u: random() * width,
      v: random() * height,
      cos: Math.cos(angle),
      sin: Math.sin(angle),
      length: height * (0.7 + random() * 0.9),
      thick: height * (0.1 + random() * 0.2),
      weight: 0.5 + random() * 0.5,
    }
  })
  const peelFromStart = random() < 0.5
  const coarse = new Float32Array(cols * rows)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u = c * step
      const v = r * step
      let untouched = 1
      for (const stroke of strokes) {
        const du = u - stroke.u
        const dv = v - stroke.v
        const along = du * stroke.cos + dv * stroke.sin
        const across = -du * stroke.sin + dv * stroke.cos
        const g = Math.exp(-(along * along) / (stroke.length * stroke.length) - (across * across) / (stroke.thick * stroke.thick))
        untouched *= 1 - stroke.weight * g
      }
      const rubbed = 1 - untouched
      const progress = Math.min(1, u / Math.max(1, width))
      const peel = 1 - 0.3 * (peelFromStart ? progress : 1 - progress)
      const edge = Math.min(v, height - v) < height * 0.05 ? 0.18 : 0
      coarse[r * cols + c] = Math.max(0, Math.min(1, pressure * (0.25 + 0.95 * rubbed) * peel + edge * pressure))
    }
  }
  const out = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    const gy = y / step
    const r0 = Math.min(rows - 2, Math.floor(gy))
    const fy = gy - r0
    for (let x = 0; x < width; x++) {
      const gx = x / step
      const c0 = Math.min(cols - 2, Math.floor(gx))
      const fx = gx - c0
      const a = coarse[r0 * cols + c0]
      const b = coarse[r0 * cols + c0 + 1]
      const c = coarse[(r0 + 1) * cols + c0]
      const d = coarse[(r0 + 1) * cols + c0 + 1]
      out[y * width + x] = a + (b - a) * fx + (c - a + (a - b + d - c) * fx) * fy
    }
  }
  return out
}

/**
 * How readily each spot of toner lets go, 0–1, at three physical scales:
 * thumb-sized zones where the tape bedded down well or didn't, toner clumps a
 * millimetre or so across, and paper fibres that make every boundary ragged.
 * `pxPerMm` is the raster's resolution, so the texture has a real size
 * whatever the layer's scale.
 */
export function releaseField(width: number, height: number, pxPerMm: number, random: () => number): Float32Array {
  const mm = Math.max(0.3, pxPerMm)
  const zones = valueNoise(width, height, Math.max(6, 7 * mm), random)
  const clumps = valueNoise(width, height, Math.max(2, 1.1 * mm), random)
  const field = valueNoise(width, height, Math.max(1.5, 0.35 * mm), random)
  // Fibres: short strands at every angle, each holding or releasing as one.
  const fibreLength = Math.max(3, 0.9 * mm)
  const count = Math.round((width * height) / Math.max(4, fibreLength * fibreLength * 1.2))
  for (let fibre = 0; fibre < count; fibre++) {
    const x = random() * width
    const y = random() * height
    const angle = random() * Math.PI
    const length = fibreLength * (0.6 + random() * 0.8)
    const value = random()
    const steps = Math.max(1, Math.round(length))
    for (let s = 0; s < steps; s++) {
      const px = Math.round(x + Math.cos(angle) * (s - steps / 2))
      const py = Math.round(y + Math.sin(angle) * (s - steps / 2))
      if (px < 0 || py < 0 || px >= width || py >= height) continue
      const i = py * width + px
      field[i] = field[i] * 0.4 + value * 0.6
    }
  }
  for (let i = 0; i < field.length; i++) {
    // Zones decide where, clumps shape the patches, fibres fray their edges.
    field[i] = 0.08 + (zones[i] - 0.5) * 1.15 + (clumps[i] - 0.5) * 0.55 + (field[i] - 0.5) * 0.3 + 0.42
  }
  return field
}

/**
 * From pressure and release: how much ink each spot gave up (lift) and where
 * the paper's skin tore away with the tape (tear — those spots lift fully).
 */
export function liftMaps(
  pressure: Float32Array,
  release: Float32Array,
  width: number,
  height: number,
  params: TapeLiftParams,
  random: () => number,
): { lift: Float32Array; tear: Float32Array } {
  const lift = new Float32Array(width * height)
  const tear = new Float32Array(width * height)
  const tearAmount = Math.max(0, Math.min(100, params.tear)) / 100
  const patches = tearAmount > 0 ? valueNoise(width, height, Math.max(4, height * 0.16), random) : null
  // Masking tape is paper itself: it grips toner less than clear film does.
  const grip = params.tape >= 0.5 ? 0.78 : 1
  for (let i = 0; i < lift.length; i++) {
    const p = pressure[i] * grip
    const threshold = 1 - p
    // Toner either holds or lets go: a narrow band where it half-transfers.
    let l = smoothstep(threshold - 0.06, threshold + 0.06, release[i])
    if (patches) {
      const t = 1 - tearAmount * 0.5 * pressure[i]
      const torn = smoothstep(t, t + 0.04, patches[i] * 0.8 + release[i] * 0.2)
      tear[i] = torn
      l = Math.max(l, torn)
    }
    lift[i] = l
  }
  return { lift, tear }
}

/** Seeded random for a tape lift, kept separate from other treatments' streams. */
export function tapeLiftRandom(seed: number) {
  return createSeededRandom((seed ^ 0x7a9e1b33) >>> 0)
}
