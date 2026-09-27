import { describe, expect, it } from 'vitest'
import { applyPosterPreset } from './editorModel'
import { presetForSize, rotateLayoutGuides, rotatePosterPoint, rotatedPreset } from './rotatePoster'

const size = { width: 100, height: 200 }

describe('rotatePosterPoint', () => {
  it('maps corners clockwise onto the turned poster', () => {
    expect(rotatePosterPoint({ x: 0, y: 0 }, size, 1)).toEqual({ x: 200, y: 0 })
    expect(rotatePosterPoint({ x: 100, y: 200 }, size, 1)).toEqual({ x: 0, y: 100 })
  })

  it('maps corners counter-clockwise, and the two directions undo each other', () => {
    expect(rotatePosterPoint({ x: 0, y: 0 }, size, -1)).toEqual({ x: 0, y: 100 })
    const turned = rotatePosterPoint({ x: 30, y: 70 }, size, 1)
    expect(rotatePosterPoint(turned, { width: 200, height: 100 }, -1)).toEqual({ x: 30, y: 70 })
  })
})

describe('rotatedPreset', () => {
  it('flips vertical and horizontal', () => {
    expect(rotatedPreset(applyPosterPreset('vertical')).id).toBe('horizontal')
    expect(rotatedPreset(applyPosterPreset('horizontal')).id).toBe('vertical')
    expect(rotatedPreset(applyPosterPreset('a3')).id).toBe('horizontal')
  })

  it('turns other sizes into a swapped custom size', () => {
    const turned = rotatedPreset(applyPosterPreset('a2'))
    expect(turned).toMatchObject({ id: 'custom', width: 7016, height: 4961, dpi: 300, widthMm: 594, heightMm: 420 })
  })
})

describe('presetForSize', () => {
  it('recognises named sizes and falls back to custom', () => {
    expect(presetForSize({ width: 4961, height: 3508 }).id).toBe('horizontal')
    expect(presetForSize({ width: 800, height: 900 })).toMatchObject({ id: 'custom', width: 800, height: 900 })
  })
})

describe('rotateLayoutGuides', () => {
  it('swaps guide axes with the artwork', () => {
    const guides = [
      { id: 'a', axis: 'v' as const, position: 10 },
      { id: 'b', axis: 'h' as const, position: 50 },
    ]
    expect(rotateLayoutGuides(guides, size, 1)).toEqual([
      { id: 'a', axis: 'h', position: 10 },
      { id: 'b', axis: 'v', position: 150 },
    ])
    expect(rotateLayoutGuides(guides, size, -1)).toEqual([
      { id: 'a', axis: 'h', position: 90 },
      { id: 'b', axis: 'v', position: 50 },
    ])
  })
})
