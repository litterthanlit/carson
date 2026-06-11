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

export function buildColumnGrid(
  canvas: { width: number; height: number },
  overlay: GridOverlay,
): Array<{ left: number; top: number; width: number; height: number }> {
  const { columns, margin, gutter, tension } = overlay
  const innerWidth = canvas.width - margin * 2
  const colWidth = (innerWidth - gutter * (columns - 1)) / columns
  const lines: Array<{ left: number; top: number; width: number; height: number }> = []
  for (let i = 0; i < columns; i++) {
    const jitter = (Math.random() - 0.5) * tension * 24
    lines.push({
      left: margin + i * (colWidth + gutter) + jitter,
      top: margin,
      width: colWidth,
      height: canvas.height - margin * 2,
    })
  }
  return lines
}

export function baselineGridLines(canvas: { width: number; height: number }, step: number) {
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
  for (let y = step; y < canvas.height; y += step) {
    lines.push({ x1: 0, y1: y, x2: canvas.width, y2: y })
  }
  return lines
}
