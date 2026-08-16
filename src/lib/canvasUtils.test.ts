import { describe, expect, it } from 'vitest'
import { computeFitScale, FIT_PADDING } from './canvasUtils'

describe('computeFitScale', () => {
  it('fits a wide-short stage by height', () => {
    const scale = computeFitScale(1200, 400, 800, 1200, FIT_PADDING)
    expect(scale).toBeCloseTo((400 - FIT_PADDING) / 1200, 5)
    expect(scale).toBeLessThan(1)
  })

  it('fits a tall-narrow stage by width', () => {
    const scale = computeFitScale(400, 1200, 800, 1200, FIT_PADDING)
    expect(scale).toBeCloseTo((400 - FIT_PADDING) / 800, 5)
    expect(scale).toBeLessThan(1)
  })

  it('never exceeds 1', () => {
    const scale = computeFitScale(2000, 2000, 400, 600, FIT_PADDING)
    expect(scale).toBe(1)
  })

  it('respects padding', () => {
    const tight = computeFitScale(500, 500, 480, 480, 48)
    const loose = computeFitScale(500, 500, 480, 480, 96)
    expect(loose).toBeLessThan(tight)
    expect(tight).toBeLessThan(1)
  })

  it('clamps tiny stages to 0.02', () => {
    expect(computeFitScale(10, 10, 800, 1200, FIT_PADDING)).toBe(0.02)
    expect(computeFitScale(0, 500, 800, 1200, FIT_PADDING)).toBe(0.02)
  })
})
