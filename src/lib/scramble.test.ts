import { describe, expect, it } from 'vitest'
import { createSeededRandom } from './random'
import {
  isScrambleSourceLayer,
  scrambleLayout,
  SCRAMBLE_POSTURE_LABELS,
  type ScrambleLayer,
} from './scramble'

const AREA = { width: 1000, height: 1400 }

function layer(id: string, width = 200, height = 80): ScrambleLayer {
  return { id, left: 40, top: 40, width, height, angle: 0 }
}

describe('isScrambleSourceLayer', () => {
  it('keeps unlocked content layers', () => {
    expect(isScrambleSourceLayer({ id: 'text-1', visible: true, selectable: true })).toBe(true)
  })

  it('skips locked, hidden, and treatment artifacts', () => {
    expect(isScrambleSourceLayer({ id: 'text-1', selectable: false })).toBe(false)
    expect(isScrambleSourceLayer({ id: 'text-1', visible: false })).toBe(false)
    expect(isScrambleSourceLayer({ id: 'cut-1', sliceSourceId: 'text-1' })).toBe(false)
    expect(isScrambleSourceLayer({ id: 'ghost-1', copyMachineSourceId: 'text-1' })).toBe(false)
    expect(isScrambleSourceLayer({ id: 'echo-1', misprintSourceId: 'text-1' })).toBe(false)
    expect(isScrambleSourceLayer({ id: 'strip-1', typeStripSourceId: 'text-1' })).toBe(false)
    expect(isScrambleSourceLayer({ scrapeFragment: true, id: 'scrape-1' })).toBe(false)
    expect(isScrambleSourceLayer({ pressCheckFragment: true, id: 'press-1' })).toBe(false)
    expect(isScrambleSourceLayer({})).toBe(false)
  })
})

describe('scrambleLayout', () => {
  const layers = [layer('a', 400, 120), layer('b', 220, 60), layer('c', 180, 90), layer('d', 300, 70)]

  it('is deterministic for the same seed', () => {
    const a = scrambleLayout(layers, AREA, { random: createSeededRandom(4719), tension: 40 })
    const b = scrambleLayout(layers, AREA, { random: createSeededRandom(4719), tension: 40 })
    expect(a).toEqual(b)
    expect(a.transforms).toHaveLength(4)
    expect(a.transforms.map((item) => item.id).sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('changes structure when the seed changes', () => {
    const a = scrambleLayout(layers, AREA, { random: createSeededRandom(1001), tension: 50 })
    const b = scrambleLayout(layers, AREA, { random: createSeededRandom(8800), tension: 50 })
    expect(a.transforms).not.toEqual(b.transforms)
  })

  it('names the posture so the designer can read the idea', () => {
    const result = scrambleLayout(layers, AREA, { random: createSeededRandom(12) })
    expect(Object.values(SCRAMBLE_POSTURE_LABELS)).toContain(result.label)
    expect(result.label).toBe(SCRAMBLE_POSTURE_LABELS[result.posture])
  })

  it('keeps layers on the poster with only modest overflow', () => {
    const result = scrambleLayout(layers, AREA, { random: createSeededRandom(333), tension: 0 })
    for (const transform of result.transforms) {
      const source = layers.find((item) => item.id === transform.id)
      expect(source).toBeTruthy()
      expect(transform.left).toBeGreaterThanOrEqual(-source!.width * 0.12)
      expect(transform.top).toBeGreaterThanOrEqual(-source!.height * 0.12)
      expect(transform.left).toBeLessThan(AREA.width)
      expect(transform.top).toBeLessThan(AREA.height)
    }
  })

  it('returns an empty transform list when there is nothing to arrange', () => {
    const result = scrambleLayout([], AREA, { random: createSeededRandom(1) })
    expect(result.transforms).toEqual([])
  })

  it('assigns unique z ranks so stacking order can change', () => {
    const result = scrambleLayout(layers, AREA, { random: createSeededRandom(90), tension: 20 })
    const zs = result.transforms.map((item) => item.z)
    expect(new Set(zs).size).toBe(zs.length)
  })
})
