import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BRUSH,
  dabBounds,
  dabFor,
  dabsTo,
  effectivePressure,
  newDabCursor,
  smoothSample,
  unionRect,
} from './brush'

const brush = { ...DEFAULT_BRUSH, size: 20, spacing: 0.25, pressureSize: false }

describe('pressure', () => {
  it('treats mice as full pressure and clamps pens', () => {
    expect(effectivePressure(0.5, 'mouse')).toBe(1)
    expect(effectivePressure(0, 'pen')).toBe(1)
    expect(effectivePressure(0.3, 'pen')).toBe(0.3)
    expect(effectivePressure(4, 'pen')).toBe(1)
  })

  it('maps pressure to size and opacity only when enabled', () => {
    const light = { x: 0, y: 0, pressure: 0.2 }
    expect(dabFor(light, { ...brush, pressureSize: true }).radius).toBeLessThan(dabFor(light, brush).radius)
    expect(dabFor(light, { ...brush, pressureOpacity: true }).alpha).toBeLessThan(dabFor(light, brush).alpha)
  })
})

describe('dab placement', () => {
  it('stamps evenly at size × spacing regardless of segment length', () => {
    const cursor = newDabCursor()
    const first = dabsTo(cursor, { x: 0, y: 0, pressure: 1 }, brush)
    expect(first).toHaveLength(1)
    // 20px brush × 0.25 spacing = 5px steps. Feed 100px in uneven chunks.
    const dabs = [
      ...dabsTo(cursor, { x: 13, y: 0, pressure: 1 }, brush),
      ...dabsTo(cursor, { x: 14, y: 0, pressure: 1 }, brush),
      ...dabsTo(cursor, { x: 100, y: 0, pressure: 1 }, brush),
    ]
    expect(dabs).toHaveLength(20)
    const gaps = dabs.slice(1).map((dab, i) => dab.x - dabs[i].x)
    for (const gap of gaps) expect(gap).toBeCloseTo(5)
  })

  it('ignores zero-length moves', () => {
    const cursor = newDabCursor()
    dabsTo(cursor, { x: 5, y: 5, pressure: 1 }, brush)
    expect(dabsTo(cursor, { x: 5, y: 5, pressure: 1 }, brush)).toHaveLength(0)
  })
})

describe('smoothing', () => {
  it('trails the input by the smoothing factor', () => {
    const out = smoothSample({ x: 0, y: 0, pressure: 1 }, { x: 10, y: 0, pressure: 1 }, 0.5)
    expect(out.x).toBeCloseTo(5)
    expect(smoothSample(null, { x: 3, y: 4, pressure: 1 }, 0.9)).toEqual({ x: 3, y: 4, pressure: 1 })
  })
})

describe('bounds', () => {
  it('covers dabs, clips to the layer, and unions', () => {
    const rect = dabBounds([{ x: 5, y: 5, radius: 10, alpha: 1 }], 100, 100)
    expect(rect).toEqual({ x: 0, y: 0, width: 16, height: 16 })
    expect(dabBounds([{ x: -50, y: -50, radius: 2, alpha: 1 }], 100, 100)).toBeNull()
    expect(unionRect({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 5, width: 5, height: 5 })).toEqual({
      x: 0,
      y: 0,
      width: 25,
      height: 10,
    })
  })
})
