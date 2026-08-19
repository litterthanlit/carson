import { describe, expect, it } from 'vitest'
import {
  FONT_CATEGORIES,
  FONT_LIBRARY,
  buildGoogleFontsUrl,
  collectFontFamilies,
  fontSource,
  fontsForCategory,
  isLibraryFont,
  isRemoteFont,
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

  it('includes Studio OS Google Fonts and Fontshare faces', () => {
    expect(isLibraryFont('Inter')).toBe(true)
    expect(isLibraryFont('Space Grotesk')).toBe(true)
    expect(isLibraryFont('Playfair Display')).toBe(true)
    expect(isLibraryFont('JetBrains Mono')).toBe(true)
    expect(isLibraryFont('Satoshi')).toBe(true)
    expect(isLibraryFont('Clash Display')).toBe(true)
    expect(fontSource(libraryFontByFamily('Inter')!)).toBe('google')
    expect(fontSource(libraryFontByFamily('Satoshi')!)).toBe('fontshare')
    expect(isRemoteFont('Oswald')).toBe(false)
    expect(isRemoteFont('Inter')).toBe(true)
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

  it('collects font families from nested canvas JSON', () => {
    const families = collectFontFamilies({
      objects: [{ fontFamily: 'Inter' }, { objects: [{ fontFamily: 'Satoshi' }] }],
    })
    expect([...families].sort()).toEqual(['Inter', 'Satoshi'])
  })

  it('treats loadGoogleFont as a local no-op once the family is in the library', async () => {
    const { loadGoogleFont, markLibraryLoaded } = await import('./fonts')
    markLibraryLoaded()
    await expect(loadGoogleFont('Oswald')).resolves.toBeUndefined()
  })

  it('builds Google Fonts URLs for Studio OS families', () => {
    expect(buildGoogleFontsUrl(['Inter'])).toContain('family=Inter:wght@400;500;600;700')
    expect(libraryFontByFamily('Satoshi')?.slug).toBe('satoshi')
  })
})
