import { describe, expect, it } from 'vitest'
import { buildSwissPoster, SWISS, SWISS_STATIONS, swissGrid, type SwissLayerSpec } from './swissPoster'

// Rough stand-in for Fabric's measurement: bold grotesque caps ≈ 0.68em each.
const measure = (text: string, fontSize: number) => text.length * fontSize * 0.68

const PRESETS = [
  { name: 'A3', width: 3508, height: 4961 },
  { name: 'Instagram portrait', width: 1080, height: 1350 },
  { name: 'Square', width: 1600, height: 1600 },
  { name: 'Landscape', width: 1920, height: 1080 },
]

function bounds(spec: SwissLayerSpec) {
  if (spec.type === 'path') return null
  const height = spec.type === 'rect' ? spec.height : spec.fontSize * 1.13
  return { left: spec.left, top: spec.top, right: spec.left + spec.width, bottom: spec.top + height }
}

describe('swissGrid', () => {
  it('lays 12 columns and 11 gutters exactly across the live area', () => {
    const grid = swissGrid(1000)
    expect(grid.x(1)).toBeCloseTo(grid.margin)
    expect(grid.x(12) + grid.column).toBeCloseTo(1000 - grid.margin)
    expect(grid.span(1, 12)).toBeCloseTo(1000 - grid.margin * 2)
    expect(grid.span(1, 4) * 3 + grid.gutter * 2).toBeCloseTo(grid.span(1, 12))
  })
})

describe('buildSwissPoster', () => {
  it('keeps the layer names the walkthrough and verify scripts rely on', () => {
    const names = buildSwissPoster(3508, 4961, measure).map((spec) => spec.name)
    expect(names).toContain('Oversized headline')
    expect(names).toContain('Red interruption')
    const headline = buildSwissPoster(3508, 4961, measure).find((spec) => spec.name === 'Oversized headline')
    expect(headline?.type === 'text' && headline.text).toContain('RAY GUN')
  })

  it('uses exactly one accent mark, and it is the full stop', () => {
    const accented = buildSwissPoster(3508, 4961, measure).filter((spec) => spec.fill === SWISS.accent)
    expect(accented.map((spec) => spec.name)).toEqual(['Red interruption'])
  })

  it('puts the full stop right after the masthead, on its baseline', () => {
    const specs = buildSwissPoster(3508, 4961, measure)
    const head = specs.find((spec) => spec.name === 'Oversized headline')
    const dot = specs.find((spec) => spec.name === 'Red interruption')
    if (head?.type !== 'text' || dot?.type !== 'rect') throw new Error('missing masthead parts')
    const inkEnd = head.left + measure(head.text, head.fontSize)
    expect(dot.left).toBeGreaterThan(inkEnd)
    expect(dot.left - inkEnd).toBeLessThan(head.fontSize * 0.1)
    expect(dot.top + dot.height).toBeGreaterThan(head.top + head.fontSize * 0.7)
    expect(dot.top + dot.height).toBeLessThan(head.top + head.fontSize)
  })

  it('places transit stations on 3-column spans (4 stations — never 5)', () => {
    expect(SWISS_STATIONS).toHaveLength(4)
    const grid = swissGrid(3508)
    const stations = buildSwissPoster(3508, 4961, measure).filter((spec) => spec.name.startsWith('Station'))
    expect(stations.map((spec) => (spec.type === 'text' ? spec.left : 0))).toEqual([1, 4, 7, 10].map(grid.x))
  })

  it('starts every text and rule on a column line', () => {
    const grid = swissGrid(3508)
    const lines = Array.from({ length: 12 }, (_, i) => grid.x(i + 1))
    for (const spec of buildSwissPoster(3508, 4961, measure)) {
      if (spec.type !== 'text' || spec.name === 'Oversized headline') continue // masthead is optically nudged
      expect(lines.some((line) => Math.abs(line - spec.left) < 0.01)).toBe(true)
    }
  })

  it.each(PRESETS)('stays inside the page on $name without overlapping bands', ({ width, height }) => {
    const specs = buildSwissPoster(width, height, measure)
    for (const spec of specs) {
      const box = bounds(spec)
      if (!box) continue
      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.top).toBeGreaterThanOrEqual(0)
      expect(box.right).toBeLessThanOrEqual(width + 0.5)
      expect(box.bottom).toBeLessThanOrEqual(height + 0.5)
    }
    const purpose = specs.find((spec) => spec.name === 'Purpose')
    const material = specs.find((spec) => spec.name === 'Material 01')
    if (purpose?.type !== 'text' || material?.type !== 'text') throw new Error('missing bands')
    // Three wrapped lines of purpose copy must clear the numerals band.
    expect(purpose.top + purpose.fontSize * 1.13 * purpose.lineHeight * 3).toBeLessThan(material.top)
  })
})
