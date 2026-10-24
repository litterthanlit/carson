import { describe, expect, it } from 'vitest'
import { applyTonalPasses, COPY_MACHINE_DEFAULTS } from './copyMachine'
import { sheetDecayMarks } from './decayMarksTreatment'
import { getLayerDecayProfile, getPrintScanProfile } from './editorModel'
import {
  bindPress,
  distanceToFold,
  pressBands,
  pressExposureAt,
  pressFolds,
  pressStreaks,
  pressWearAt,
  pressWearChips,
  sheetFeedCoords,
} from './press'
import { createPressScanArtifacts } from './pressSurface'
import { decayProfileOnPress, xeroxProfileOnPress } from './treatments'
import { createSeededRandom } from './random'

class ImageDataPolyfill {
  readonly width: number
  readonly height: number
  readonly data: Uint8ClampedArray

  constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight?: number, height?: number) {
    if (typeof dataOrWidth === 'number') {
      this.width = dataOrWidth
      this.height = widthOrHeight ?? dataOrWidth
      this.data = new Uint8ClampedArray(this.width * this.height * 4)
      return
    }
    this.data = dataOrWidth
    this.width = widthOrHeight ?? 0
    this.height = height ?? 0
  }
}

if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = ImageDataPolyfill as typeof ImageData
}

const press = bindPress({ seed: 2024, feedAngle: 90 }, { width: 600, height: 800 })

function paper(width: number, height: number): ImageData {
  const image = new ImageData(width, height)
  image.data.fill(255)
  return image
}

/** Only the drum: no grain, toner screen or ink, so what prints is the press's marks alone. */
const DRUM_ONLY = { ...COPY_MACHINE_DEFAULTS, contrast: 0, grain: 0, voids: 0, bands: 0, streaks: 0, edge: 0, bleed: 0, starve: 0, slur: 0 }

describe('the drum on the press', () => {
  it('keeps its bands and streaks in place as the settings rise', () => {
    expect(pressBands(press, 10).slice(0, 4)).toEqual(pressBands(press, 4))
    expect(pressStreaks(press, 12).slice(0, 5)).toEqual(pressStreaks(press, 5))
    const darks = pressStreaks(press, 32).filter((streak) => streak.dark).length
    expect(darks).toBeGreaterThan(10)
    expect(darks).toBeLessThan(30)
  })

  it('runs a streak through every layer copied across it', () => {
    // Feed runs down the sheet, so streaks are vertical lines at fixed x.
    const left = applyTonalPasses(paper(100, 60), { ...DRUM_ONLY, streaks: 100 }, createSeededRandom(1), 1, {
      press,
      originX: 280,
      originY: 300,
      unit: 1,
    })
    const right = applyTonalPasses(paper(100, 60), { ...DRUM_ONLY, streaks: 100 }, createSeededRandom(2), 1, {
      press,
      originX: 330,
      originY: 300,
      unit: 1,
    })
    let marked = 0
    for (let y = 0; y < 60; y++) {
      for (let x = 0; x < 50; x++) {
        const a = left.data[(y * 100 + x + 50) * 4]
        const b = right.data[(y * 100 + x) * 4]
        expect(Math.abs(a - b)).toBeLessThanOrEqual(1)
        if (a < 250) marked++
      }
    }
    expect(marked).toBeGreaterThan(0)
  })

  it('starves the same bands on neighbouring layers', () => {
    const across = bindPress({ seed: 77, feedAngle: 0 }, { width: 600, height: 400 })
    const params = { ...DRUM_ONLY, contrast: 60, bands: 100 }
    const solid = () => {
      const image = new ImageData(120, 40)
      for (let i = 3; i < image.data.length; i += 4) image.data[i] = 255
      return image
    }
    const a = applyTonalPasses(solid(), params, createSeededRandom(3), 1, { press: across, originX: 100, originY: 100, unit: 1 })
    const b = applyTonalPasses(solid(), params, createSeededRandom(4), 1, { press: across, originX: 160, originY: 100, unit: 1 })
    for (let y = 5; y < 35; y++) {
      for (let x = 0; x < 60; x++) {
        expect(Math.abs(a.data[(y * 120 + x + 60) * 4 + 3] - b.data[(y * 120 + x) * 4 + 3])).toBeLessThanOrEqual(2)
      }
    }
  })
})

describe('the sheet ages as one', () => {
  it('folds in half across and in half or thirds down, the same every time', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sheet = bindPress({ seed, feedAngle: 0 }, { width: 1000, height: 1400 })
      const folds = pressFolds(sheet)
      expect(folds).toEqual(pressFolds(sheet))
      const across = folds.filter((fold) => fold.axis === 'y')
      expect(across.length === 1 || across.length === 2).toBe(true)
      for (const fold of folds) {
        expect(Math.abs(fold.angle)).toBeLessThanOrEqual(1.2)
        const size = fold.axis === 'x' ? 1000 : 1400
        expect(fold.position).toBeGreaterThan(size * 0.25)
        expect(fold.position).toBeLessThan(size * 0.75)
      }
    }
  })

  it('wears most along its folds and edges', () => {
    const folds = pressFolds(press)
    const near: number[] = []
    const open: number[] = []
    for (let i = 0; i < 400; i++) {
      const x = 40 + ((i * 37) % 520)
      const y = 40 + ((i * 53) % 720)
      const wear = pressWearAt(press, x, y, folds)
      const d = distanceToFold(press, x, y, folds)
      if (d < 6) near.push(wear)
      else if (d > 120 && x > 120 && x < 480 && y > 120 && y < 680) open.push(wear)
    }
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
    expect(near.length).toBeGreaterThan(0)
    expect(mean(near)).toBeGreaterThan(mean(open) + 0.3)
    expect(pressWearAt(press, 2, 2)).toBeGreaterThan(mean(open))
  })

  it('faded most on the side that faced the window', () => {
    const sides = [
      [0.05, 0.5],
      [0.95, 0.5],
      [0.5, 0.05],
      [0.5, 0.95],
    ].map(([u, v]) => {
      let sum = 0
      for (let k = 0; k < 20; k++) sum += pressExposureAt(press, u * 600 + (k - 10), v * 800 + (k - 10) * 2)
      return sum / 20
    })
    const highest = Math.max(...sides)
    const lowest = Math.min(...sides)
    expect(highest - lowest).toBeGreaterThan(0.25)
    for (let i = 0; i < 50; i++) {
      const value = pressExposureAt(press, (i * 97) % 600, (i * 61) % 800)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('chips the same spots for layers that overlap, and a few on any layer', () => {
    const a = pressWearChips(press, { left: 100, top: 100, width: 300, height: 400 }, 0.6)
    const b = pressWearChips(press, { left: 250, top: 100, width: 300, height: 400 }, 0.6)
    const inOverlap = (chip: { x: number; y: number }) => chip.x >= 250 && chip.x <= 400
    const shared = a.filter(inOverlap).filter((chip) => b.some((other) => other.x === chip.x && other.y === chip.y))
    expect(shared.length).toBeGreaterThan(0)
    const tiny = pressWearChips(press, { left: 300, top: 380, width: 60, height: 30 }, 0.4)
    expect(tiny.length).toBeGreaterThanOrEqual(1)
    for (const chip of tiny) {
      expect(chip.x).toBeGreaterThanOrEqual(300)
      expect(chip.x).toBeLessThanOrEqual(360)
    }
    expect(pressWearChips(press, { left: 100, top: 100, width: 300, height: 400 }, 0.6)).toEqual(a)
  })

  it('creases every layer that crosses a fold, on the fold', () => {
    const folds = pressFolds(press)
    const across = folds.find((fold) => fold.axis === 'y')!
    const wide = { id: 'a', left: 50, top: across.position - 100, width: 500, height: 200 }
    const crease = sheetDecayMarks(wide, 55, press).find((mark) => mark.kind === 'fold' && mark.width > 2)
    expect(crease).toBeDefined()
    const tilt = Math.tan((across.angle * Math.PI) / 180)
    expect(crease!.top).toBeCloseTo(across.position + (50 - 300) * tilt, 1)
    // A layer no fold crosses has chips but no creases.
    const corner = { id: 'b', left: 10, top: 10, width: 60, height: 40 }
    const marks = sheetDecayMarks(corner, 55, press)
    expect(marks.some((mark) => mark.kind === 'fold')).toBe(false)
    expect(marks.some((mark) => mark.kind === 'ink-loss')).toBe(true)
  })

  it('ages a layer further where the sheet took more light, and xeroxes harder in wet ink', () => {
    expect(decayProfileOnPress(55)).toEqual(getLayerDecayProfile(55))
    const shade = decayProfileOnPress(55, { exposure: 0.2, density: 0.8 })
    const sun = decayProfileOnPress(55, { exposure: 1, density: 0.8 })
    expect(sun.amount).toBeGreaterThan(shade.amount)
    expect(sun.opacity).toBeLessThan(shade.opacity)
    expect(xeroxProfileOnPress(5)).toEqual(getPrintScanProfile(5))
    const dry = xeroxProfileOnPress(5, { exposure: 0.5, density: 0.56 })
    const wet = xeroxProfileOnPress(5, { exposure: 0.5, density: 1 })
    expect(wet.contrast).toBeGreaterThan(dry.contrast)
    expect(wet.opacity).toBeGreaterThan(dry.opacity)
    expect(wet.opacity).toBeLessThanOrEqual(1)
  })
})

describe('the print-scan surface on the press', () => {
  it('lays its scan bands on the drum’s bands, across the feed', () => {
    const artifacts = createPressScanArtifacts(press, { generation: 5, random: createSeededRandom(9) })
    const bands = artifacts.filter((artifact) => artifact.kind === 'band')
    const drum = pressBands(press, bands.length)
    bands.forEach((band, index) => {
      expect(band.angle).toBe(press.feedAngle)
      expect(sheetFeedCoords(press, band.centerX, band.centerY).u).toBeCloseTo(drum[index].center, 4)
    })
    expect(artifacts.some((artifact) => artifact.kind === 'drift')).toBe(true)
  })
})
