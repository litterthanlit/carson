import { describe, expect, it } from 'vitest'
import {
  applyInkLoad,
  featureTransform,
  inkDistanceField,
  inkLoadField,
  inkLoadIsIdle,
  localInkWidths,
  strokeHalfWidth,
} from './inkBleed'
import { createSeededRandom } from './random'

function plane(width: number, height: number, paint: (x: number, y: number) => number): Float32Array {
  const out = new Float32Array(width * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) out[y * width + x] = paint(x, y)
  return out
}

/** A ring — an "O" with a counter `hole` px across. */
function ring(size: number, outer: number, hole: number): Float32Array {
  const c = size / 2
  return plane(size, size, (x, y) => {
    const r = Math.hypot(x + 0.5 - c, y + 0.5 - c)
    return r <= outer && r >= hole / 2 ? 1 : 0
  })
}

function coverage(values: Float32Array): number {
  let sum = 0
  for (const value of values) sum += value
  return sum
}

function countingRandom(seed: number) {
  const random = createSeededRandom(seed)
  let calls = 0
  return {
    random: () => {
      calls++
      return random()
    },
    calls: () => calls,
  }
}

describe('featureTransform', () => {
  it('matches a brute-force nearest-pixel search', () => {
    const width = 23
    const height = 17
    const random = createSeededRandom(5)
    const feature = new Uint8Array(width * height)
    for (let i = 0; i < feature.length; i++) feature[i] = random() < 0.06 ? 1 : 0
    const { distance, nearest } = featureTransform(feature, width, height)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let best = Infinity
        for (let j = 0; j < feature.length; j++) {
          if (!feature[j]) continue
          best = Math.min(best, Math.hypot((j % width) - x, Math.floor(j / width) - y))
        }
        const i = y * width + x
        expect(distance[i]).toBeCloseTo(best, 4)
        const n = nearest[i]
        expect(feature[n]).toBe(1)
        expect(Math.hypot((n % width) - x, Math.floor(n / width) - y)).toBeCloseTo(best, 4)
      }
    }
  })

  it('reports no feature as infinitely far', () => {
    const { distance, nearest } = featureTransform(new Uint8Array(12), 4, 3)
    expect([...distance].every((value) => value === Infinity)).toBe(true)
    expect([...nearest].every((value) => value === -1)).toBe(true)
  })
})

describe('inkDistanceField', () => {
  it('is negative inside a stroke, positive outside, and measures to the edge', () => {
    // A vertical bar covering x = 10..19.
    const ink = plane(30, 12, (x) => (x >= 10 && x < 20 ? 1 : 0))
    const { signed } = inkDistanceField(ink, 30, 12)
    const at = (x: number) => signed[6 * 30 + x]
    expect(at(14)).toBeLessThan(0)
    expect(at(4)).toBeGreaterThan(0)
    // Pixel centre 4.5 px inside the left edge (edge at x = 10).
    expect(at(14)).toBeCloseTo(-4.5, 5)
    // Pixel centre at x = 4.5 sits 5.5 px outside it.
    expect(at(4)).toBeCloseTo(5.5, 5)
  })
})

describe('stroke weight', () => {
  it('reads the half-width of a stroke from its centre line', () => {
    const ink = plane(60, 40, (x) => (x >= 20 && x < 32 ? 1 : 0))
    const { signed } = inkDistanceField(ink, 60, 40)
    expect(strokeHalfWidth(signed, 60, 40)).toBeCloseTo(6, 0)
  })

  it('gives every stroke its own weight, even beside a slab of black', () => {
    const width = 120
    const height = 60
    // A 2 px rule at x = 10..11 and a 40 px slab at x = 60..99.
    const ink = plane(width, height, (x) => ((x >= 10 && x < 12) || (x >= 60 && x < 100) ? 1 : 0))
    const field = inkDistanceField(ink, width, height)
    const { stroke } = localInkWidths(field, width, height, 12)
    const row = 30 * width
    expect(stroke[row + 10]).toBeLessThan(2)
    // Paper next to the rule takes the rule's weight…
    expect(stroke[row + 14]).toBeLessThan(2)
    // …and paper next to the slab the slab's.
    expect(stroke[row + 56]).toBeGreaterThan(15)
    // A slab floods no further than a few typical strokes.
    expect(localInkWidths(field, width, height, 4).stroke[row + 56]).toBeLessThanOrEqual(10)
  })

  it('measures the letter gap an edge faces', () => {
    const width = 100
    const height = 40
    // Two 20 px strokes 6 px apart, open paper on their outer sides.
    const ink = plane(width, height, (x) => ((x >= 20 && x < 40) || (x >= 46 && x < 66) ? 1 : 0))
    const field = inkDistanceField(ink, width, height)
    const { gap } = localInkWidths(field, width, height, 10)
    const row = 20 * width
    // Inside the 6 px gap: half of it.
    expect(gap[row + 42]).toBeGreaterThanOrEqual(2.5)
    expect(gap[row + 42]).toBeLessThanOrEqual(3.5)
    // Facing open paper: as wide as the cap allows.
    expect(gap[row + 12]).toBeGreaterThan(15)
  })
})

describe('inkLoadField', () => {
  it('stays within -1..1 and leans wet or dry with the settings', () => {
    const wet = inkLoadField(200, 120, { bleed: 80, starve: 0, dragAngle: 0 }, 6, createSeededRandom(3))
    const dry = inkLoadField(200, 120, { bleed: 0, starve: 80, dragAngle: 0 }, 6, createSeededRandom(3))
    const mean = (field: Float32Array) => coverage(field) / field.length
    expect(Math.max(...wet)).toBeLessThanOrEqual(1)
    expect(Math.min(...dry)).toBeGreaterThanOrEqual(-1)
    expect(mean(wet)).toBeGreaterThan(0.4)
    expect(mean(dry)).toBeLessThan(-0.4)
  })

  it('varies more across the feed than along it', () => {
    const width = 400
    const height = 400
    const field = inkLoadField(width, height, { bleed: 60, starve: 60, dragAngle: 0 }, 8, createSeededRandom(9))
    let alongX = 0
    let alongY = 0
    for (let y = 1; y < height; y++) {
      for (let x = 1; x < width; x++) {
        const i = y * width + x
        alongX += Math.abs(field[i] - field[i - 1])
        alongY += Math.abs(field[i] - field[i - width])
      }
    }
    // Feed along x: ink trains run long horizontally, so lines of type differ.
    expect(alongY).toBeGreaterThan(alongX * 2)
  })
})

describe('applyInkLoad', () => {
  it('changes nothing and draws no random numbers when idle', () => {
    const ink = ring(48, 18, 10)
    const counter = countingRandom(1)
    expect(inkLoadIsIdle({ bleed: 0, starve: 0, slur: 0 })).toBe(true)
    const result = applyInkLoad(ink, 48, 48, { bleed: 0, starve: 0, slur: 0 }, counter.random)
    expect([...result.ink]).toEqual([...ink])
    expect(counter.calls()).toBe(0)
    expect(result.ink).not.toBe(ink)
  })

  it('floods counters shut and never lifts ink when only bleeding', () => {
    const size = 64
    const ink = ring(size, 22, 8)
    const { ink: out, wet } = applyInkLoad(ink, size, size, { bleed: 100, starve: 0, slur: 0 }, createSeededRandom(2))
    const centre = (size / 2) * size + size / 2
    expect(out[centre]).toBeGreaterThan(0.5)
    expect(coverage(out)).toBeGreaterThan(coverage(ink) * 1.2)
    for (let i = 0; i < ink.length; i++) expect(out[i]).toBeGreaterThanOrEqual(ink[i] - 1e-6)
    expect(Math.max(...wet)).toBeGreaterThan(0.5)
  })

  it('starves strokes thinner and never adds ink when only starving', () => {
    const width = 160
    const height = 60
    const ink = plane(width, height, (x, y) => (y >= 15 && y < 45 && x % 20 < 12 ? 1 : 0))
    const { ink: out } = applyInkLoad(ink, width, height, { bleed: 0, starve: 100, slur: 0 }, createSeededRandom(4))
    expect(coverage(out)).toBeLessThan(coverage(ink) * 0.85)
    for (let i = 0; i < ink.length; i++) expect(out[i]).toBeLessThanOrEqual(ink[i] + 1e-6)
  })

  it('slurs ink only downstream along the feed', () => {
    const width = 120
    const height = 40
    const ink = plane(width, height, (x, y) => (x >= 30 && x < 42 && y >= 8 && y < 32 ? 1 : 0))
    const { ink: out } = applyInkLoad(ink, width, height, { bleed: 0, starve: 0, slur: 100, dragAngle: 0 }, createSeededRandom(6))
    let added = 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x
        if (out[i] <= ink[i] + 1e-3) continue
        added++
        // Feed runs toward +x, so dragged ink always lies right of its stroke, on its row.
        expect(x).toBeGreaterThanOrEqual(42)
        expect(y).toBeGreaterThanOrEqual(8)
        expect(y).toBeLessThan(32)
      }
    }
    expect(added).toBeGreaterThan(0)
  })

  it('is deterministic per seed', () => {
    const ink = ring(56, 20, 9)
    const params = { bleed: 70, starve: 60, slur: 40, dragAngle: 0 }
    const a = applyInkLoad(ink, 56, 56, params, createSeededRandom(11)).ink
    const b = applyInkLoad(ink, 56, 56, params, createSeededRandom(11)).ink
    const c = applyInkLoad(ink, 56, 56, params, createSeededRandom(12)).ink
    expect([...a]).toEqual([...b])
    expect([...a]).not.toEqual([...c])
  })

  it('keeps coverage within 0..1', () => {
    const ink = plane(80, 50, (x, y) => ((x * 7 + y * 3) % 11) / 10)
    const { ink: out } = applyInkLoad(ink, 80, 50, { bleed: 200, starve: 200, slur: 200 }, createSeededRandom(8))
    for (const value of out) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })
})
