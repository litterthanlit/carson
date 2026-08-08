import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OPEN_TYPE_FEATURES,
  normalizeOpenTypeFeatures,
  openTypeFeatureSettings,
} from './textTypography'

describe('textTypography', () => {
  it('normalizes partial OpenType feature objects', () => {
    expect(normalizeOpenTypeFeatures({ smcp: true })).toEqual({
      kern: true,
      liga: true,
      smcp: true,
    })
    expect(normalizeOpenTypeFeatures({ kern: false, liga: false })).toEqual({
      kern: false,
      liga: false,
      smcp: false,
    })
  })

  it('builds font-feature-settings for canvas context', () => {
    expect(openTypeFeatureSettings(DEFAULT_OPEN_TYPE_FEATURES)).toBe(
      '"kern" 1, "liga" 1, "smcp" 0',
    )
    expect(
      openTypeFeatureSettings({ kern: false, liga: false, smcp: true }),
    ).toBe('"kern" 0, "liga" 0, "smcp" 1')
  })
})
