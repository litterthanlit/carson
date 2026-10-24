import { describe, expect, it } from 'vitest'
import { applyInkLoad, sheetInkLoadField } from './inkBleed'
import {
  bindCanvasPress,
  bindPress,
  canvasPress,
  newPressRun,
  normalizeFeedAngle,
  pressInkAt,
  pressInkDensityAt,
  pressInkPlane,
  pressRegistration,
  pressSignature,
  readPressRun,
  sheetHash,
  sheetNoise,
  sheetValueAt,
} from './press'
import { createSeededRandom } from './random'

const press = bindPress({ seed: 4242, feedAngle: 0 }, { width: 1200, height: 900 })

describe('press run', () => {
  it('normalises the feed angle and reads stored runs defensively', () => {
    expect(normalizeFeedAngle(-90)).toBe(270)
    expect(normalizeFeedAngle(725)).toBe(5)
    expect(normalizeFeedAngle(Number.NaN)).toBe(0)
    expect(readPressRun({ seed: 7, feedAngle: 90 })).toEqual({ seed: 7, feedAngle: 90 })
    expect(readPressRun({ seed: 7 })).toEqual({ seed: 7, feedAngle: 0 })
    expect(readPressRun({ feedAngle: 90 })).toBeNull()
    expect(readPressRun(null)).toBeNull()
    expect(newPressRun(12, 45)).toEqual({ seed: 12, feedAngle: 45 })
  })

  it('binds to the canvas it prints', () => {
    const canvas = {}
    expect(canvasPress(canvas)).toBeNull()
    bindCanvasPress(canvas, press)
    expect(canvasPress(canvas)).toBe(press)
    bindCanvasPress(canvas, null)
    expect(canvasPress(canvas)).toBeNull()
    expect(pressSignature(press)).toBe('4242/0/1200x900')
    expect(pressSignature(null)).toBe('')
  })
})

describe('sheet noise', () => {
  it('hashes deterministically into -1..1, independently per field', () => {
    const values = Array.from({ length: 200 }, (_, i) => sheetHash(1, 1, i - 100, i * 3))
    expect(values.every((value) => value >= -1 && value < 1)).toBe(true)
    expect(sheetHash(1, 1, 5, 6)).toBe(sheetHash(1, 1, 5, 6))
    expect(sheetHash(1, 1, 5, 6)).not.toBe(sheetHash(1, 2, 5, 6))
    expect(sheetHash(1, 1, 5, 6)).not.toBe(sheetHash(2, 1, 5, 6))
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    expect(Math.abs(mean)).toBeLessThan(0.15)
  })

  it('samples the same field whether read as a plane or point by point', () => {
    const patch = { press: bindPress({ seed: 9, feedAngle: 33 }, { width: 500, height: 500 }), originX: 37, originY: 12, unit: 1.5 }
    const plane = sheetNoise(patch, 40, 30, 23, 9, 3)
    for (const [x, y] of [
      [0, 0],
      [39, 0],
      [17, 11],
      [39, 29],
    ]) {
      const expected = sheetValueAt(patch.press, 3, 37 + (x + 0.5) * 1.5, 12 + (y + 0.5) * 1.5, 23, 9)
      expect(plane[y * 40 + x]).toBeCloseTo(expected, 5)
    }
  })

  it('is seamless between neighbouring layers on the sheet', () => {
    // Two rasters overlapping by 30 poster px: the overlap reads the same ink.
    const left = pressInkPlane({ press, originX: 100, originY: 200, unit: 1 }, 80, 40)
    const right = pressInkPlane({ press, originX: 150, originY: 200, unit: 1 }, 80, 40)
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 30; x++) expect(right[y * 80 + x]).toBeCloseTo(left[y * 80 + x + 50], 5)
    }
    const point = pressInkAt(press, 100 + 10.5, 200 + 20.5)
    expect(left[20 * 80 + 10]).toBeCloseTo(point, 5)
  })

  it('runs ink trains long along the feed and short across it', () => {
    const variation = (feedAngle: number) => {
      const sheet = bindPress({ seed: 31, feedAngle }, { width: 1000, height: 1000 })
      const plane = pressInkPlane({ press: sheet, originX: 0, originY: 0, unit: 2 }, 300, 300)
      let alongX = 0
      let alongY = 0
      for (let y = 1; y < 300; y++) {
        for (let x = 1; x < 300; x++) {
          alongX += Math.abs(plane[y * 300 + x] - plane[y * 300 + x - 1])
          alongY += Math.abs(plane[y * 300 + x] - plane[(y - 1) * 300 + x])
        }
      }
      return { alongX, alongY }
    }
    const horizontal = variation(0)
    expect(horizontal.alongY).toBeGreaterThan(horizontal.alongX * 2)
    const vertical = variation(90)
    expect(vertical.alongX).toBeGreaterThan(vertical.alongY * 2)
  })

  it('prints flat fills between dry and solid', () => {
    for (let i = 0; i < 50; i++) {
      const density = pressInkDensityAt(press, i * 23, i * 17)
      expect(density).toBeGreaterThanOrEqual(0.55)
      expect(density).toBeLessThanOrEqual(1)
    }
  })

  it('slips every plate the same way, mostly along the feed', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      for (const feedAngle of [0, 90]) {
        const run = bindPress({ seed, feedAngle }, { width: 800, height: 600 })
        const slip = pressRegistration(run)
        expect(Math.hypot(slip.dx, slip.dy)).toBeCloseTo(1, 6)
        expect(pressRegistration(run)).toEqual(slip)
        const feed = { dx: Math.cos((feedAngle * Math.PI) / 180), dy: Math.sin((feedAngle * Math.PI) / 180) }
        // Within ~55° of the feed, one way or the other.
        expect(Math.abs(slip.dx * feed.dx + slip.dy * feed.dy)).toBeGreaterThan(0.55)
      }
    }
  })
})

describe('ink on the press', () => {
  function bar(width: number, height: number): Float32Array {
    const ink = new Float32Array(width * height)
    for (let y = 10; y < height - 10; y++) for (let x = 10; x < width - 10; x++) if (x % 24 < 14) ink[y * width + x] = 1
    return ink
  }

  it('reads one load field across layers', () => {
    const a = sheetInkLoadField({ press, originX: 40, originY: 40, unit: 1 }, 60, 30, { bleed: 70, starve: 50 })
    const b = sheetInkLoadField({ press, originX: 70, originY: 40, unit: 1 }, 60, 30, { bleed: 70, starve: 50 })
    for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) expect(b[y * 60 + x]).toBeCloseTo(a[y * 60 + x + 30], 5)
  })

  it('takes its ink from the press, not from the layer’s own seed', () => {
    const ink = bar(120, 60)
    const params = { bleed: 80, starve: 60, slur: 40 }
    const sheet = { press, originX: 300, originY: 120, unit: 1 }
    const one = applyInkLoad(ink, 120, 60, params, createSeededRandom(1), 1, sheet).ink
    const two = applyInkLoad(ink, 120, 60, params, createSeededRandom(2), 1, sheet).ink
    expect([...two]).toEqual([...one])
    // Moved to another part of the sheet, the same layer inks differently.
    const moved = applyInkLoad(ink, 120, 60, params, createSeededRandom(1), 1, { ...sheet, originX: 800 }).ink
    expect([...moved]).not.toEqual([...one])
  })

  it('slurs along the press feed, whatever the layer’s scan angle', () => {
    const width = 120
    const height = 60
    const ink = new Float32Array(width * height)
    for (let y = 20; y < 40; y++) for (let x = 20; x < 40; x++) ink[y * width + x] = 1
    const down = bindPress({ seed: 5, feedAngle: 90 }, { width: 400, height: 400 })
    const out = applyInkLoad(ink, width, height, { slur: 100, dragAngle: 0 }, createSeededRandom(3), 1, {
      press: down,
      originX: 0,
      originY: 0,
      unit: 1,
    }).ink
    let added = 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x
        if (out[i] <= ink[i] + 1e-3) continue
        added++
        // Feed runs down the sheet: dragged ink lies below the square, in its columns.
        expect(y).toBeGreaterThanOrEqual(40)
        expect(x).toBeGreaterThanOrEqual(20)
        expect(x).toBeLessThan(40)
      }
    }
    expect(added).toBeGreaterThan(0)
  })
})
