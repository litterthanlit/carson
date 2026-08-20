import { describe, expect, it } from 'vitest'
import {
  buildLayoutGrid,
  clampGridOverlay,
  hitLayoutGuide,
  layoutSnapLines,
  type LayoutGuide,
} from './grid'

const AREA = { width: 1000, height: 1400 }

describe('clampGridOverlay', () => {
  it('keeps a valid overlay intact', () => {
    expect(clampGridOverlay({ columns: 4, rows: 8, margin: 48, gutter: 16, tension: 20 })).toEqual({
      columns: 4,
      rows: 8,
      margin: 48,
      gutter: 16,
      tension: 20,
    })
  })

  it('clamps wild values', () => {
    const next = clampGridOverlay({ columns: 99, rows: 0, margin: -4, gutter: 400, tension: 180 })
    expect(next.columns).toBe(12)
    expect(next.rows).toBe(2)
    expect(next.margin).toBe(0)
    expect(next.gutter).toBe(160)
    expect(next.tension).toBe(100)
  })
})

describe('buildLayoutGrid', () => {
  it('builds four equal columns inside the margin', () => {
    const grid = buildLayoutGrid(AREA, { columns: 4, rows: 8, margin: 40, gutter: 20, tension: 0 })
    expect(grid.columns).toHaveLength(4)
    expect(grid.rows).toHaveLength(8)
    expect(grid.marginRect).toEqual({ left: 40, top: 40, width: 920, height: 1320 })
    expect(grid.columns[0]?.left).toBe(40)
    expect(grid.columns[0]?.width).toBe(215)
    expect(grid.columns[1]?.left).toBe(275)
  })

  it('exposes snap lines on column edges and the poster bounds', () => {
    const grid = buildLayoutGrid(AREA, { columns: 2, rows: 2, margin: 50, gutter: 0, tension: 0 })
    expect(grid.vLines).toContain(0)
    expect(grid.vLines).toContain(50)
    expect(grid.vLines).toContain(500)
    expect(grid.vLines).toContain(950)
    expect(grid.vLines).toContain(1000)
    expect(grid.hLines).toContain(0)
    expect(grid.hLines).toContain(700)
    expect(grid.hLines).toContain(1400)
  })
})

describe('layoutSnapLines', () => {
  it('includes custom guides when requested', () => {
    const grid = buildLayoutGrid(AREA, { columns: 2, rows: 2, margin: 0, gutter: 0, tension: 0 })
    const guides: LayoutGuide[] = [
      { id: 'v', axis: 'v', position: 333 },
      { id: 'h', axis: 'h', position: 221 },
    ]
    const lines = layoutSnapLines(grid, guides, { includeGrid: false, includeGuides: true })
    expect(lines.vLines).toEqual([333])
    expect(lines.hLines).toEqual([221])
  })
})

describe('hitLayoutGuide', () => {
  it('hits the nearest guide within threshold', () => {
    const guides: LayoutGuide[] = [
      { id: 'v', axis: 'v', position: 200 },
      { id: 'h', axis: 'h', position: 80 },
    ]
    expect(hitLayoutGuide({ x: 203, y: 10 }, guides, 6)?.id).toBe('v')
    expect(hitLayoutGuide({ x: 10, y: 84 }, guides, 6)?.id).toBe('h')
    expect(hitLayoutGuide({ x: 40, y: 40 }, guides, 6)).toBeNull()
  })
})
