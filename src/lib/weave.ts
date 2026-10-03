/**
 * Weave & torn edges — the cut-and-paste moves from a Carson collage.
 *
 * Weave threads one layer (usually a giant word) through the scraps it crosses:
 * the thread sits above them all, and its mask hides it inside every other scrap,
 * so it reads as passing over one piece of paper and under the next. The cut
 * follows each scrap's real outline — torn edges included — and lives in the
 * thread's ordinary layer mask, so it can be painted, inverted, or cleared.
 *
 * Torn edges give any layer a ripped paper outline through its mask clip.
 *
 * Geometry here is pure (points in, points out) so it is easy to test; App.tsx
 * reads outlines off Fabric objects and writes the result back.
 */
import { Point as FabricPoint, util, type FabricObject } from 'fabric'
import { tornScrap } from './carsonPoster'
import { objectUnscaledSize, readLayerMask, type ClipGeom, type LayerMask, type MaskRegion } from './layerMask'

export type Point = { x: number; y: number }

export type WeaveCrossing = {
  id: string
  /** Outline in poster space. */
  outline: Point[]
}

export type WeavePlan = {
  /** Crossings in reading order along the thread, each marked over or under. */
  crossings: (WeaveCrossing & { under: boolean })[]
  parity: 0 | 1
}

/** Unit vector along a layer's reading direction for a Fabric angle (degrees). */
export function readingAxis(angle: number): Point {
  const radians = (angle * Math.PI) / 180
  return { x: Math.cos(radians), y: Math.sin(radians) }
}

export function centroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 }
  let x = 0
  let y = 0
  for (const point of points) {
    x += point.x
    y += point.y
  }
  return { x: x / points.length, y: y / points.length }
}

/**
 * Order crossings along the thread's reading axis and alternate them, so the
 * thread goes under, over, under… `parity` 1 starts with over instead.
 */
export function planWeave(threadAngle: number, crossings: WeaveCrossing[], parity: 0 | 1 = 0): WeavePlan {
  const axis = readingAxis(threadAngle)
  const along = (crossing: WeaveCrossing) => {
    const center = centroid(crossing.outline)
    return center.x * axis.x + center.y * axis.y
  }
  const ordered = [...crossings].sort((a, b) => along(a) - along(b))
  return {
    parity,
    crossings: ordered.map((crossing, index) => ({ ...crossing, under: (index + parity) % 2 === 0 })),
  }
}

/** Axis-aligned overlap test on two outlines' bounding boxes. */
export function outlinesOverlap(a: Point[], b: Point[]): boolean {
  const box = (points: Point[]) => ({
    left: Math.min(...points.map((point) => point.x)),
    right: Math.max(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    bottom: Math.max(...points.map((point) => point.y)),
  })
  if (a.length === 0 || b.length === 0) return false
  const first = box(a)
  const second = box(b)
  return first.left < second.right && second.left < first.right && first.top < second.bottom && second.top < first.bottom
}

/**
 * Replace any previous weave on a mask with conceal regions for the `under`
 * crossings. `toLocal` maps a poster point into the thread's normalized mask
 * space. Painted strokes and the user's own selection regions are kept.
 */
export function applyWeaveToMask(
  mask: LayerMask,
  plan: WeavePlan,
  toLocal: (point: Point) => Point,
): LayerMask {
  const kept = (mask.regions ?? []).filter((region) => !region.weave)
  const woven: MaskRegion[] = plan.crossings
    .filter((crossing) => crossing.under && crossing.outline.length >= 3)
    .map((crossing) => ({
      points: crossing.outline.map(toLocal),
      op: 'conceal',
      feather: 0,
      at: mask.strokes.length,
      weave: true,
    }))
  return { ...mask, enabled: true, regions: [...kept, ...woven], weaveParity: plan.parity }
}

/** Next parity for a re-run: weaving the same layer again swaps over and under. */
export function nextWeaveParity(mask: LayerMask | null): 0 | 1 {
  if (!mask || !(mask.regions ?? []).some((region) => region.weave)) return 0
  return mask.weaveParity === 0 ? 1 : 0
}

export function hasWeave(mask: LayerMask | null): boolean {
  return Boolean(mask?.regions?.some((region) => region.weave))
}

/** Drop the weave cut, keeping everything else on the mask. */
export function removeWeaveFromMask(mask: LayerMask): LayerMask {
  return { ...mask, regions: (mask.regions ?? []).filter((region) => !region.weave), weaveParity: undefined }
}

/**
 * A ripped-paper outline for a layer of `width` × `height` (unscaled pixels),
 * returned as a polygon clip in the mask's normalized 0–1 space. Roughness is
 * relative to the shorter side, so long strips tear like short ones.
 */
export function tornEdgeClip(width: number, height: number, seed: number, roughness = 0.05): ClipGeom {
  const w = Math.max(1, width)
  const h = Math.max(1, height)
  // Pull the tear inside the layer so the ripped edge shows on all four sides.
  const inset = Math.min(w, h) * roughness * 1.5
  const points = tornScrap(inset, inset, w - inset * 2, h - inset * 2, seed, roughness).map((point) => ({
    x: clamp01(point.x / w),
    y: clamp01(point.y / h),
  }))
  return { kind: 'polygon', cx: 0.5, cy: 0.5, rx: 0.5, ry: 0.5, angle: 0, points }
}

/**
 * A layer's visible outline in poster space: its torn-edge clip if it has one,
 * a polygon's own points, otherwise its rotated bounding box. Call with the
 * object outside any active selection so coordinates are absolute.
 */
export function layerOutline(object: FabricObject): Point[] {
  const matrix = object.calcTransformMatrix()
  const toPoster = (x: number, y: number) => {
    const point = util.transformPoint(new FabricPoint(x, y), matrix)
    return { x: point.x, y: point.y }
  }
  const mask = readLayerMask(object)
  const clip = mask?.enabled && !mask.inverted ? mask.clipGeom : null
  if (clip?.kind === 'polygon' && clip.points && clip.points.length >= 3) {
    const size = objectUnscaledSize(object)
    return clip.points.map((point) => toPoster((point.x - 0.5) * size.width, (point.y - 0.5) * size.height))
  }
  const record = object as unknown as { points?: Point[]; pathOffset?: Point }
  if (object.type === 'polygon' && Array.isArray(record.points) && record.points.length >= 3) {
    const offset = record.pathOffset ?? { x: 0, y: 0 }
    return record.points.map((point) => toPoster(point.x - offset.x, point.y - offset.y))
  }
  return object.getCoords().map((point) => ({ x: point.x, y: point.y }))
}

const TEXT_TYPES = new Set(['textbox', 'i-text', 'text'])

/** The thread is the biggest type layer in the selection, or the biggest layer if there is no type. */
export function pickWeaveThread(objects: FabricObject[]): FabricObject | null {
  const area = (object: FabricObject) => {
    const size = objectUnscaledSize(object)
    return size.width * Math.abs(object.scaleX ?? 1) * size.height * Math.abs(object.scaleY ?? 1)
  }
  const texts = objects.filter((object) => TEXT_TYPES.has(object.type))
  const pool = texts.length > 0 ? texts : objects
  return pool.reduce<FabricObject | null>((best, object) => (!best || area(object) > area(best) ? object : best), null)
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}
