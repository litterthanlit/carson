import { describe, expect, it } from 'vitest'
import { Rect } from 'fabric'
import {
  LAYER_STYLE_DEFAULTS,
  hasActivePasses,
  layerStyleBleed,
  layerStylePasses,
  readLayerStyle,
  toRgba,
  writeLayerStyle,
} from './layerStyles'

describe('layerStylePasses', () => {
  it('orders glow, then drop shadow, then outline ring', () => {
    const passes = layerStylePasses({
      outerGlow: LAYER_STYLE_DEFAULTS.outerGlow,
      dropShadow: LAYER_STYLE_DEFAULTS.dropShadow,
      outline: { ...LAYER_STYLE_DEFAULTS.outline, width: 4 },
    })
    expect(passes[0].offsetX).toBe(0)
    expect(passes[0].blur).toBe(LAYER_STYLE_DEFAULTS.outerGlow.size)
    const shadow = passes[2]
    // Light from 120° (upper left) → shadow falls down and right.
    expect(shadow.offsetX).toBeGreaterThan(0)
    expect(shadow.offsetY).toBeGreaterThan(0)
    const ring = passes.slice(3)
    expect(ring.length).toBeGreaterThanOrEqual(12)
    for (const pass of ring) expect(Math.hypot(pass.offsetX, pass.offsetY)).toBeCloseTo(4)
  })

  it('skips disabled or empty effects', () => {
    expect(layerStylePasses({ dropShadow: { ...LAYER_STYLE_DEFAULTS.dropShadow, enabled: false } })).toEqual([])
    expect(layerStylePasses({ outline: { ...LAYER_STYLE_DEFAULTS.outline, width: 0 } })).toEqual([])
    expect(hasActivePasses({ outline: { ...LAYER_STYLE_DEFAULTS.outline, width: 0 } })).toBe(false)
  })

  it('reports bleed large enough to contain the shadow', () => {
    const bleed = layerStyleBleed({ dropShadow: { ...LAYER_STYLE_DEFAULTS.dropShadow, distance: 20, blur: 10 } })
    expect(bleed).toBeGreaterThanOrEqual(30)
  })
})

describe('scaledLayerStyleDefaults', () => {
  it('keeps visual weight constant across poster sizes', async () => {
    const { layerStyleScale, scaledLayerStyleDefaults } = await import('./layerStyles')
    expect(layerStyleScale(1080, 1350)).toBe(1)
    const a3 = scaledLayerStyleDefaults(layerStyleScale(3508, 4961))
    expect(a3.dropShadow.distance).toBe(Math.round(18 * (3508 / 1080)))
    expect(a3.outline.width).toBeGreaterThan(LAYER_STYLE_DEFAULTS.outline.width)
  })
})

describe('toRgba', () => {
  it('converts hex with opacity', () => {
    expect(toRgba('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)')
    expect(toRgba('#0f0', 2)).toBe('rgba(0, 255, 0, 1)')
  })
})

describe('read/writeLayerStyle', () => {
  it('stores on the object, serializes, and clears empty styles', () => {
    const rect = new Rect({ width: 10, height: 10 })
    writeLayerStyle(rect, { dropShadow: LAYER_STYLE_DEFAULTS.dropShadow })
    expect(readLayerStyle(rect)?.dropShadow?.distance).toBe(18)
    expect((rect.toObject(['layerStyle'] as never[]) as { layerStyle?: unknown }).layerStyle).toBeTruthy()
    writeLayerStyle(rect, {})
    expect(readLayerStyle(rect)).toBeNull()
  })
})
