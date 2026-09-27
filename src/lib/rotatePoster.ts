import { applyPosterPreset, getPosterPreset, type PosterPreset } from './editorModel'
import type { LayoutGuide } from './grid'

/** 1 = clockwise, -1 = counter-clockwise. */
export type QuarterTurn = 1 | -1

type Point = { x: number; y: number }
type Size = { width: number; height: number }

/** Where a point on a `size` poster lands after the poster turns a quarter. */
export function rotatePosterPoint(point: Point, size: Size, direction: QuarterTurn): Point {
  return direction === 1
    ? { x: size.height - point.y, y: point.x }
    : { x: point.y, y: size.width - point.x }
}

/** Snap a size back to a named preset when it matches one, else a custom size. */
export function presetForSize(size: Size, dpi?: number): PosterPreset {
  for (const id of ['vertical', 'horizontal'] as const) {
    const preset = getPosterPreset(id)
    if (preset.width === size.width && preset.height === size.height) return preset
  }
  const custom = applyPosterPreset('custom', size)
  return dpi ? { ...custom, dpi } : custom
}

/** The same poster turned on its side: width and height (and print mm) swap. */
export function rotatedPreset(preset: PosterPreset): PosterPreset {
  const swapped = { width: preset.height, height: preset.width }
  const named = presetForSize(swapped, preset.dpi)
  if (named.id !== 'custom') return named
  return {
    ...named,
    ...swapped,
    ...(preset.widthMm && preset.heightMm ? { widthMm: preset.heightMm, heightMm: preset.widthMm } : null),
  }
}

/** Vertical guides become horizontal and vice versa, following the artwork. */
export function rotateLayoutGuides(guides: LayoutGuide[], size: Size, direction: QuarterTurn): LayoutGuide[] {
  return guides.map((guide) => {
    if (guide.axis === 'v') {
      return { ...guide, axis: 'h', position: direction === 1 ? guide.position : size.width - guide.position }
    }
    return { ...guide, axis: 'v', position: direction === 1 ? size.height - guide.position : guide.position }
  })
}
