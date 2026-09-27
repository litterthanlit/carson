/**
 * Pixel selections (marquee / lasso) in poster coordinates.
 * A selection is a closed polygon; ellipses are tessellated so every consumer
 * (overlay, mask regions) deals with one shape type.
 */

export type SelectionMode = 'rect' | 'ellipse' | 'lasso'

export type Point = { x: number; y: number }

export type PixelSelection = {
  points: Point[]
  inverted: boolean
  /** Feather radius in poster px. */
  feather: number
}

export type MarqueeOptions = {
  /** Shift: constrain to a square / circle. */
  square?: boolean
  /** Alt: draw from the center. */
  fromCenter?: boolean
}

function marqueeBox(anchor: Point, current: Point, options: MarqueeOptions) {
  let dx = current.x - anchor.x
  let dy = current.y - anchor.y
  if (options.square) {
    const size = Math.max(Math.abs(dx), Math.abs(dy))
    dx = Math.sign(dx || 1) * size
    dy = Math.sign(dy || 1) * size
  }
  if (options.fromCenter) {
    return { left: anchor.x - Math.abs(dx), top: anchor.y - Math.abs(dy), width: Math.abs(dx) * 2, height: Math.abs(dy) * 2 }
  }
  return { left: Math.min(anchor.x, anchor.x + dx), top: Math.min(anchor.y, anchor.y + dy), width: Math.abs(dx), height: Math.abs(dy) }
}

export function rectSelectionPoints(anchor: Point, current: Point, options: MarqueeOptions = {}): Point[] {
  const box = marqueeBox(anchor, current, options)
  return [
    { x: box.left, y: box.top },
    { x: box.left + box.width, y: box.top },
    { x: box.left + box.width, y: box.top + box.height },
    { x: box.left, y: box.top + box.height },
  ]
}

export function ellipseSelectionPoints(anchor: Point, current: Point, options: MarqueeOptions = {}, segments = 96): Point[] {
  const box = marqueeBox(anchor, current, options)
  const cx = box.left + box.width / 2
  const cy = box.top + box.height / 2
  const points: Point[] = []
  for (let i = 0; i < segments; i += 1) {
    const t = (i / segments) * Math.PI * 2
    points.push({ x: cx + (Math.cos(t) * box.width) / 2, y: cy + (Math.sin(t) * box.height) / 2 })
  }
  return points
}

/** Drop lasso samples closer than `minDistance` so long drags stay light. */
export function appendLassoPoint(points: Point[], next: Point, minDistance: number): Point[] {
  const last = points[points.length - 1]
  if (last && Math.hypot(next.x - last.x, next.y - last.y) < minDistance) return points
  return [...points, next]
}

export function selectionBounds(points: Point[]) {
  if (points.length === 0) return { left: 0, top: 0, width: 0, height: 0 }
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const point of points) {
    left = Math.min(left, point.x)
    top = Math.min(top, point.y)
    right = Math.max(right, point.x)
    bottom = Math.max(bottom, point.y)
  }
  return { left, top, width: right - left, height: bottom - top }
}

/** A selection too small to mean anything (a click, not a drag). */
export function isDegenerateSelection(points: Point[], minSize: number): boolean {
  if (points.length < 3) return true
  const bounds = selectionBounds(points)
  return bounds.width < minSize && bounds.height < minSize
}

export function svgPolygonPoints(points: Point[]): string {
  return points.map((point) => `${Math.round(point.x * 100) / 100},${Math.round(point.y * 100) / 100}`).join(' ')
}
