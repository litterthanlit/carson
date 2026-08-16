import { describe, expect, it } from 'vitest'
import {
  FONT_CATEGORIES,
  FONT_LIBRARY,
  buildGoogleFontsUrl,
  fontsForCategory,
  isLibraryFont,
  libraryFontByFamily,
} from './fonts'

describe('fonts', () => {
  it('ships a coherent library grouped by role', () => {
    expect(FONT_LIBRARY.length).toBeGreaterThanOrEqual(18)
    for (const category of FONT_CATEGORIES) {
      expect(fontsForCategory(category.id).length).toBeGreaterThan(0)
    }
  })

  it('keeps family names unique', () => {
    const names = FONT_LIBRARY.map((font) => font.family)
    expect(new Set(names).size).toBe(names.length)
  })

  it('looks up library faces and rejects system names', () => {
    expect(libraryFontByFamily('Oswald')?.category).toBe('condensed')
    expect(isLibraryFont('Oswald')).toBe(true)
    expect(isLibraryFont('Impact')).toBe(false)
  })

  it('builds a CSS2 URL with declared weights', () => {
    const url = buildGoogleFontsUrl(['Oswald', 'Fraunces'])
    expect(url).toContain('family=Oswald:wght@400;700')
    expect(url).toContain('family=Fraunces:wght@400;700')
  })

  it('gives display and condensed faces real poster weights', () => {
    const heavy = FONT_LIBRARY.filter((font) => font.category === 'condensed' || font.category === 'display')
    expect(heavy.some((font) => font.weights.includes(700) || font.weights.includes(800) || font.weights.includes(900))).toBe(
      true,
    )
  })

  it('treats loadGoogleFont as a local no-op once the family is in the library', async () => {
    const { loadGoogleFont, markLibraryLoaded } = await import('./fonts')
    markLibraryLoaded()
    await expect(loadGoogleFont('Oswald')).resolves.toBeUndefined()
  })
})
