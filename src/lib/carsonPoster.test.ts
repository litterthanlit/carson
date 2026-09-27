import { describe, expect, it } from 'vitest'
import { buildCarsonPoster, CARSON_POSTER_FONTS, tornScrap } from './carsonPoster'
import { isLibraryFont } from './fonts'

const PRESETS = [
  { name: 'A3', width: 3508, height: 4961 },
  { name: 'Instagram portrait', width: 1080, height: 1350 },
  { name: 'Square', width: 1600, height: 1600 },
  { name: 'Landscape', width: 1920, height: 1080 },
]

describe('tornScrap', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    expect(tornScrap(0, 0, 100, 50, 7)).toEqual(tornScrap(0, 0, 100, 50, 7))
    expect(tornScrap(0, 0, 100, 50, 7)).not.toEqual(tornScrap(0, 0, 100, 50, 8))
  })

  it('stays close to its rectangle — a tear, not a starburst', () => {
    const roughness = 0.1
    const points = tornScrap(100, 200, 400, 200, 42, roughness)
    const slack = 200 * roughness * 2.3
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(100 - slack)
      expect(point.x).toBeLessThanOrEqual(500 + slack)
      expect(point.y).toBeGreaterThanOrEqual(200 - slack)
      expect(point.y).toBeLessThanOrEqual(400 + slack)
    }
  })
})

describe('buildCarsonPoster', () => {
  const specs = buildCarsonPoster(3508, 4961)

  it('keeps the layer names the walkthrough and verify scripts rely on', () => {
    const names = specs.map((spec) => spec.name)
    expect(names).toContain('Oversized headline')
    expect(names).toContain('Red interruption')
    expect(new Set(names).size).toBe(names.length)
  })

  it('spells CARSON in the headline', () => {
    const headline = specs.find((spec) => spec.name === 'Oversized headline')
    expect(headline?.type).toBe('text')
    if (headline?.type === 'text') expect(headline.text.replace(/\s+/g, '')).toBe('CARSON')
    expect(specs.some((spec) => spec.type === 'text' && /RAY GUN/.test(spec.text))).toBe(false)
  })

  it('only uses bundled library fonts, all of which App preloads', () => {
    for (const spec of specs) {
      if (spec.type !== 'text') continue
      expect(isLibraryFont(spec.fontFamily)).toBe(true)
      expect(CARSON_POSTER_FONTS).toContain(spec.fontFamily)
    }
  })

  it.each(PRESETS)('anchors every layer on or just past the page on $name', ({ width, height }) => {
    const bleed = 0.05
    for (const spec of buildCarsonPoster(width, height)) {
      const anchors =
        spec.type === 'polygon'
          ? spec.points
          : spec.type === 'line'
            ? [
                { x: spec.x1, y: spec.y1 },
                { x: spec.x2, y: spec.y2 },
              ]
            : [{ x: spec.left, y: spec.top }]
      for (const point of anchors) {
        expect(point.x).toBeGreaterThanOrEqual(-width * bleed)
        expect(point.x).toBeLessThanOrEqual(width * (1 + bleed))
        expect(point.y).toBeGreaterThanOrEqual(-height * bleed)
        expect(point.y).toBeLessThanOrEqual(height * (1 + bleed))
      }
    }
  })
})
