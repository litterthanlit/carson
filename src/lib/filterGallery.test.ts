import { describe, expect, it } from 'vitest'
import {
  FILTER_CATEGORIES,
  FILTER_PRESETS,
  defaultsForFx,
  formatFilterParam,
  isPresetApplicable,
  mergePresetParams,
  paramDefsForFx,
  presetById,
  presetsForCategory,
} from './filterGallery'
import { PIXEL_PARAMS } from './filterPreview'
import { FX_KINDS } from './pixelFilters'
import { DUOTONE_PALETTES, RISO_INKS } from './printFilters'

const PRINT_PROCESS_PRESETS = [
  'halftone-dots',
  'halftone-coarse',
  'risograph',
  'riso-black-red',
  'dither',
  'dither-chunky',
  'duotone-navy',
  'duotone-red',
  'rgb-split',
  'rgb-split-drift',
  'scan-lines',
  'scan-lines-torn',
]

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

  it('files the print-process filters in existing categories, after the treatments they sit beside', () => {
    expect(FILTER_CATEGORIES).toHaveLength(10)
    for (const id of PRINT_PROCESS_PRESETS) {
      const preset = presetById(id)
      expect(preset, id).toBeDefined()
      expect(FILTER_CATEGORIES.map((category) => category.id)).toContain(preset!.category)
      expect(preset!.treatmentType).toBe('fx')
      expect(preset!.description?.length).toBeGreaterThan(10)
      expect(preset!.scope).toBe('selection')
    }
    expect(presetsForCategory('print')[0]?.id).toBe('xerox-light')
    expect(presetsForCategory('distress')[0]?.id).toBe('distress-light')
    expect(presetById('duotone-navy')?.category).toBe('film')
    expect(presetById('rgb-split')?.category).toBe('distress')
  })

  it('gives every fx kind params and defaults the Inspector can edit', () => {
    for (const kind of FX_KINDS) {
      const defs = paramDefsForFx(kind)
      const defaults = defaultsForFx(kind)
      for (const def of defs) {
        expect(defaults[def.key], `${kind}.${def.key}`).toBeDefined()
        expect(defaults[def.key]).toBeGreaterThanOrEqual(def.min)
        expect(defaults[def.key]).toBeLessThanOrEqual(def.max)
      }
      // Presets that share a kind share its param list, since the Inspector reads the first.
      for (const preset of FILTER_PRESETS.filter((item) => item.fxKind === kind)) {
        expect(preset.paramDefs.map((def) => def.key)).toEqual(defs.map((def) => def.key))
        expect(Object.keys(preset.defaultParams).sort()).toEqual(defs.map((def) => def.key).sort())
      }
    }
    expect(paramDefsForFx('threshold').map((def) => def.key)).toEqual(['level'])
  })

  it('lists every pixel-measured param for preview scaling', () => {
    const expected: Record<string, string[]> = {
      'halftone-dots': ['cell'],
      risograph: ['offset'],
      dither: ['scale'],
      'rgb-split': ['distance'],
      'scan-lines': ['spacing'],
    }
    for (const [kind, keys] of Object.entries(expected)) {
      expect(PIXEL_PARAMS[kind as keyof typeof PIXEL_PARAMS]).toEqual(keys)
    }
    // Every listed key is a real param of that kind.
    for (const [kind, keys] of Object.entries(PIXEL_PARAMS)) {
      const defs = paramDefsForFx(kind).map((def) => def.key)
      for (const key of keys ?? []) expect(defs, `${kind}.${key}`).toContain(key)
    }
    // Palettes, angles and percentages are not pixel sizes.
    expect(PIXEL_PARAMS.duotone).toBeUndefined()
    expect(PIXEL_PARAMS.threshold).toBeUndefined()
  })

  it('names palette indices in the slider readout', () => {
    const inks = paramDefsForFx('risograph').find((def) => def.key === 'inks')!
    expect(inks.min).toBe(0)
    expect(inks.max).toBe(RISO_INKS.length - 1)
    expect(formatFilterParam(inks, 0)).toBe('Fluoro Pink + Blue')
    expect(formatFilterParam(inks, 1)).toBe('Black + Red')
    const palette = paramDefsForFx('duotone').find((def) => def.key === 'palette')!
    expect(palette.max).toBe(DUOTONE_PALETTES.length - 1)
    expect(formatFilterParam(palette, 1)).toBe('Navy / Cream')
    expect(new Set(RISO_INKS.map((pair) => pair.name)).size).toBe(RISO_INKS.length)
    expect(new Set(DUOTONE_PALETTES.map((pair) => pair.name)).size).toBe(DUOTONE_PALETTES.length)
  })
})
