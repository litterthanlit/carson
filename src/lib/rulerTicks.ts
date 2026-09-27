/**
 * Ruler tick layout for the viewport rulers.
 *
 * Positions are in poster pixels; the ruler component maps them to screen space.
 * Label spacing adapts to zoom with a 1-2-5 progression (like Photoshop/Figma), so
 * labels never collide and never get sparse.
 */

export type RulerUnit = 'px' | 'mm'

export type RulerTick = {
  /** Poster-pixel position of the tick. */
  position: number
  major: boolean
  label?: string
}

/** Minimum screen distance between labelled ticks. */
export const RULER_LABEL_SPACING = 64

export function posterPxPerUnit(unit: RulerUnit, dpi = 72): number {
  return unit === 'mm' ? dpi / 25.4 : 1
}

/** Smallest 1/2/5 × 10^k that is ≥ value. */
export function niceStep(value: number): number {
  if (!(value > 0) || !Number.isFinite(value)) return 1
  const exponent = Math.floor(Math.log10(value))
  const base = 10 ** exponent
  for (const multiple of [1, 2, 5, 10]) {
    if (multiple * base >= value - 1e-9) return multiple * base
  }
  return 10 * base
}

function subdivisions(step: number): number {
  const leading = Math.round(step / 10 ** Math.floor(Math.log10(step)))
  return leading === 2 ? 4 : leading === 5 ? 5 : 10
}

function formatLabel(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

export function rulerTicks(options: {
  /** Visible range in poster pixels. */
  start: number
  end: number
  displayScale: number
  unit: RulerUnit
  dpi?: number
  labelSpacing?: number
}): RulerTick[] {
  const { start, end, displayScale, unit, dpi, labelSpacing = RULER_LABEL_SPACING } = options
  if (!(end > start) || !(displayScale > 0)) return []
  const pxPerUnit = posterPxPerUnit(unit, dpi)
  const screenPerUnit = displayScale * pxPerUnit
  const step = niceStep(labelSpacing / screenPerUnit)
  const minor = step / subdivisions(step)
  const startUnit = Math.floor(start / pxPerUnit / minor) * minor
  const endUnit = end / pxPerUnit
  const ticks: RulerTick[] = []
  // Guard against pathological ranges (e.g. absurd zoom-out) producing huge arrays.
  const maxTicks = 4000
  for (let value = startUnit, i = 0; value <= endUnit + 1e-9 && i < maxTicks; value = startUnit + ++i * minor) {
    const snapped = Math.round(value / minor) * minor
    const major = Math.abs(snapped / step - Math.round(snapped / step)) < 1e-6
    ticks.push({
      position: snapped * pxPerUnit,
      major,
      label: major ? formatLabel(snapped) : undefined,
    })
  }
  return ticks
}
