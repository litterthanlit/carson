import { describe, expect, it } from 'vitest'
import { castsCollageShadow, planCollageLight, scrapHeights, type CollageScrap } from './collageLight'

const square = (x: number, y: number, size = 10) => [
  { x, y },
  { x: x + size, y },
  { x: x + size, y: y + size },
  { x, y: y + size },
]

const pile: CollageScrap[] = [
  { id: 'board', outline: square(0, 0, 100), stackIndex: 0 },
  { id: 'middle', outline: square(10, 10, 40), stackIndex: 1 },
  { id: 'top', outline: square(20, 20, 10), stackIndex: 2 },
  { id: 'apart', outline: square(200, 200, 10), stackIndex: 3 },
]

describe('collage light', () => {
  it('stacks heights one sheet per scrap underneath', () => {
    const heights = scrapHeights(pile)
    expect(heights.get('board')).toBe(1)
    expect(heights.get('middle')).toBe(2)
    expect(heights.get('top')).toBe(3)
    expect(heights.get('apart')).toBe(1)
  })

  it('throws higher scraps further and softer shadows from one light', () => {
    const plan = planCollageLight(pile, { seed: 9, scale: 1, lift: 100 })
    const board = plan.get('board')!
    const top = plan.get('top')!
    expect(top.distance).toBeGreaterThan(board.distance)
    expect(top.blur).toBeGreaterThan(board.blur)
    // One light: every angle within a few degrees of the others.
    const angles = [...plan.values()].map((shadow) => shadow.angle)
    expect(Math.max(...angles) - Math.min(...angles)).toBeLessThanOrEqual(6)
  })

  it('is the same photograph for the same seed', () => {
    expect(planCollageLight(pile, { seed: 3, scale: 2 })).toEqual(planCollageLight(pile, { seed: 3, scale: 2 }))
  })

  it('lets paper cast shadows and keeps ink flat', () => {
    expect(castsCollageShadow({ type: 'image' })).toBe(true)
    expect(castsCollageShadow({ type: 'polygon' })).toBe(true)
    expect(castsCollageShadow({ type: 'textbox' })).toBe(false)
    expect(castsCollageShadow({ type: 'line' })).toBe(false)
    expect(castsCollageShadow({ type: 'image', globalCompositeOperation: 'multiply' })).toBe(false)
  })
})
