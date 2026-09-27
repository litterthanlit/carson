import { describe, expect, it } from 'vitest'
import { PAINT_MAX_PIXELS, paintCanvasSize } from './paintLayer'

describe('paintCanvasSize', () => {
  it('keeps screen-size posters at full resolution', () => {
    expect(paintCanvasSize(1080, 1350)).toEqual({ width: 1080, height: 1350 })
  })

  it('caps huge print posters at the pixel budget, preserving aspect', () => {
    const size = paintCanvasSize(4961, 7016)
    expect(size.width * size.height).toBeLessThanOrEqual(PAINT_MAX_PIXELS * 1.001)
    expect(size.width / size.height).toBeCloseTo(4961 / 7016, 2)
  })
})
