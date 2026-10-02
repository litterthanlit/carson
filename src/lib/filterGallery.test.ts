import { describe, expect, it } from 'vitest'
import {
  FILTER_CATEGORIES,
  FILTER_PRESETS,
  formatFilterParam,
  isPresetApplicable,
  mergePresetParams,
  presetById,
  presetsForCategory,
} from './filterGallery'

describe('filterGallery', () => {
  it('defines all categories with presets', () => {
    expect(FILTER_CATEGORIES).toHaveLength(10)
    for (const category of FILTER_CATEGORIES) {
      expect(presetsForCategory(category.id).length).toBeGreaterThan(0)
    }
  })

  it('files Grain under Look and Newsprint under Print', () => {
    expect(presetById('grain')?.category).toBe('film')
    expect(presetById('halftone')?.category).toBe('print')
    expect(presetsForCategory('film').map((preset) => preset.id)).toContain('grain')
    expect(presetsForCategory('print').map((preset) => preset.id)).toContain('halftone')
    expect(presetsForCategory('color').map((preset) => preset.id)).not.toContain('grain')
    expect(presetsForCategory('stylize').map((preset) => preset.id)).not.toContain('halftone')
  })

  it('has unique preset ids', () => {
    const ids = FILTER_PRESETS.map((preset) => preset.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps param ranges within expected bounds', () => {
    for (const preset of FILTER_PRESETS) {
      for (const param of preset.paramDefs) {
        expect(param.min).toBeLessThanOrEqual(param.max)
        const value = preset.defaultParams[param.key]
        if (value !== undefined) {
          expect(value).toBeGreaterThanOrEqual(param.min)
          expect(value).toBeLessThanOrEqual(param.max)
        }
      }
    }
  })

  it('looks up presets by id', () => {
    expect(presetById('xerox-office')?.name).toBe('Office copy')
    expect(presetById('missing')).toBeUndefined()
  })

  it('merges preset defaults with overrides', () => {
    const preset = presetById('xerox-office')
    expect(preset).toBeDefined()
    expect(mergePresetParams(preset!, { generation: 7 })).toEqual({ generation: 7 })
  })

  it('gates image-only presets', () => {
    const coldWash = presetById('cold-wash')
    expect(coldWash).toBeDefined()
    expect(isPresetApplicable(coldWash!, false)).toBe(false)
    expect(isPresetApplicable(coldWash!, true)).toBe(true)
    expect(isPresetApplicable(presetById('xerox-office')!, false)).toBe(true)
  })

  it('exposes motion blur with angle and distance', () => {
    const motion = presetById('motion-blur')
    expect(motion?.category).toBe('blur')
    expect(motion?.treatmentType).toBe('fx')
    expect(motion?.fxKind).toBe('motion-blur')
    expect(motion?.paramDefs.map((param) => param.key)).toEqual(['distance', 'angle'])
    expect(isPresetApplicable(motion!, false)).toBe(true)
  })

  it('formats params by unit, or by name for discrete options', () => {
    expect(formatFilterParam({ key: 'angle', label: 'Angle', min: 0, max: 360, format: 'degrees' }, 44.6)).toBe('45°')
    expect(formatFilterParam({ key: 'amount', label: 'Amount', min: 0, max: 100, format: 'percent' }, 30)).toBe('30%')
    const inks = { key: 'inks', label: 'Inks', min: 0, max: 2, labels: ['Pink + Blue', 'Black + Red', 'Teal + Orange'] }
    expect(formatFilterParam(inks, 0)).toBe('Pink + Blue')
    expect(formatFilterParam(inks, 1.4)).toBe('Black + Red')
    // Out-of-range values (a stale saved index, a typed number) clamp to the nearest name.
    expect(formatFilterParam(inks, -3)).toBe('Pink + Blue')
    expect(formatFilterParam(inks, 9)).toBe('Teal + Orange')
  })
})
