import { describe, expect, it } from 'vitest'
import {
  appendLassoPoint,
  ellipseSelectionPoints,
  isDegenerateSelection,
  rectSelectionPoints,
  selectionBounds,
} from './selection'

describe('marquee geometry', () => {
  it('normalizes rectangles dragged in any direction', () => {
    const points = rectSelectionPoints({ x: 100, y: 80 }, { x: 20, y: 10 })
    expect(selectionBounds(points)).toEqual({ left: 20, top: 10, width: 80, height: 70 })
  })

  it('constrains to a square and draws from center', () => {
    const square = selectionBounds(rectSelectionPoints({ x: 0, y: 0 }, { x: 50, y: 20 }, { square: true }))
    expect(square.width).toBe(50)
    expect(square.height).toBe(50)
    const centered = selectionBounds(rectSelectionPoints({ x: 100, y: 100 }, { x: 130, y: 110 }, { fromCenter: true }))
    expect(centered).toEqual({ left: 70, top: 90, width: 60, height: 20 })
  })

  it('tessellates ellipses inside their box', () => {
    const points = ellipseSelectionPoints({ x: 0, y: 0 }, { x: 200, y: 100 })
    const bounds = selectionBounds(points)
    expect(bounds.width).toBeCloseTo(200, 0)
    expect(bounds.height).toBeCloseTo(100, 0)
    expect(points.length).toBe(96)
  })
})

describe('lasso', () => {
  it('skips samples that are too close', () => {
    let points = appendLassoPoint([], { x: 0, y: 0 }, 4)
    points = appendLassoPoint(points, { x: 1, y: 1 }, 4)
    points = appendLassoPoint(points, { x: 10, y: 0 }, 4)
    expect(points).toHaveLength(2)
  })

  it('treats a click as degenerate', () => {
    expect(isDegenerateSelection([{ x: 0, y: 0 }], 4)).toBe(true)
    expect(isDegenerateSelection(rectSelectionPoints({ x: 0, y: 0 }, { x: 2, y: 2 }), 4)).toBe(true)
    expect(isDegenerateSelection(rectSelectionPoints({ x: 0, y: 0 }, { x: 40, y: 2 }), 4)).toBe(false)
  })
})
