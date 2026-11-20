/**
 * Brush engine math: settings, pressure response, smoothing, and dab placement.
 *
 * A stroke is a sequence of input samples (position + pressure). Samples are
 * smoothed (lazy-mouse stabilizer), then dabs are stamped along the path at a
 * spacing proportional to the current dab size, carrying the remainder between
 * segments so spacing is even no matter how fast the pointer moves.
 */

export type BrushTip = 'round' | 'ink-blot' | 'solvent-rub' | 'smudge' | 'debris'

export const BRUSH_TIPS: { id: BrushTip; label: string; title: string }[] = [
  { id: 'round', label: 'Round', title: 'Smooth pressure-sensitive round brush' },
  { id: 'ink-blot', label: 'Ink blot', title: 'Organic jagged solvent ink pool with fibrous stipple edges' },
  { id: 'solvent-rub', label: 'Solvent rub', title: 'Directional combed dry-brush rubbed toner filaments' },
  { id: 'smudge', label: 'Smudge', title: 'Pulls real ink out of layers beneath the cursor into dry-brush streaks' },
  { id: 'debris', label: 'Debris', title: 'Stamps torn toner flakes, lint chunks, and scanner dust' },
]

export type BrushSettings = {
  /** Physical brush tip. */
  tip: BrushTip
  /** Diameter in poster px at full pressure. */
  size: number
  /** 0–1: edge falloff. 1 = crisp disc. */
  hardness: number
  /** 0–1: maximum opacity of the whole stroke. */
  opacity: number
  /** 0–1: paint laid down per dab (builds up within the stroke, capped by opacity). */
  flow: number
  /** Dab spacing as a fraction of the dab diameter. */
  spacing: number
  /** 0–1: stabilizer strength (0 = raw input). */
  smoothing: number
  color: string
  erase: boolean
  pressureSize: boolean
  pressureOpacity: boolean
}

export const DEFAULT_BRUSH: BrushSettings = {
  tip: 'round',
  size: 60,
  hardness: 0.7,
  opacity: 1,
  flow: 0.8,
  spacing: 0.12,
  smoothing: 0.35,
  color: '#050505',
  erase: false,
  pressureSize: true,
  pressureOpacity: false,
}

export type BrushSample = { x: number; y: number; pressure: number }

export type Dab = { x: number; y: number; radius: number; alpha: number; angle?: number }

/**
 * Normalize pointer pressure. Mice report 0.5 while pressed (or 0 on some
 * platforms); treat them as full pressure so mouse strokes aren't half-size.
 */
export function effectivePressure(pressure: number, pointerType: string): number {
  if (pointerType === 'mouse' || !Number.isFinite(pressure) || pressure <= 0) return 1
  return Math.min(1, Math.max(0.02, pressure))
}

/** Map pressure to dab radius and alpha according to the brush's pressure settings. */
export function dabFor(sample: BrushSample, brush: BrushSettings, angle?: number): Dab {
  // A gentle curve: light pressure still leaves a visible mark.
  const p = Math.pow(sample.pressure, 0.8)
  const radius = Math.max(0.5, (brush.size / 2) * (brush.pressureSize ? 0.15 + 0.85 * p : 1))
  const alpha = Math.min(1, Math.max(0, brush.flow * (brush.pressureOpacity ? p : 1)))
  return angle === undefined ? { x: sample.x, y: sample.y, radius, alpha } : { x: sample.x, y: sample.y, radius, alpha, angle }
}

/** Lazy-mouse stabilizer: each output trails the previous toward the raw input. */
export function smoothSample(previous: BrushSample | null, raw: BrushSample, smoothing: number): BrushSample {
  if (!previous) return raw
  const s = Math.min(0.95, Math.max(0, smoothing))
  const k = 1 - s
  return {
    x: previous.x + (raw.x - previous.x) * k,
    y: previous.y + (raw.y - previous.y) * k,
    pressure: previous.pressure + (raw.pressure - previous.pressure) * Math.min(1, k * 1.5),
  }
}

export type DabCursor = {
  last: BrushSample | null
  /** Distance travelled since the last dab, carried across segments. */
  carry: number
  /** Last stroke direction in radians (used by directional tips). */
  angle: number
}

export function newDabCursor(): DabCursor {
  return { last: null, carry: 0, angle: 0 }
}

function tipSpacing(brush: BrushSettings): number {
  if (brush.erase || brush.tip === 'round') return Math.max(0.02, brush.spacing)
  if (brush.tip === 'debris') return Math.max(0.55, brush.spacing * 4)
  if (brush.tip === 'ink-blot') return Math.max(0.22, brush.spacing * 1.6)
  if (brush.tip === 'solvent-rub' || brush.tip === 'smudge') return Math.max(0.08, brush.spacing)
  return Math.max(0.02, brush.spacing)
}

/**
 * Dabs for moving from the cursor's last sample to `next`. The first sample of a
 * stroke always produces one dab. Mutates and returns the cursor state.
 */
export function dabsTo(cursor: DabCursor, next: BrushSample, brush: BrushSettings): Dab[] {
  const dabs: Dab[] = []
  const from = cursor.last
  if (!from) {
    dabs.push(dabFor(next, brush, cursor.angle))
    cursor.last = next
    cursor.carry = 0
    return dabs
  }
  const dx = next.x - from.x
  const dy = next.y - from.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return dabs
  const angle = Math.atan2(dy, dx)
  cursor.angle = angle
  const spacing = tipSpacing(brush)
  let travelled = 0
  let carry = cursor.carry
  // Guard against pathological inputs producing millions of dabs.
  for (let guard = 0; guard < 20000; guard += 1) {
    const t0 = travelled / length
    const pressure = from.pressure + (next.pressure - from.pressure) * t0
    const radius = dabFor({ x: 0, y: 0, pressure }, brush).radius
    const step = Math.max(0.5, radius * 2 * spacing)
    const needed = step - carry
    if (travelled + needed > length) {
      carry += length - travelled
      break
    }
    travelled += needed
    carry = 0
    const t = travelled / length
    dabs.push(
      dabFor(
        { x: from.x + dx * t, y: from.y + dy * t, pressure: from.pressure + (next.pressure - from.pressure) * t },
        brush,
        angle,
      ),
    )
  }
  cursor.last = next
  cursor.carry = carry
  return dabs
}

export type Rect = { x: number; y: number; width: number; height: number }

/** Integer pixel bounds covering the dabs, clipped to the layer. */
export function dabBounds(dabs: Dab[], width: number, height: number): Rect | null {
  if (dabs.length === 0) return null
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const dab of dabs) {
    left = Math.min(left, dab.x - dab.radius - 1)
    top = Math.min(top, dab.y - dab.radius - 1)
    right = Math.max(right, dab.x + dab.radius + 1)
    bottom = Math.max(bottom, dab.y + dab.radius + 1)
  }
  const x = Math.max(0, Math.floor(left))
  const y = Math.max(0, Math.floor(top))
  const r = Math.min(width, Math.ceil(right))
  const b = Math.min(height, Math.ceil(bottom))
  if (r <= x || b <= y) return null
  return { x, y, width: r - x, height: b - y }
}

export function unionRect(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b
  if (!b) return a
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y }
}
