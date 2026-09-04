import { describe, expect, it } from 'vitest'
import { createSeededRandom } from './random'
import { gridTensionScale } from './grid'
import {
  applyInkSpread,
  applyMisregistration,
  applyPaperTooth,
  PRESS_CHECK_DEFAULTS,
  pressCheckParamsFromRecord,
  pressCheckParamsToRecord,
  pressCheckPixelScale,
  pressCheckTensionScale,
  renderPressCheckPass,
  scalePressCheckParams,
} from './pressCheck'

const FIXTURE_SIZE = 64
const FIXTURE_SEED = 4719

class ImageDataPolyfill {
  readonly width: number
  readonly height: number
  readonly data: Uint8ClampedArray

  constructor(
    dataOrWidth: Uint8ClampedArray | number,
    widthOrHeight?: number,
    height?: number,
  ) {
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

function createTypeBlock(size: number): ImageData {
  const imageData = new ImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const glyph = x > 16 && x < 48 && y > 18 && y < 46
      const value = glyph ? 18 : 242
      const i = (y * size + x) * 4
      imageData.data[i] = value
      imageData.data[i + 1] = glyph ? 12 : 236
      imageData.data[i + 2] = glyph ? 10 : 228
      imageData.data[i + 3] = 255
    }
  }
  return imageData
}

function meanChannel(data: Uint8ClampedArray, channel: number): number {
  let sum = 0
  let count = 0
  for (let i = channel; i < data.length; i += 4) {
    sum += data[i]
    count += 1
  }
  return sum / count
}

describe('pressCheck', () => {
  it('spreads ink by darkening neighboring paper without lightening the type', () => {
    const source = createTypeBlock(FIXTURE_SIZE)
    const spread = applyInkSpread(source, 80, 1)
    const edge = (22 * FIXTURE_SIZE + 16) * 4
    expect(spread.data[edge]).toBeLessThan(source.data[edge])
    const core = (32 * FIXTURE_SIZE + 32) * 4
    expect(spread.data[core]).toBeLessThanOrEqual(source.data[core])
  })

  it('shifts color plates so RGB channels diverge at glyph edges', () => {
    const source = createTypeBlock(FIXTURE_SIZE)
    const plates = applyMisregistration(source, 80, createSeededRandom(FIXTURE_SEED), 1)
    let splits = 0
    for (let i = 0; i < plates.data.length; i += 4) {
      if (plates.data[i] !== plates.data[i + 1] || plates.data[i] !== plates.data[i + 2]) splits += 1
    }
    expect(splits).toBeGreaterThan(40)
  })

  it('multiplies paper tooth without changing stored params', () => {
    const source = createTypeBlock(FIXTURE_SIZE)
    const params = { ...PRESS_CHECK_DEFAULTS }
    const tooth = applyPaperTooth(source, params.paperTooth, createSeededRandom(FIXTURE_SEED), 1)
    expect(params.paperTooth).toBe(PRESS_CHECK_DEFAULTS.paperTooth)
    expect(meanChannel(tooth.data, 0)).not.toBe(meanChannel(source.data, 0))
  })

  it('is byte-identical across two runs from the same seed', () => {
    const source = createTypeBlock(FIXTURE_SIZE)
    const run = () =>
      renderPressCheckPass(source, PRESS_CHECK_DEFAULTS, createSeededRandom(FIXTURE_SEED), 1)
    expect(Array.from(run().data)).toEqual(Array.from(run().data))
  })

  it('scales misregistration amplitude with export DPI', () => {
    const source = createTypeBlock(FIXTURE_SIZE)
    const at1 = applyMisregistration(source, 100, createSeededRandom(FIXTURE_SEED), 1)
    const at4 = applyMisregistration(source, 100, createSeededRandom(FIXTURE_SEED), 4)
    let delta1 = 0
    let delta4 = 0
    for (let i = 0; i < source.data.length; i += 4) {
      delta1 += Math.abs(at1.data[i] - source.data[i])
      delta4 += Math.abs(at4.data[i] - source.data[i])
    }
    expect(delta4).toBeGreaterThan(delta1)
    expect(pressCheckPixelScale(4)).toBe(4)
    expect(pressCheckPixelScale(0)).toBe(1)
  })

  it('lets Tension multiply intensity without mutating stored params', () => {
    const stored = pressCheckParamsFromRecord(pressCheckParamsToRecord(PRESS_CHECK_DEFAULTS))
    const restless = scalePressCheckParams(stored, pressCheckTensionScale(gridTensionScale(100)))
    expect(stored.inkSpread).toBe(PRESS_CHECK_DEFAULTS.inkSpread)
    expect(restless.inkSpread).toBeCloseTo(PRESS_CHECK_DEFAULTS.inkSpread * 2)
    expect(restless.misregistration).toBeCloseTo(PRESS_CHECK_DEFAULTS.misregistration * 2)
    expect(restless.paperTooth).toBeCloseTo(PRESS_CHECK_DEFAULTS.paperTooth * 2)
  })
})
