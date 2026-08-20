/**
 * Grid overlays, align/distribute, broken-grid tension (Horizon 2.7).
 */
import type { FabricObject } from 'fabric'

export type Bounds = { left: number; top: number; width: number; height: number }

export function objectBounds(object: FabricObject): Bounds {
  const rect = object.getBoundingRect()
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

export function alignObjects(objects: FabricObject[], mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') {
  if (objects.length < 2) return
  const bounds = objects.map(objectBounds)
  const minLeft = Math.min(...bounds.map((b) => b.left))
  const maxRight = Math.max(...bounds.map((b) => b.left + b.width))
  const minTop = Math.min(...bounds.map((b) => b.top))
  const maxBottom = Math.max(...bounds.map((b) => b.top + b.height))
  const centerX = (minLeft + maxRight) / 2
  const centerY = (minTop + maxBottom) / 2

  objects.forEach((object, index) => {
    const b = bounds[index]
    let left = b.left
    let top = b.top
    if (mode === 'left') left = minLeft
    if (mode === 'center') left = centerX - b.width / 2
    if (mode === 'right') left = maxRight - b.width
    if (mode === 'top') top = minTop
    if (mode === 'middle') top = centerY - b.height / 2
    if (mode === 'bottom') top = maxBottom - b.height
    object.set({ left, top })
    object.setCoords()
  })
}

export function distributeObjects(objects: FabricObject[], axis: 'horizontal' | 'vertical') {
  if (objects.length < 3) return
  const sorted = [...objects].sort((a, b) => {
    const ba = objectBounds(a)
    const bb = objectBounds(b)
    return axis === 'horizontal' ? ba.left - bb.left : ba.top - bb.top
  })
  const bounds = sorted.map(objectBounds)
  if (axis === 'horizontal') {
    const first = bounds[0]
    const last = bounds[bounds.length - 1]
    const span = last.left + last.width - first.left
    const totalWidth = bounds.reduce((sum, b) => sum + b.width, 0)
    const gap = (span - totalWidth) / (sorted.length - 1)
    let cursor = first.left
    sorted.forEach((object, index) => {
      object.set({ left: cursor })
      object.setCoords()
      cursor += bounds[index].width + gap
    })
  } else {
    const first = bounds[0]
    const last = bounds[bounds.length - 1]
    const span = last.top + last.height - first.top
    const totalHeight = bounds.reduce((sum, b) => sum + b.height, 0)
    const gap = (span - totalHeight) / (sorted.length - 1)
    let cursor = first.top
    sorted.forEach((object, index) => {
      object.set({ top: cursor })
      object.setCoords()
      cursor += bounds[index].height + gap
    })
  }
}

export type GridOverlay = {
  columns: number
  rows: number
  margin: number
  gutter: number
  tension: number
}

export type LayoutGuide = {
  id: string
  axis: 'v' | 'h'
  position: number
}

export type LayoutCell = { left: number; top: number; width: number; height: number }

export type LayoutGrid = {
  margin: number
  gutter: number
  columns: LayoutCell[]
  rows: LayoutCell[]
  marginRect: LayoutCell
  vLines: number[]
  hLines: number[]
}

/** Grid tension 0..100 → instrument multiplier. 0 → 1×, 100 → 2×. */
export function gridTensionScale(tension: number): number {
  if (!Number.isFinite(tension)) return 1
  return Math.max(0.1, 1 + tension / 100)
}

export function clampGridOverlay(overlay: GridOverlay): GridOverlay {
  const columns = Number.isFinite(overlay.columns) ? Math.round(overlay.columns) : 4
  const rows = Number.isFinite(overlay.rows) ? Math.round(overlay.rows) : 8
  const margin = Number.isFinite(overlay.margin) ? Math.round(overlay.margin) : 48
  const gutter = Number.isFinite(overlay.gutter) ? Math.round(overlay.gutter) : 16
  const tension = Number.isFinite(overlay.tension) ? overlay.tension : 0
  return {
    columns: Math.min(12, Math.max(2, columns)),
    rows: Math.min(24, Math.max(2, rows)),
    margin: Math.min(320, Math.max(0, margin)),
    gutter: Math.min(160, Math.max(0, gutter)),
    tension: Math.min(100, Math.max(0, tension)),
  }
}

export function newLayoutGuideId() {
  return `guide-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

function uniqueSorted(values: number[]) {
  return [...new Set(values.map((value) => Math.round(value * 1000) / 1000))].sort((a, b) => a - b)
}

export function buildLayoutGrid(area: { width: number; height: number }, overlay: GridOverlay): LayoutGrid {
  const grid = clampGridOverlay(overlay)
  const maxMargin = Math.max(0, Math.floor(Math.min(area.width, area.height) / 3))
  const margin = Math.min(grid.margin, maxMargin)
  const innerWidth = Math.max(1, area.width - margin * 2)
  const innerHeight = Math.max(1, area.height - margin * 2)
  const maxGutter = Math.max(0, Math.floor(Math.min(innerWidth, innerHeight) / Math.max(2, grid.columns)))
  const gutter = Math.min(grid.gutter, maxGutter)
  const colWidth = (innerWidth - gutter * (grid.columns - 1)) / grid.columns
  const rowHeight = (innerHeight - gutter * (grid.rows - 1)) / grid.rows

  const columns: LayoutCell[] = Array.from({ length: grid.columns }, (_, index) => ({
    left: margin + index * (colWidth + gutter),
    top: margin,
    width: colWidth,
    height: innerHeight,
  }))
  const rows: LayoutCell[] = Array.from({ length: grid.rows }, (_, index) => ({
    left: margin,
    top: margin + index * (rowHeight + gutter),
    width: innerWidth,
    height: rowHeight,
  }))

  const vLines = uniqueSorted([
    0,
    margin,
    area.width - margin,
    area.width,
    ...columns.flatMap((column) => [column.left, column.left + column.width]),
  ])
  const hLines = uniqueSorted([
    0,
    margin,
    area.height - margin,
    area.height,
    ...rows.flatMap((row) => [row.top, row.top + row.height]),
  ])

  return {
    margin,
    gutter,
    columns,
    rows,
    marginRect: { left: margin, top: margin, width: innerWidth, height: innerHeight },
    vLines,
    hLines,
  }
}

export function buildColumnGrid(
  canvas: { width: number; height: number },
  overlay: GridOverlay,
  random?: () => number,
): LayoutCell[] {
  const columns = buildLayoutGrid(canvas, overlay).columns
  if (!random || overlay.tension <= 0) return columns
  const tension = clampGridOverlay(overlay).tension
  return columns.map((column) => ({
    ...column,
    left: column.left + (random() - 0.5) * tension * 0.24,
  }))
}

export function baselineGridLines(canvas: { width: number; height: number }, step: number) {
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
  const size = Math.max(8, step)
  for (let y = size; y < canvas.height; y += size) {
    lines.push({ x1: 0, y1: y, x2: canvas.width, y2: y })
  }
  return lines
}

export function layoutSnapLines(
  grid: LayoutGrid,
  guides: LayoutGuide[],
  options: { includeGrid?: boolean; includeGuides?: boolean } = {},
) {
  const includeGrid = options.includeGrid !== false
  const includeGuides = options.includeGuides !== false
  const v = includeGrid ? [...grid.vLines] : []
  const h = includeGrid ? [...grid.hLines] : []
  if (includeGuides) {
    for (const guide of guides) {
      if (guide.axis === 'v') v.push(guide.position)
      else h.push(guide.position)
    }
  }
  return { vLines: uniqueSorted(v), hLines: uniqueSorted(h) }
}

export function hitLayoutGuide(
  point: { x: number; y: number },
  guides: LayoutGuide[],
  threshold: number,
): LayoutGuide | null {
  let closest: LayoutGuide | null = null
  let closestDistance = threshold
  for (const guide of guides) {
    const distance = guide.axis === 'v' ? Math.abs(point.x - guide.position) : Math.abs(point.y - guide.position)
    if (distance <= closestDistance) {
      closest = guide
      closestDistance = distance
    }
  }
  return closest
}
