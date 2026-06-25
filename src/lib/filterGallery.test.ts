import { describe, expect, it } from 'vitest'
import {
  FILTER_CATEGORIES,
  FILTER_PRESETS,
  isPresetApplicable,
  mergePresetParams,
  presetById,
  presetsForCategory,
} from './filterGallery'

describe('filterGallery', () => {
  it('defines all five categories with presets', () => {
    expect(FILTER_CATEGORIES).toHaveLength(5)
    for (const category of FILTER_CATEGORIES) {
      expect(presetsForCategory(category.id).length).toBeGreaterThan(0)
    }
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
})
