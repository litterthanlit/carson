import { describe, expect, it } from 'vitest'
import { adjustmentLut, applyAdjustment, defaultAdjustment, type Adjustment } from './adjustments'

function px(...rgba: number[]) {
  return new Uint8ClampedArray(rgba)
}

describe('adjustmentLut', () => {
  it('levels stretches the input range and applies gamma', () => {
    const lut = adjustmentLut({ type: 'levels', black: 50, white: 200, gamma: 1 })!
    expect(lut[50]).toBe(0)
    expect(lut[200]).toBe(255)
    expect(lut[125]).toBe(128)
    const brighter = adjustmentLut({ type: 'levels', black: 0, white: 255, gamma: 2 })!
    expect(brighter[64]).toBeGreaterThan(64)
  })

  it('brightness/contrast pivots on mid grey', () => {
    const lut = adjustmentLut({ type: 'brightnessContrast', brightness: 0, contrast: 50 })!
    expect(lut[128]).toBe(128)
    expect(lut[200]).toBeGreaterThan(200)
    expect(lut[60]).toBeLessThan(60)
  })

  it('posterize snaps to n levels', () => {
    const lut = adjustmentLut({ type: 'posterize', levels: 2 })!
    expect(new Set(Array.from(lut))).toEqual(new Set([0, 255]))
  })

  it('returns null for non-separable adjustments', () => {
    expect(adjustmentLut(defaultAdjustment('hueSat'))).toBeNull()
    expect(adjustmentLut(defaultAdjustment('gradientMap'))).toBeNull()
  })
})

describe('applyAdjustment', () => {
  it('inverts colors and preserves alpha', () => {
    const data = px(10, 20, 30, 128)
    applyAdjustment(data, { type: 'invert' })
    expect(Array.from(data)).toEqual([245, 235, 225, 128])
  })

  it('blends with the original by opacity', () => {
    const data = px(0, 0, 0, 255)
    applyAdjustment(data, { type: 'invert' }, 0.5)
    expect(data[0]).toBe(128)
  })

  it('skips fully transparent pixels', () => {
    const data = px(10, 20, 30, 0)
    applyAdjustment(data, { type: 'invert' })
    expect(Array.from(data)).toEqual([10, 20, 30, 0])
  })

  it('threshold splits on luminance', () => {
    const data = px(250, 250, 250, 255, 20, 20, 20, 255)
    applyAdjustment(data, { type: 'threshold', level: 128 })
    expect(Array.from(data)).toEqual([255, 255, 255, 255, 0, 0, 0, 255])
  })

  it('gradient map maps shadows and highlights to the two colors', () => {
    const data = px(0, 0, 0, 255, 255, 255, 255, 255)
    applyAdjustment(data, { type: 'gradientMap', shadow: '#102030', highlight: '#ff0000' })
    expect(Array.from(data.slice(0, 3))).toEqual([16, 32, 48])
    expect(Array.from(data.slice(4, 7))).toEqual([255, 0, 0])
  })

  it('hue/saturation desaturates fully to grey and rotates hue', () => {
    const grey = px(200, 40, 40, 255)
    applyAdjustment(grey, { type: 'hueSat', hue: 0, saturation: -100, lightness: 0 })
    expect(grey[0]).toBe(grey[1])
    expect(grey[1]).toBe(grey[2])
    const rotated = px(255, 0, 0, 255)
    applyAdjustment(rotated, { type: 'hueSat', hue: 120, saturation: 0, lightness: 0 } as Adjustment)
    expect(rotated[1]).toBe(255)
    expect(rotated[0]).toBe(0)
  })
})

describe('AdjustmentLayer', () => {
  it('serializes and revives its adjustment through clone', async () => {
    const { AdjustmentLayer, readAdjustment } = await import('./adjustmentLayer')
    const layer = new AdjustmentLayer({ width: 100, height: 100, adjustment: { type: 'threshold', level: 90 } })
    const json = layer.toObject() as { type: string; adjustment?: unknown }
    expect(json.type).toBe('AdjustmentLayer')
    expect(json.adjustment).toEqual({ type: 'threshold', level: 90 })
    const clone = await layer.clone()
    expect(readAdjustment(clone)).toEqual({ type: 'threshold', level: 90 })
    expect(clone.evented).toBe(false)
  })
})
