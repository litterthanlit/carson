import { describe, expect, it } from 'vitest'
import { createSeededRandom } from './random'
import {
  applyDisplacement,
  applyDrag,
  applySpatialPasses,
  buildDisplacementField,
  COPY_MACHINE_DEFAULTS,
} from './copyMachine'

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

function createCheckerboard(size: number, cellSize = 8): ImageData {
  const imageData = new ImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const light = (Math.floor(x / cellSize) + Math.floor(y / cellSize)) % 2 === 0
      const value = light ? 255 : 0
      const i = (y * size + x) * 4
      imageData.data[i] = value
      imageData.data[i + 1] = value
      imageData.data[i + 2] = value
      imageData.data[i + 3] = 255
    }
  }
  return imageData
}

function imageDataDigest(data: Uint8ClampedArray): string {
  let hash = 2166136261
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i]
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

describe('copyMachine CM-0', () => {
  it('builds a non-zero displacement field when wobble is active', () => {
    const random = createSeededRandom(FIXTURE_SEED)
    const field = buildDisplacementField(FIXTURE_SIZE, FIXTURE_SIZE, { wobble: 60, wobbleFreq: 50 }, random)
    expect(field.length).toBe(FIXTURE_SIZE * FIXTURE_SIZE * 2)

    let maxOffset = 0
    for (let i = 0; i < field.length; i++) {
      maxOffset = Math.max(maxOffset, Math.abs(field[i]))
    }
    expect(maxOffset).toBeGreaterThan(0.5)
  })

  it('returns a zero field when wobble is off', () => {
    const random = createSeededRandom(FIXTURE_SEED)
    const field = buildDisplacementField(FIXTURE_SIZE, FIXTURE_SIZE, { wobble: 0, wobbleFreq: 50 }, random)
    for (const value of field) {
      expect(value).toBe(0)
    }
  })

  it('warps checkerboard edges via displacement', () => {
    const source = createCheckerboard(FIXTURE_SIZE)
    const random = createSeededRandom(FIXTURE_SEED)
    const field = buildDisplacementField(
      FIXTURE_SIZE,
      FIXTURE_SIZE,
      { wobble: COPY_MACHINE_DEFAULTS.wobble, wobbleFreq: COPY_MACHINE_DEFAULTS.wobbleFreq },
      random,
    )
    const warped = applyDisplacement(source, field)

    const edgeIndex = (16 * FIXTURE_SIZE + 32) * 4
    expect(warped.data[edgeIndex]).not.toBe(source.data[edgeIndex])

    let changed = 0
    for (let i = 0; i < warped.data.length; i++) {
      if (warped.data[i] !== source.data[i]) changed++
    }
    expect(changed).toBeGreaterThan(100)
  })

  it('smears along the drag axis', () => {
    const source = createCheckerboard(FIXTURE_SIZE)
    const random = createSeededRandom(FIXTURE_SEED)
    const dragged = applyDrag(source, { drag: 70, dragAngle: 90 }, random)

    let changed = 0
    for (let i = 0; i < dragged.data.length; i++) {
      if (dragged.data[i] !== source.data[i]) changed++
    }
    expect(changed).toBeGreaterThan(100)
  })

  it('is byte-identical across two runs with the same seed', () => {
    const source = createCheckerboard(FIXTURE_SIZE)
    const params = {
      wobble: COPY_MACHINE_DEFAULTS.wobble,
      wobbleFreq: COPY_MACHINE_DEFAULTS.wobbleFreq,
      drag: COPY_MACHINE_DEFAULTS.drag,
      dragAngle: COPY_MACHINE_DEFAULTS.dragAngle,
    }

    const run = () => applySpatialPasses(source, params, createSeededRandom(FIXTURE_SEED))
    const first = run()
    const second = run()

    expect(Array.from(first.data)).toEqual(Array.from(second.data))
    expect(imageDataDigest(first.data)).toBe(imageDataDigest(second.data))
  })

  it('matches golden pixel samples for the CM-0 fixture', () => {
    const source = createCheckerboard(FIXTURE_SIZE)
    const result = applySpatialPasses(
      source,
      {
        wobble: 55,
        wobbleFreq: 62,
        drag: 48,
        dragAngle: 90,
      },
      createSeededRandom(FIXTURE_SEED),
    )

    const samples = [
      result.data[(8 * FIXTURE_SIZE + 8) * 4],
      result.data[(8 * FIXTURE_SIZE + 9) * 4],
      result.data[(24 * FIXTURE_SIZE + 40) * 4],
      result.data[(40 * FIXTURE_SIZE + 24) * 4],
      result.data[(55 * FIXTURE_SIZE + 55) * 4],
    ]

    expect(samples).toEqual([255, 255, 144, 0, 54])
    expect(imageDataDigest(result.data)).toBe('6c53b600')
  })
})
