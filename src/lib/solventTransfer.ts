/**
 * Solvent & tape-transfer xerox engine.
 *
 * Models the physical artifacts of 1990s Ray Gun / David Carson paste-up and
 * solvent-rubbed photocopies:
 * - localized ink pools (blot): discrete solvent/ink blotches anchored on real
 *   strokes that swell and fuse 1–3 letters into dense jagged black masses while
 *   neighboring letters stay crisp and slim
 * - rubbed-toner smear (smear): combed, fibrous dry-brush striations dragged
 *   along the rub/tape axis from pooled ink and tape strips, breaking up into
 *   gritty stippled filaments
 * - paste-up tape seams & fold creases (seams): razor-straight strip boundaries
 *   and cross-sheet fold seams with asymmetric feathered toner shadows, seam-edge
 *   ink pooling, sharp smear cutoffs, and crinkled diagonal tape-wrinkle hairlines
 * - scanner debris (debris): irregular torn toner flakes, angular lint chunks,
 *   and directional margin scuffs
 * - high-contrast xerox bite: crushes intermediate smudges and seam shadows into
 *   crisp black-and-white paper-tooth stipple instead of soft digital gray fog
 *
 * Pure, deterministic, seeded, DPI-scaled (`pixelScale`), and headless-testable.
 */
import { inkDistanceField, strokeHalfWidth } from './inkBleed'
import type { SheetPatch } from './press'

export type SolventTransferParams = {
  /** Localized ink pools / solvent obliterations anchored on strokes, 0–100. */
  blot: number
  /** Directional combed dry-brush rubbed-toner smear along the rub axis, 0–100. */
  smear: number
  /** Paste-up tape strip seams, cross-sheet fold creases, and wrinkle hairlines, 0–100. */
  seams: number
  /** Organic scanner-glass debris flakes, lint chunks, and margin dust, 0–100. */
  debris: number
  /** Rub / tape strip axis in degrees (0 = horizontal strips, 90 = vertical strips). */
  dragAngle: number
}

export const SOLVENT_TRANSFER_DEFAULTS: SolventTransferParams = {
  blot: 0,
  smear: 0,
  seams: 0,
  debris: 0,
  dragAngle: 0,
}

const MAX_PARAM = 200

function unit(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(MAX_PARAM, value)) / 100
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(1e-6, edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function clamp01(value: number): number {
  return value <= 0 ? 0 : value >= 1 ? 1 : value
}

/** True when no solvent-transfer stage is active — draws zero random numbers. */
export function solventTransferIsIdle(params: Partial<SolventTransferParams>): boolean {
  return (
    unit(params.blot) < 0.005 &&
    unit(params.smear) < 0.005 &&
    unit(params.seams) < 0.005 &&
    unit(params.debris) < 0.005
  )
}

/** Smooth seeded value noise in -1..1 with independent x/y cell sizes. */
function valueNoise2d(
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

  const colIdx = new Int32Array(width)
  const colW = new Float32Array(width)
  for (let x = 0; x < width; x++) {
    const gx = x / cx
    const x0 = Math.floor(gx)
    const tx = gx - x0
    colIdx[x] = x0
    colW[x] = tx * tx * (3 - 2 * tx)
  }

  const out = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    const gy = y / cy
    const y0 = Math.floor(gy)
    const ty = gy - y0
    const fy = ty * ty * (3 - 2 * ty)
    const top = y0 * cols
    const bot = top + cols
    const row = y * width
    for (let x = 0; x < width; x++) {
      const c = colIdx[x]
      const fx = colW[x]
      const a = grid[top + c] + (grid[top + c + 1] - grid[top + c]) * fx
      const b = grid[bot + c] + (grid[bot + c + 1] - grid[bot + c]) * fx
      out[row + x] = a + (b - a) * fy
    }
  }
  return out
}

function fractalNoise2d(
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
  for (let o = 0; o < octaves; o++) {
    const scale = 2 ** o
    const layer = valueNoise2d(width, height, cellX / scale, cellY / scale, random)
    for (let i = 0; i < out.length; i++) out[i] += layer[i] * weight
    total += weight
    weight *= 0.5
  }
  const gain = 1.65 / total
  for (let i = 0; i < out.length; i++) out[i] = Math.max(-1, Math.min(1, out[i] * gain))
  return out
}

function noise1d(length: number, cell: number, random: () => number): Float32Array {
  const c = Math.max(1, cell)
  const knots = Math.ceil(length / c) + 3
  const grid = new Float32Array(knots)
  for (let i = 0; i < knots; i++) grid[i] = random() * 2 - 1
  const out = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const g = i / c
    const k = Math.floor(g)
    const t = g - k
    const f = t * t * (3 - 2 * t)
    out[i] = grid[k] + (grid[k + 1] - grid[k]) * f
  }
  return out
}

/** Fast 2-pass separable box blur for local surface tension rounding. */
function fastBoxBlur(plane: Float32Array, width: number, height: number, radius: number): Float32Array {
  const r = Math.round(radius)
  if (r < 1) return plane
  const temp = new Float32Array(plane.length)
  const out = new Float32Array(plane.length)
  const span = 2 * r + 1
  const lastX = width - 1
  const lastY = height - 1

  const passH = (src: Float32Array, dst: Float32Array) => {
    for (let y = 0; y < height; y++) {
      const base = y * width
      let sum = src[base] * (r + 1)
      for (let i = 1; i <= r; i++) sum += src[base + Math.min(i, lastX)]
      for (let x = 0; x < width; x++) {
        dst[base + x] = sum / span
        const add = x + r + 1
        const drop = x - r
        sum += src[base + (add > lastX ? lastX : add)] - src[base + (drop < 0 ? 0 : drop)]
      }
    }
  }
  const passV = (src: Float32Array, dst: Float32Array) => {
    const sums = new Float64Array(width)
    for (let x = 0; x < width; x++) sums[x] = src[x] * (r + 1)
    for (let i = 1; i <= r; i++) {
      const row = Math.min(i, lastY) * width
      for (let x = 0; x < width; x++) sums[x] += src[row + x]
    }
    for (let y = 0; y < height; y++) {
      const row = y * width
      const add = Math.min(y + r + 1, lastY) * width
      const drop = Math.max(y - r, 0) * width
      for (let x = 0; x < width; x++) {
        dst[row + x] = sums[x] / span
        sums[x] += src[add + x] - src[drop + x]
      }
    }
  }
  passH(plane, temp)
  passV(temp, out)
  passH(out, temp)
  passV(temp, out)
  return out
}

type InkBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  hasInk: boolean
}

function measureInkBounds(ink: Float32Array, width: number, height: number): InkBounds {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) {
      if (ink[row + x] >= 0.4) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  return { minX, minY, maxX, maxY, hasInk: maxX >= minX && maxY >= minY }
}

type AxisBasis = {
  /** Along rub / tape-strip direction. */
  ux: number
  uy: number
  /** Across rub / tape-strip direction (90° CCW from u). */
  nx: number
  ny: number
  /** True when rub runs mostly along X (rows). */
  alongX: boolean
  /** +1 or -1 primary drag sign along the dominant axis. */
  sign: 1 | -1
}

function rubBasis(dragAngle: number): AxisBasis {
  const rad = (dragAngle * Math.PI) / 180
  const ux = Math.cos(rad)
  const uy = Math.sin(rad)
  const alongX = Math.abs(ux) >= Math.abs(uy)
  return {
    ux,
    uy,
    nx: -uy,
    ny: ux,
    alongX,
    sign: (alongX ? ux : uy) >= 0 ? 1 : -1,
  }
}

type BlotHotspot = {
  cx: number
  cy: number
  /** Radius along rub axis. */
  rAlong: number
  /** Radius across rub axis. */
  rAcross: number
  strength: number
  lobes: [number, number, number]
}

/**
 * Pick discrete ink-pool epicenters anchored on actual ink pixels, spaced out
 * so a few clusters flood into dense obliterated masses while surrounding
 * letters stay crisp and slim.
 */
function pickBlotHotspots(
  ink: Float32Array,
  width: number,
  height: number,
  stroke: number,
  blotStrength: number,
  random: () => number,
): BlotHotspot[] {
  const step = Math.max(4, Math.round(stroke * 2))
  const candidates: number[] = []
  for (let y = step; y < height - step; y += step) {
    const row = y * width
    for (let x = step; x < width - step; x += step) {
      if (ink[row + x] >= 0.65) candidates.push(row + x)
    }
  }
  if (candidates.length === 0) return []

  const clamped = Math.min(1.5, blotStrength)
  const targetCount = Math.max(3, Math.round(2.5 + clamped * 6.5))
  const minDist = Math.max(stroke * 14, Math.min(width, height) * 0.11)
  const spots: BlotHotspot[] = []
  const maxAttempts = targetCount * 28

  for (let attempt = 0; attempt < maxAttempts && spots.length < targetCount; attempt++) {
    const pick = candidates[Math.floor(random() * candidates.length)]
    const cx = pick % width
    const cy = (pick - cx) / width
    let tooClose = false
    for (const other of spots) {
      if (Math.hypot(cx - other.cx, cy - other.cy) < minDist * (0.72 + random() * 0.48)) {
        tooClose = true
        break
      }
    }
    if (tooClose) continue

    // First 2–3 hotspots are heavy "obliteration" pools spanning 1.5–3 full letters
    // (like RAY, YD, L); the rest are medium localized floods (like G58, EG, BY).
    const isHero = spots.length < Math.max(2, Math.round(targetCount * 0.36))
    const amp = 0.65 + 0.5 * clamped
    const rAlong = stroke * (isHero ? 11 + random() * 11 : 6 + random() * 6.5) * amp
    const rAcross = stroke * (isHero ? 6.5 + random() * 4.5 : 4.2 + random() * 3.5) * amp
    spots.push({
      cx,
      cy,
      rAlong,
      rAcross,
      strength: (isHero ? 0.95 + random() * 0.25 : 0.62 + random() * 0.32) * clamped,
      lobes: [random() * Math.PI * 2, random() * Math.PI * 2, random() * Math.PI * 2],
    })
  }
  return spots
}

type StripSeam = {
  /** Position along the across-axis (v). */
  vPos: number
  /** Span along the rub axis (u). */
  uStart: number
  uEnd: number
  /** +1 or -1: which side of the tape edge carries the feathered adhesive shadow. */
  shadowSide: 1 | -1
  shadowWidth: number
  darkness: number
  /** Sharp cutoff barrier strength for rubbed smears. */
  barrier: number
}

type CrossSeam = {
  /** Position along the rub axis (u). */
  uPos: number
  shadowSide: 1 | -1
  shadowWidth: number
  darkness: number
  /** How heavily ink pools against the seam ridge. */
  poolBoost: number
}

type WrinkleLine = {
  x0: number
  y0: number
  x1: number
  y1: number
  width: number
  darkness: number
}

function drawWrinkleLine(
  plane: Float32Array,
  width: number,
  height: number,
  line: WrinkleLine,
  grain: Float32Array,
) {
  const dx = line.x1 - line.x0
  const dy = line.y1 - line.y0
  const len = Math.hypot(dx, dy)
  if (len < 2) return
  const steps = Math.ceil(len * 1.5)
  const r = Math.max(0.65, line.width)
  for (let s = 0; s <= steps; s++) {
    const t = s / steps
    const px = line.x0 + dx * t
    const py = line.y0 + dy * t
    const taper = Math.sin(t * Math.PI) ** 0.45
    const x0 = Math.max(0, Math.floor(px - r - 1))
    const x1 = Math.min(width - 1, Math.ceil(px + r + 1))
    const y0 = Math.max(0, Math.floor(py - r - 1))
    const y1 = Math.min(height - 1, Math.ceil(py + r + 1))
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + 0.5 - px, y + 0.5 - py)
        const cov = clamp01(r + 0.45 - d) * taper * line.darkness
        if (cov <= 0.02) continue
        const i = y * width + x
        const g = 0.78 + 0.34 * grain[i]
        plane[i] = Math.max(plane[i], clamp01(cov * g))
      }
    }
  }
}

/**
 * Draw crisp white micro-peel cracks biting through stroke edges (like toner
 * lifting off onto tape or cracking across a folded letter).
 */
function applyMicroPeelCracks(
  plane: Float32Array,
  ink: Float32Array,
  width: number,
  height: number,
  stroke: number,
  px: number,
  intensity: number,
  random: () => number,
) {
  const step = Math.max(4, Math.round(stroke * 2))
  const edgePixels: number[] = []
  for (let y = step; y < height - step; y += step) {
    const row = y * width
    for (let x = step; x < width - step; x += step) {
      const i = row + x
      if (ink[i] >= 0.7 && (ink[i - 2] < 0.3 || ink[i + 2] < 0.3 || ink[i - width * 2] < 0.3 || ink[i + width * 2] < 0.3)) {
        edgePixels.push(i)
      }
    }
  }
  if (edgePixels.length === 0) return

  const cracks = Math.max(2, Math.round(2 + intensity * 6))
  for (let c = 0; c < cracks; c++) {
    const start = edgePixels[Math.floor(random() * edgePixels.length)]
    let cx = start % width
    let cy = (start - cx) / width
    const angle = random() * Math.PI * 2
    const length = stroke * (1.5 + random() * 3.0)
    const halfW = (0.65 + random() * 1.1) * px
    const segs = Math.max(4, Math.ceil(length))
    let dir = angle
    for (let s = 0; s < segs; s++) {
      dir += (random() - 0.5) * 0.42
      cx += Math.cos(dir)
      cy += Math.sin(dir)
      const x0 = Math.max(0, Math.floor(cx - halfW - 1))
      const x1 = Math.min(width - 1, Math.ceil(cx + halfW + 1))
      const y0 = Math.max(0, Math.floor(cy - halfW - 1))
      const y1 = Math.min(height - 1, Math.ceil(cy + halfW + 1))
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
          const cut = clamp01(halfW + 0.4 - d)
          if (cut > 0) plane[y * width + x] *= 1 - cut * 0.94
        }
      }
    }
  }
}

/**
 * Stamp jagged irregular toner debris flakes, torn-lint chunks, and directional
 * margin scuff trails.
 */
function applyScannerDebris(
  plane: Float32Array,
  ink: Float32Array,
  width: number,
  height: number,
  bounds: InkBounds,
  basis: AxisBasis,
  px: number,
  debris: number,
  fibres: Float32Array,
  random: () => number,
) {
  const shortSide = Math.min(width, height)
  const strength = Math.min(1.5, debris)

  // 1. Irregular angular torn toner flakes / peeled lint chunks in the margins.
  const flakeCount = Math.max(4, Math.round(5 + strength * 13))
  for (let f = 0; f < flakeCount; f++) {
    let cx = random() * width
    let cy = random() * height
    for (let tries = 0; tries < 10; tries++) {
      const tx = (0.04 + random() * 0.92) * width
      const ty = (0.04 + random() * 0.92) * height
      const idx = Math.min(height - 1, Math.floor(ty)) * width + Math.min(width - 1, Math.floor(tx))
      const inMargin =
        !bounds.hasInk ||
        tx < bounds.minX - 10 * px ||
        tx > bounds.maxX + 10 * px ||
        ty < bounds.minY - 10 * px ||
        ty > bounds.maxY + 10 * px
      if (ink[idx] < 0.08 && (inMargin || tries > 6)) {
        cx = tx
        cy = ty
        break
      }
    }

    const isBig = f < Math.max(2, Math.round(flakeCount * 0.35))
    const rx = (isBig ? 0.008 + random() * 0.018 : 0.002 + random() * 0.006) * shortSide
    const ry = rx * (0.22 + random() * 0.45)
    const rot = random() * Math.PI * 2
    const ca = Math.cos(rot)
    const sa = Math.sin(rot)
    const p1 = random() * Math.PI * 2
    const p2 = random() * Math.PI * 2
    const p3 = random() * Math.PI * 2
    // Offset notch on some big flakes (torn angular shard, not a round ring).
    const notched = isBig && random() < 0.55
    const notchX = (random() < 0.5 ? -1 : 1) * rx * (0.45 + random() * 0.3)
    const notchY = (random() - 0.5) * ry * 0.8
    const notchR = rx * (0.35 + random() * 0.25)

    const reach = Math.max(rx, ry) * 1.7
    const x0 = Math.max(0, Math.floor(cx - reach))
    const x1 = Math.min(width - 1, Math.ceil(cx + reach))
    const y0 = Math.max(0, Math.floor(cy - reach))
    const y1 = Math.min(height - 1, Math.ceil(cy + reach))
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx
        const dy = y - cy
        const lx = dx * ca + dy * sa
        const ly = -dx * sa + dy * ca
        const theta = Math.atan2(ly, lx)
        const warp =
          1 +
          0.32 * Math.sin(theta * 2 + p1) +
          0.24 * Math.sin(theta * 3 + p2) +
          0.16 * Math.sin(theta * 5 + p3)
        const dist = Math.hypot(lx / Math.max(1, rx), ly / Math.max(1, ry))
        const i = y * width + x
        const edge = warp + fibres[i] * 0.28
        let cov = 1 - smoothstep(edge * 0.72, edge, dist)
        if (notched && cov > 0) {
          const nd = Math.hypot(lx - notchX, ly - notchY)
          cov *= smoothstep(notchR * 0.65, notchR * 1.1, nd)
        }
        if (cov > 0.02) plane[i] = Math.max(plane[i], cov * 0.98)
      }
    }

    // Companion jagged micro-shards right beside large debris flakes (no straight stick tails).
    if (isBig) {
      const chips = 1 + Math.floor(random() * 4)
      for (let ch = 0; ch < chips; ch++) {
        const ang = rot + (random() - 0.5) * 1.8
        const dist = rx * (0.9 + random() * 1.4)
        const sx = cx + Math.cos(ang) * dist
        const sy = cy + Math.sin(ang) * dist
        const sr = (0.9 + random() * 2.5) * px
        for (let yy = Math.max(0, Math.floor(sy - sr)); yy <= Math.min(height - 1, Math.ceil(sy + sr)); yy++) {
          for (let xx = Math.max(0, Math.floor(sx - sr)); xx <= Math.min(width - 1, Math.ceil(sx + sr)); xx++) {
            const cov = clamp01(sr + 0.3 - Math.hypot(xx - sx, yy - sy))
            if (cov > 0.05) plane[yy * width + xx] = Math.max(plane[yy * width + xx], cov * 0.92)
          }
        }
      }
    }
  }

  // 2. Directional scuff wisps (elongated linear dust trails, never round dots).
  const scuffCount = Math.max(3, Math.round(3 + strength * 8))
  for (let s = 0; s < scuffCount; s++) {
    const cx = (0.06 + random() * 0.88) * width
    const cy = (0.06 + random() * 0.88) * height
    const baseAngle = Math.atan2(basis.uy, basis.ux) + (random() < 0.65 ? 0 : (random() - 0.5) * 1.1)
    const ca = Math.cos(baseAngle)
    const sa = Math.sin(baseAngle)
    const len = (0.025 + random() * 0.06) * shortSide
    const wid = (0.004 + random() * 0.01) * shortSide
    const specks = Math.round(14 + strength * 24)
    for (let k = 0; k < specks; k++) {
      const lu = (random() - 0.5) * len * 2
      const lv = (random() - 0.5) * wid * 2
      const sx = Math.round(cx + lu * ca - lv * sa)
      const sy = Math.round(cy + lu * sa + lv * ca)
      if (sx < 1 || sy < 1 || sx >= width - 1 || sy >= height - 1) continue
      const sr = (0.45 + random() * 1.15) * px
      const weight = 0.52 + random() * 0.45
      for (let yy = Math.max(0, Math.floor(sy - sr)); yy <= Math.min(height - 1, Math.ceil(sy + sr)); yy++) {
        for (let xx = Math.max(0, Math.floor(sx - sr)); xx <= Math.min(width - 1, Math.ceil(sx + sr)); xx++) {
          const cov = clamp01(sr + 0.3 - Math.hypot(xx - sx, yy - sy)) * weight
          if (cov > 0) plane[yy * width + xx] = Math.max(plane[yy * width + xx], cov)
        }
      }
    }
  }
}

export type SolventTransferResult = {
  /** Ink coverage after solvent pooling, rubbed smear, tape seams, and debris (0..1). */
  ink: Float32Array
  /** 0..1 mask of heavily pooled/wet areas (suppresses regular halftone dots). */
  wet: Float32Array
}

/**
 * Apply the full solvent & tape-transfer physical pass to a coverage plane.
 */
export function applySolventTransfer(
  ink: Float32Array,
  width: number,
  height: number,
  params: Partial<SolventTransferParams>,
  random: () => number,
  pixelScale = 1,
  sheet?: SheetPatch,
): SolventTransferResult {
  const blot = unit(params.blot)
  const smear = unit(params.smear)
  const seams = unit(params.seams)
  const debris = unit(params.debris)
  const out = new Float32Array(ink)
  const wet = new Float32Array(ink.length)
  if (width < 2 || height < 2 || solventTransferIsIdle(params)) return { ink: out, wet }

  const px = Math.max(0.5, pixelScale)
  const angle = sheet ? sheet.press.feedAngle : (params.dragAngle ?? SOLVENT_TRANSFER_DEFAULTS.dragAngle)
  const basis = rubBasis(angle)
  const bounds = measureInkBounds(ink, width, height)
  const field = inkDistanceField(ink, width, height)
  const stroke = strokeHalfWidth(field.signed, width, height)

  // Shared organic paper & fibre noise planes.
  const lumps = valueNoise2d(width, height, Math.max(5, stroke * 2.4), Math.max(5, stroke * 2.4), random)
  const fibres = fractalNoise2d(width, height, 2.4 * px, 1.4 * px, 2, random)
  const microTooth = valueNoise2d(width, height, 1.15 * px, 1.15 * px, random)

  // Compute u/v span of the ink bounding box for placing strip and cross seams.
  const uCorners = bounds.hasInk
    ? [
        bounds.minX * basis.ux + bounds.minY * basis.uy,
        bounds.maxX * basis.ux + bounds.minY * basis.uy,
        bounds.minX * basis.ux + bounds.maxY * basis.uy,
        bounds.maxX * basis.ux + bounds.maxY * basis.uy,
      ]
    : [0, width * basis.ux + height * basis.uy]
  const vCorners = bounds.hasInk
    ? [
        bounds.minX * basis.nx + bounds.minY * basis.ny,
        bounds.maxX * basis.nx + bounds.minY * basis.ny,
        bounds.minX * basis.nx + bounds.maxY * basis.ny,
        bounds.maxX * basis.nx + bounds.maxY * basis.ny,
      ]
    : [0, width * basis.nx + height * basis.ny]
  const uMin = Math.min(...uCorners)
  const uMax = Math.max(...uCorners)
  const vMin = Math.min(...vCorners)
  const vMax = Math.max(...vCorners)
  const uSpan = Math.max(stroke * 6, uMax - uMin)
  const vSpan = Math.max(stroke * 6, vMax - vMin)

  // ── 1. Plan paste-up tape strip seams & cross-sheet fold seams ───────────
  const stripSeams: StripSeam[] = []
  const crossSeams: CrossSeam[] = []
  const wrinkles: WrinkleLine[] = []

  if (seams > 0.005 && bounds.hasInk) {
    const sAmt = Math.min(1.5, seams)
    // 3–6 razor-straight tape strip boundaries running along the rub axis.
    const stripCount = Math.max(2, Math.round(2 + sAmt * 3.8))
    for (let s = 0; s < stripCount; s++) {
      const frac = (s + 0.2 + random() * 0.55) / stripCount
      const vPos = vMin + frac * vSpan
      const margin = stroke * (3 + random() * 6)
      stripSeams.push({
        vPos,
        uStart: uMin - margin * random(),
        uEnd: uMax + margin * random(),
        shadowSide: random() < 0.5 ? 1 : -1,
        shadowWidth: (9 + random() * 18) * px * (0.65 + 0.45 * sAmt),
        darkness: (0.62 + random() * 0.34) * Math.min(1.2, sAmt),
        barrier: 0.78 + random() * 0.2,
      })
    }

    // 1–2 cross-sheet fold / paste-up join seams cutting across the whole frame.
    const crossCount = sAmt > 0.75 && random() < 0.4 ? 2 : 1
    for (let c = 0; c < crossCount; c++) {
      const frac = crossCount === 1 ? 0.28 + random() * 0.44 : (c === 0 ? 0.22 + random() * 0.2 : 0.6 + random() * 0.22)
      crossSeams.push({
        uPos: uMin + frac * uSpan,
        shadowSide: random() < 0.5 ? 1 : -1,
        shadowWidth: (14 + random() * 24) * px * (0.7 + 0.45 * sAmt),
        darkness: (0.72 + random() * 0.28) * Math.min(1.2, sAmt),
        poolBoost: (0.6 + random() * 0.4) * Math.min(1.2, sAmt),
      })
    }

    // Crinkled diagonal tape-wrinkle hairlines radiating from strip/cross seams.
    const wrinkleCount = Math.max(3, Math.round(3 + sAmt * 7))
    for (let w = 0; w < wrinkleCount; w++) {
      const strip = stripSeams[Math.floor(random() * stripSeams.length)]
      const uAnchor = strip.uStart + random() * (strip.uEnd - strip.uStart)
      const vAnchor = strip.vPos + (random() - 0.5) * stroke * 2.5
      const x0 = uAnchor * basis.ux + vAnchor * basis.nx
      const y0 = uAnchor * basis.uy + vAnchor * basis.ny
      const baseAngle = Math.atan2(basis.uy, basis.ux)
      const delta = (random() < 0.5 ? 1 : -1) * (0.18 + random() * 0.52)
      const dir = baseAngle + delta + (random() < 0.5 ? 0 : Math.PI)
      const len = stroke * (6 + random() * 14)
      wrinkles.push({
        x0,
        y0,
        x1: x0 + Math.cos(dir) * len,
        y1: y0 + Math.sin(dir) * len,
        width: (0.65 + random() * 0.65) * px,
        darkness: (0.78 + random() * 0.22) * Math.min(1.2, sAmt),
      })
    }
  }

  // ── 2. Localized solvent ink pools (blot) ────────────────────────────────
  const blotMap = new Float32Array(ink.length)
  if (blot > 0.005 && bounds.hasInk) {
    const hotspots = pickBlotHotspots(ink, width, height, stroke, blot, random)
    for (const h of hotspots) {
      const bound = Math.max(h.rAlong, h.rAcross) * 1.7
      const x0 = Math.max(0, Math.floor(h.cx - bound))
      const x1 = Math.min(width - 1, Math.ceil(h.cx + bound))
      const y0 = Math.max(0, Math.floor(h.cy - bound))
      const y1 = Math.min(height - 1, Math.ceil(h.cy + bound))
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x - h.cx
          const dy = y - h.cy
          const du = dx * basis.ux + dy * basis.uy
          const dv = dx * basis.nx + dy * basis.ny
          const theta = Math.atan2(dv, du)
          const lobe =
            1 +
            0.24 * Math.sin(theta * 2 + h.lobes[0]) +
            0.16 * Math.sin(theta * 3 + h.lobes[1]) +
            0.1 * Math.sin(theta * 5 + h.lobes[2])
          const dist = Math.hypot(du / Math.max(1, h.rAlong), dv / Math.max(1, h.rAcross))
          const i = y * width + x
          const perturbed = dist / Math.max(0.35, lobe + lumps[i] * 0.3)
          const falloff = 1 - smoothstep(0.35, 1.0, perturbed)
          if (falloff > 0) {
            const val = clamp01(falloff * h.strength)
            if (val > blotMap[i]) blotMap[i] = val
          }
        }
      }
    }
  }

  // Cross-seam ink catch: wet ink pools right up against a fold/paste seam at
  // 1–2 discrete spots where it crosses strokes (like GROHL and TERRYDOY- in
  // the reference), while other columns pass cleanly through the seam.
  if (crossSeams.length > 0 && bounds.hasInk) {
    for (const cs of crossSeams) {
      const band = stroke * 4.2 + cs.shadowWidth * 0.8
      const catchCount = 1 + (random() < 0.55 ? 1 : 0)
      const catchSpots = Array.from({ length: catchCount }, () => ({
        vCenter: vMin + (0.12 + random() * 0.76) * vSpan,
        vHalf: Math.max(stroke * 6, vSpan * (0.09 + random() * 0.11)),
      }))
      for (let y = 0; y < height; y++) {
        const row = y * width
        for (let x = 0; x < width; x++) {
          const u = x * basis.ux + y * basis.uy
          const signedU = (u - cs.uPos) * cs.shadowSide
          if (signedU < -stroke * 0.35 || signedU > band) continue
          const i = row + x
          if (field.signed[i] > stroke * 3.8) continue
          const v = x * basis.nx + y * basis.ny
          let spotWeight = 0
          for (const spot of catchSpots) {
            const w = 1 - smoothstep(spot.vHalf * 0.25, spot.vHalf, Math.abs(v - spot.vCenter))
            if (w > spotWeight) spotWeight = w
          }
          if (spotWeight <= 0.02) continue
          const alongFade = 1 - smoothstep(0, band, Math.max(0, signedU))
          const backCut = smoothstep(-stroke * 0.35, 0.6 * px, signedU)
          const noiseMod = smoothstep(-0.2, 0.55, lumps[i])
          const boost = alongFade * backCut * spotWeight * cs.poolBoost * (0.5 + 0.5 * noiseMod)
          if (boost > blotMap[i]) blotMap[i] = clamp01(boost)
        }
      }
    }
  }

  // Apply localized flooding from blotMap while keeping clean strokes razor-crisp.
  const cover = (inside: number) => (inside <= -0.5 ? 0 : inside >= 0.5 ? 1 : inside + 0.5)
  const cleanEdgeRough = (0.32 + 0.38 * Math.min(1, blot + smear * 0.5)) * px
  const maxPoolReach = stroke * (2.6 + Math.min(1.5, blot) * 4.2)

  for (let i = 0; i < ink.length; i++) {
    const b = blotMap[i]
    const sd = field.signed[i]
    if (b > 0.03) {
      const spread = b * maxPoolReach
      const wander = lumps[i] * spread * 0.34 + fibres[i] * (1.0 * px + spread * 0.2)
      const flooded = cover(spread + wander - sd)
      out[i] = Math.max(out[i], flooded)
      wet[i] = Math.max(wet[i], smoothstep(0.06, 0.38, b))
    } else if (sd < 2.5 * px && sd > -2.5 * px) {
      // Crisp micro-roughness on clean strokes (photocopy tooth without bloating!).
      const jitter = fibres[i] * cleanEdgeRough + microTooth[i] * 0.28 * px
      out[i] = cover(jitter - sd)
    }
  }

  // Local surface-tension pooling ONLY inside flooded blotches so counters fuse
  // smoothly into organic black masses without puffing up clean letters.
  if (blot > 0.01 || crossSeams.length > 0) {
    const blurRadius = Math.max(2, Math.min(18, stroke * 0.65))
    const softened = fastBoxBlur(out, width, height, blurRadius)
    for (let i = 0; i < out.length; i++) {
      const w = wet[i]
      if (w <= 0.01) continue
      const pooled = smoothstep(0.32, 0.52, softened[i])
      out[i] = out[i] + (Math.max(pooled, ink[i]) - out[i]) * w * 0.92
    }
  }

  // Subtle corner rounding on clean strokes (optical photocopy softening).
  if (blot > 0.05 || smear > 0.05) {
    const micro = fastBoxBlur(out, width, height, Math.max(1, Math.round(0.8 * px)))
    for (let i = 0; i < out.length; i++) {
      if (wet[i] > 0.2) continue
      const rounded = smoothstep(0.42, 0.62, micro[i])
      out[i] = out[i] * 0.45 + rounded * 0.55
    }
  }

  // Micro-peel white cracks biting into a few stroke edges (like G and JIMM-).
  if (blot > 0.15 || seams > 0.15) {
    applyMicroPeelCracks(out, ink, width, height, stroke, px, Math.max(blot, seams), random)
  }

  // ── 3. Combed dry-brush / rubbed-toner smear (smear) ─────────────────────
  if (smear > 0.005 && bounds.hasInk) {
    const smearAmt = Math.min(1.5, smear)
    const alongX = basis.alongX
    const lines = alongX ? height : width
    const length = alongX ? width : height
    const maxTail = smearAmt * (stroke * 18 + 30 * px)

    // High-frequency across-axis combed filament mask (1–3px parallel fibers).
    const combFine = noise1d(lines, Math.max(1, 1.35 * px), random)
    const combMed = noise1d(lines, Math.max(2, 4.5 * px), random)
    const combBroad = noise1d(lines, Math.max(5, 16 * px), random)

    // Along-axis dry-brush flicker so streaks break into fibrous stippled dashes.
    const dryBreak = fractalNoise2d(
      width,
      height,
      alongX ? 16 * px : 2.2 * px,
      alongX ? 2.2 * px : 16 * px,
      2,
      random,
    )

    // Zone map for where tape strips sit: ink sitting inside a rubbed tape strip
    // drags combed striations even between clean letters (like SROBE- / PAGEINTERVI-).
    const stripRubZone = new Float32Array(ink.length)
    const seamCutLine = new Float32Array(lines)
    if (stripSeams.length > 0) {
      for (const strip of stripSeams) {
        const approxLine = Math.round(
          alongX
            ? strip.vPos / (Math.abs(basis.ny) > 0.2 ? basis.ny : 1)
            : strip.vPos / (Math.abs(basis.nx) > 0.2 ? basis.nx : 1),
        )
        for (let k = -2; k <= 2; k++) {
          const idx = approxLine + k
          if (idx >= 0 && idx < lines) seamCutLine[idx] = Math.max(seamCutLine[idx], strip.barrier)
        }
        const rubBand = Math.max(stroke * 6, strip.shadowWidth * 1.9)
        for (let y = 0; y < height; y++) {
          const row = y * width
          for (let x = 0; x < width; x++) {
            const u = x * basis.ux + y * basis.uy
            if (u < strip.uStart || u > strip.uEnd) continue
            const v = x * basis.nx + y * basis.ny
            const dv = (v - strip.vPos) * strip.shadowSide
            if (dv < 0 || dv > rubBand) continue
            const z = (1 - smoothstep(0, rubBand, dv)) * 0.72
            const i = row + x
            if (z > stripRubZone[i]) stripRubZone[i] = z
          }
        }
      }
    }

    // Two opposing passes: primary rub direction (long) + back-rub (medium).
    const smeared = new Float32Array(out)
    const runPass = (dirSign: 1 | -1, reachScale: number) => {
      for (let line = 0; line < lines; line++) {
        const c = clamp01(0.48 + 0.34 * combFine[line] + 0.26 * combMed[line] + 0.16 * combBroad[line])
        const filament = c ** 1.65
        if (filament < 0.05) continue
        const tail = maxTail * reachScale * (0.18 + 0.82 * filament)
        const decay = Math.exp(-1 / Math.max(1.0, tail))
        let carried = 0

        for (let step = 0; step < length; step++) {
          const s = dirSign > 0 ? step : length - 1 - step
          const x = alongX ? s : line
          const y = alongX ? line : s
          const i = y * width + x
          const src = out[i]

          // Cross-seam razor cutoff: rubbing across a fold seam dumps carried toner.
          if (crossSeams.length > 0 && carried > 0.02) {
            const u = x * basis.ux + y * basis.uy
            for (const cs of crossSeams) {
              if (Math.abs(u - cs.uPos) < 1.2 * px) carried *= 0.12
            }
          }

          if (carried > smeared[i]) {
            const grit = smoothstep(-0.4, 0.22, dryBreak[i] + microTooth[i] * 0.35)
            // Keep peak filament strength punchy so it clears the 1-bit stipple threshold!
            const deposited = carried * (0.45 + 0.55 * grit) * (0.68 + 0.32 * filament)
            if (deposited > smeared[i]) smeared[i] = deposited
          }

          // Pooled ink and tape-rubbed strips feed rich dry-brush streaks; clean dry letters barely smear.
          const load = Math.max(blotMap[i] * 1.15, stripRubZone[i] * 0.92, 0.06)
          const feed = Math.min(1, src * load * (0.72 + 0.38 * filament))
          carried = Math.max(carried * decay, feed)
        }
      }
    }

    runPass(basis.sign, 1.0)
    runPass((basis.sign > 0 ? -1 : 1) as 1 | -1, 0.52)

    // Short cross-rub smear across narrow line gaps inside pooled blobs, clipped sharply at tape edges!
    const crossLines = alongX ? width : height
    const crossLen = alongX ? height : width
    const crossReach = smearAmt * (stroke * 3.8 + 8 * px)
    const crossComb = noise1d(crossLines, Math.max(1, 1.6 * px), random)
    for (let cl = 0; cl < crossLines; cl++) {
      const f = clamp01(0.45 + 0.55 * crossComb[cl])
      const decay = Math.exp(-1 / Math.max(0.9, crossReach * f))
      let carryFwd = 0
      for (let s = 0; s < crossLen; s++) {
        const x = alongX ? cl : s
        const y = alongX ? s : cl
        const i = y * width + x
        if (seamCutLine[s] > 0.5) carryFwd *= 0.04
        if (carryFwd > smeared[i]) {
          const grit = smoothstep(-0.32, 0.28, dryBreak[i])
          smeared[i] = Math.max(smeared[i], carryFwd * (0.48 + 0.52 * grit))
        }
        carryFwd = Math.max(carryFwd * decay, Math.min(1, out[i] * Math.max(blotMap[i] * 0.95, stripRubZone[i] * 0.55)))
      }
      let carryBack = 0
      for (let s = crossLen - 1; s >= 0; s--) {
        const x = alongX ? cl : s
        const y = alongX ? s : cl
        const i = y * width + x
        if (seamCutLine[s] > 0.5) carryBack *= 0.04
        if (carryBack > smeared[i]) {
          const grit = smoothstep(-0.32, 0.28, dryBreak[i])
          smeared[i] = Math.max(smeared[i], carryBack * (0.48 + 0.52 * grit))
        }
        carryBack = Math.max(carryBack * decay, Math.min(1, out[i] * Math.max(blotMap[i] * 0.95, stripRubZone[i] * 0.55)))
      }
    }

    for (let i = 0; i < out.length; i++) out[i] = Math.max(out[i], smeared[i])
  }

  // ── 4. Render tape strip seams, cross fold seams & wrinkle hairlines ─────
  if (seams > 0.005) {
    // Tape strip edges: razor-sharp line + asymmetric combed adhesive dust band.
    for (const strip of stripSeams) {
      const alongLen = Math.max(8, Math.ceil(strip.uEnd - strip.uStart))
      const alongVar = noise1d(alongLen + 4, Math.max(8, stroke * 3.5), random)
      const band = strip.shadowWidth
      for (let y = 0; y < height; y++) {
        const row = y * width
        for (let x = 0; x < width; x++) {
          const u = x * basis.ux + y * basis.uy
          if (u < strip.uStart || u > strip.uEnd) continue
          const v = x * basis.nx + y * basis.ny
          const dv = (v - strip.vPos) * strip.shadowSide
          if (dv < -1.4 * px || dv > band) continue
          const i = row + x
          const uIdx = Math.max(0, Math.min(alongVar.length - 1, Math.floor(u - strip.uStart)))
          const proximity = 1 - smoothstep(stroke * 1.5, stroke * 12, field.signed[i])
          const modulate = clamp01(0.32 + 0.68 * proximity) * (0.45 + 0.55 * clamp01(0.5 + 0.5 * alongVar[uIdx]))
          if (modulate < 0.05) continue

          const edgeLine = Math.exp(-((dv / (0.72 * px)) ** 2)) * 0.9
          const feather = dv >= 0 ? (1 - smoothstep(0, band, dv)) ** 1.55 : 0
          const tooth = smoothstep(-0.28, 0.36, fibres[i] * 0.65 + microTooth[i] * 0.45)
          const mark = Math.max(edgeLine * (0.55 + 0.45 * tooth), feather * (0.45 + 0.55 * tooth) * 0.9) * strip.darkness * modulate
          if (mark > 0.02) out[i] = Math.max(out[i], mark)

          // Razor-sharp cutoff on the non-shadow side of the tape edge (clears smudge bleed!).
          if (dv < -0.15 * px && dv > -1.4 * px && ink[i] < 0.45) {
            out[i] *= 1 - strip.barrier * 0.78
          }
        }
      }
    }

    // Cross-sheet fold / paste-up join seams (full span across the sheet!).
    for (const cs of crossSeams) {
      const crossSpan = Math.ceil(Math.hypot(width, height)) + 4
      const alongVar = noise1d(crossSpan, Math.max(10, stroke * 4.5), random)
      const band = cs.shadowWidth
      for (let y = 0; y < height; y++) {
        const row = y * width
        for (let x = 0; x < width; x++) {
          const u = x * basis.ux + y * basis.uy
          const du = (u - cs.uPos) * cs.shadowSide
          if (du < -1.5 * px || du > band) continue
          const v = x * basis.nx + y * basis.ny
          const vIdx = Math.max(0, Math.min(alongVar.length - 1, Math.floor(v + crossSpan * 0.5)))
          const i = row + x
          const proximity = 1 - smoothstep(stroke * 2, stroke * 16, field.signed[i])
          const presence = (0.24 + 0.76 * proximity) * (0.45 + 0.55 * clamp01(0.5 + 0.5 * alongVar[vIdx]))

          const ridge = Math.exp(-((du / (0.65 * px)) ** 2)) * 0.92
          const feather = du >= 0 ? (1 - smoothstep(0, band, du)) ** 1.45 : 0
          const grit = smoothstep(-0.32, 0.34, fibres[i] * 0.6 + microTooth[i] * 0.5)
          const shadow = Math.max(ridge * (0.5 + 0.5 * grit), feather * (0.42 + 0.58 * grit) * 0.92) * cs.darkness * presence
          if (shadow > 0.02) out[i] = Math.max(out[i], shadow)

          // Crisp paper-gap right on the opposite edge of the cut.
          if (du < -0.2 * px && du > -1.3 * px && ink[i] < 0.6) {
            out[i] *= 0.18
          }
        }
      }
    }

    // Crinkled diagonal tape-wrinkle hairlines.
    for (const line of wrinkles) drawWrinkleLine(out, width, height, line, microTooth)
  }

  // ── 5. Organic scanner-glass debris, torn toner flakes & scuff dust ──────
  if (debris > 0.005) {
    applyScannerDebris(out, ink, width, height, bounds, basis, px, debris, fibres, random)
  }

  // ── 6. High-contrast 1-bit xerox stipple bite ────────────────────────────
  // Crush soft mid-gray smudges, seam shadows, and frayed blotch edges into
  // crisp organic black-and-white stipple grains — zero soft digital alpha fog!
  for (let i = 0; i < out.length; i++) {
    const v = out[i]
    if (v <= 0.025) {
      out[i] = 0
      continue
    }
    if (v >= 0.9) {
      out[i] = 1
      wet[i] = 1
      continue
    }
    // Stochastic paper-tooth threshold: midtones (0.2–0.75) shatter into crisp
    // stippled black filaments and sparse dots; dense ink locks to solid black.
    const tooth = microTooth[i] * 0.48 + fibres[i] * 0.24 + (random() * 2 - 1) * 0.36
    const t = 0.44 + tooth * 0.38
    const snapped = smoothstep(t - 0.055, t + 0.055, v)
    out[i] = snapped
    if (snapped > 0.05) wet[i] = 1
  }

  return { ink: out, wet }
}

/**
 * Extra transparent canvas padding (in poster px) so ink pools, rubbed smears,
 * tape seams, and margin debris aren't hard-clipped at a text layer's tight bbox.
 */
export function copyMachineBleedPadding(
  params: {
    bleed?: number
    slur?: number
    blot?: number
    smear?: number
    seams?: number
    debris?: number
  },
  layerShortSide: number,
): number {
  const b = unit(params.bleed)
  const sl = unit(params.slur)
  const bl = unit(params.blot)
  const sm = unit(params.smear)
  const se = unit(params.seams)
  const de = unit(params.debris)
  const activity = Math.max(b * 0.45, sl * 0.65, bl * 0.95, sm * 1.0, se * 0.9, de * 1.2)
  if (activity < 0.01) return 0
  const base = Math.max(20, Math.min(240, layerShortSide * 0.24))
  return Math.round(base * Math.min(1.4, 0.35 + activity * 0.95))
}
