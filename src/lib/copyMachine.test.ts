import { describe, expect, it } from 'vitest'
import { createSeededRandom } from './random'
import { gridTensionScale } from './grid'
import {
  applyDisplacement,
  applyDrag,
  applySpatialPasses,
  applyTonalPasses,
  buildDisplacementField,
  COPY_MACHINE_DEFAULTS,
  copyMachineGhostDelta,
  copyMachineGhostOpacity,
  copyMachineLayerSeeds,
  copyMachineParamsFromGeneration,
  copyMachineParamsFromRecord,
  copyMachinePixelScale,
  copyMachineTensionScale,
  misprintCompanionPose,
  renderCopyMachineGhostPass,
  renderCopyMachinePass,
  applyCopyMachineChain,
  isOpaqueSource,
  resampleGeneration,
  scaleCopyMachineParams,
} from './copyMachine'

const FIXTURE_SIZE = 64
const FIXTURE_SEED = 4719
// Re-baselined when drag became scan drift (the original moving under the bar).
const GOLDEN_SAMPLES = [254, 255, 125, 13, 112]
const GOLDEN_DIGEST = 'dc7c8100'

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

    expect(samples).toEqual(GOLDEN_SAMPLES)
    expect(imageDataDigest(result.data)).toBe(GOLDEN_DIGEST)
  })

  it('maps treatment params with defaults', () => {
    expect(copyMachineParamsFromRecord({ wobble: 80 })).toMatchObject({
      wobble: 80,
      drag: COPY_MACHINE_DEFAULTS.drag,
    })
  })

  it('applies tonal passes deterministically', () => {
    const source = createCheckerboard(FIXTURE_SIZE)
    const random = createSeededRandom(FIXTURE_SEED)
    const first = applyTonalPasses(source, COPY_MACHINE_DEFAULTS, random)
    const second = applyTonalPasses(source, COPY_MACHINE_DEFAULTS, createSeededRandom(FIXTURE_SEED))
    expect(Array.from(first.data)).toEqual(Array.from(second.data))
    expect(imageDataDigest(first.data)).not.toBe(imageDataDigest(source.data))
  })

  it('renders a full copy machine pass', () => {
    const source = createCheckerboard(FIXTURE_SIZE)
    const result = renderCopyMachinePass(source, COPY_MACHINE_DEFAULTS, createSeededRandom(FIXTURE_SEED))
    expect(imageDataDigest(result.data)).not.toBe(imageDataDigest(source.data))
  })
})

describe('copyMachine CM-2 ghost', () => {
  it('maps ghost opacity and offset from params', () => {
    expect(copyMachineGhostOpacity(0)).toBe(0)
    expect(copyMachineGhostOpacity(50)).toBeCloseTo(0.2)
    expect(copyMachineGhostOpacity(100)).toBeCloseTo(0.4)
    expect(copyMachineGhostDelta(10)).toEqual({ dx: 10, dy: -4.5 })
  })

  it('shares misprint companion pose with the stack instrument', () => {
    expect(
      misprintCompanionPose({
        left: 100,
        top: 200,
        angle: 12,
        offset: 10,
        opacity: 0.22,
      }),
    ).toEqual({
      left: 110,
      top: 195.5,
      angle: 10.2,
      opacity: 0.22,
      globalCompositeOperation: 'multiply',
    })
  })

  it('ghost pass is tonal-only and deterministic', () => {
    const source = createCheckerboard(FIXTURE_SIZE)
    const params = COPY_MACHINE_DEFAULTS
    const first = renderCopyMachineGhostPass(source, params, createSeededRandom(FIXTURE_SEED))
    const second = renderCopyMachineGhostPass(source, params, createSeededRandom(FIXTURE_SEED))
    const full = renderCopyMachinePass(source, params, createSeededRandom(FIXTURE_SEED))
    const tonal = applyTonalPasses(source, params, createSeededRandom(FIXTURE_SEED))

    expect(Array.from(first.data)).toEqual(Array.from(second.data))
    expect(Array.from(first.data)).toEqual(Array.from(tonal.data))
    expect(imageDataDigest(first.data)).not.toBe(imageDataDigest(full.data))
  })

  it('chains enabled copy-machine steps with the same pixels as a single pass', () => {
    const source = createCheckerboard(FIXTURE_SIZE)
    const params = COPY_MACHINE_DEFAULTS
    const direct = renderCopyMachinePass(source, params, createSeededRandom(FIXTURE_SEED))
    const chained = applyCopyMachineChain(
      source,
      [{ seed: FIXTURE_SEED, enabled: true, params: { ...params } }],
    )
    expect(Array.from(chained.data)).toEqual(Array.from(direct.data))
  })

  it('resolves defaults for ghost params', () => {
    expect(copyMachineParamsFromRecord({})).toMatchObject({
      ghost: COPY_MACHINE_DEFAULTS.ghost,
      ghostOffset: COPY_MACHINE_DEFAULTS.ghostOffset,
    })
  })
})

describe('copyMachineTreatment ghost resolve', () => {
  it('picks the last enabled treatment with ghost > 0', async () => {
    const { resolveCopyMachineGhostParams } = await import('./copyMachineTreatment')
    const result = resolveCopyMachineGhostParams([
      {
        id: 'a',
        type: 'copy-machine',
        seed: 1,
        enabled: true,
        params: { ghost: 40, ghostOffset: 2 },
      },
      {
        id: 'b',
        type: 'copy-machine',
        seed: 2,
        enabled: true,
        params: { ghost: 10, ghostOffset: 8 },
      },
      {
        id: 'c',
        type: 'copy-machine',
        seed: 3,
        enabled: false,
        params: { ghost: 90, ghostOffset: 12 },
      },
    ])
    expect(result).toMatchObject({
      seed: 2,
      params: { ghost: 10, ghostOffset: 8 },
    })
  })

  it('returns null when ghost is off', async () => {
    const { resolveCopyMachineGhostParams } = await import('./copyMachineTreatment')
    expect(
      resolveCopyMachineGhostParams([
        {
          id: 'a',
          type: 'copy-machine',
          seed: 1,
          enabled: true,
          params: { ghost: 0, ghostOffset: 5 },
        },
      ]),
    ).toBeNull()
  })
})

describe('copyMachine CM-3 poster seeds', () => {
  it('derives per-layer seeds from the master seed', () => {
    expect(copyMachineLayerSeeds(4719, 3)).toEqual([4719, 4720, 4721])
    expect(copyMachineLayerSeeds(10, 0)).toEqual([])
    expect(copyMachineLayerSeeds(-1, 2)).toEqual([0xffffffff, 0])
  })

  it('filters poster targets to visible content layers', async () => {
    const { isCopyMachinePosterTarget } = await import('./copyMachineTreatment')
    expect(
      isCopyMachinePosterTarget({
        visible: true,
        id: 'layer-1',
      } as never),
    ).toBe(true)
    expect(
      isCopyMachinePosterTarget({
        visible: false,
        id: 'hidden',
      } as never),
    ).toBe(false)
    expect(
      isCopyMachinePosterTarget({
        visible: true,
        id: 'scrape',
        scrapeFragment: true,
      } as never),
    ).toBe(false)
    expect(
      isCopyMachinePosterTarget({
        visible: true,
        id: 'press',
        pressCheckFragment: true,
      } as never),
    ).toBe(false)
    expect(
      isCopyMachinePosterTarget({
        visible: true,
        id: 'ghost',
        copyGhostSourceId: 'layer-1',
      } as never),
    ).toBe(false)
    expect(
      isCopyMachinePosterTarget({
        visible: true,
        id: 'bake',
        copyMachineSourceId: 'layer-1',
      } as never),
    ).toBe(false)
  })
})

describe('copyMachine tensionScale', () => {
  it('maps grid tension 0..100 to 1×..2×', () => {
    expect(gridTensionScale(0)).toBe(1)
    expect(gridTensionScale(100)).toBe(2)
    expect(gridTensionScale(50)).toBe(1.5)
  })

  it('floors invalid and tiny multipliers', () => {
    expect(copyMachineTensionScale(1)).toBe(1)
    expect(copyMachineTensionScale(2)).toBe(2)
    expect(copyMachineTensionScale(0)).toBe(0.1)
    expect(copyMachineTensionScale(Number.NaN)).toBe(1)
  })

  it('scales intensity params and leaves scan angle alone', () => {
    const scaled = scaleCopyMachineParams(COPY_MACHINE_DEFAULTS, 2)
    expect(scaled.wobble).toBe(COPY_MACHINE_DEFAULTS.wobble * 2)
    expect(scaled.drag).toBe(COPY_MACHINE_DEFAULTS.drag * 2)
    expect(scaled.grain).toBe(COPY_MACHINE_DEFAULTS.grain * 2)
    expect(scaled.ghost).toBe(COPY_MACHINE_DEFAULTS.ghost * 2)
    expect(scaled.ghostOffset).toBe(COPY_MACHINE_DEFAULTS.ghostOffset * 2)
    expect(scaled.dragAngle).toBe(COPY_MACHINE_DEFAULTS.dragAngle)
  })

  it('returns the same object when tension is 1×', () => {
    expect(scaleCopyMachineParams(COPY_MACHINE_DEFAULTS, 1)).toBe(COPY_MACHINE_DEFAULTS)
  })

  it('renders stronger wobble at 2× and stays deterministic', () => {
    const source = createCheckerboard(FIXTURE_SIZE)
    const params = COPY_MACHINE_DEFAULTS
    const baseline = renderCopyMachinePass(source, params, createSeededRandom(FIXTURE_SEED))
    const tense = renderCopyMachinePass(
      source,
      scaleCopyMachineParams(params, 2),
      createSeededRandom(FIXTURE_SEED),
    )
    const tenseAgain = renderCopyMachinePass(
      source,
      scaleCopyMachineParams(params, 2),
      createSeededRandom(FIXTURE_SEED),
    )

    expect(imageDataDigest(tense.data)).not.toBe(imageDataDigest(baseline.data))
    expect(Array.from(tense.data)).toEqual(Array.from(tenseAgain.data))
  })

  it('lets tension push wobble past the 0–100 slider cap', () => {
    const fieldMax = (params: { wobble: number; wobbleFreq: number }) => {
      const field = buildDisplacementField(
        FIXTURE_SIZE,
        FIXTURE_SIZE,
        params,
        createSeededRandom(FIXTURE_SEED),
      )
      let max = 0
      for (const value of field) max = Math.max(max, Math.abs(value))
      return max
    }

    const atCap = fieldMax({ wobble: 100, wobbleFreq: 50 })
    const tensed = fieldMax(
      scaleCopyMachineParams({ ...COPY_MACHINE_DEFAULTS, wobble: 100, wobbleFreq: 50 }, 2),
    )
    expect(atCap).toBeGreaterThan(0.5)
    expect(tensed / atCap).toBeGreaterThan(1.4)
  })
})

describe('copyMachine save/reload + export scale', () => {
  it('scales displacement amplitude with exportScale', () => {
    const params = { wobble: 80, wobbleFreq: 40 }
    const field1 = buildDisplacementField(FIXTURE_SIZE, FIXTURE_SIZE, params, createSeededRandom(FIXTURE_SEED), 1)
    const field4 = buildDisplacementField(FIXTURE_SIZE, FIXTURE_SIZE, params, createSeededRandom(FIXTURE_SEED), 4)

    let max1 = 0
    let max4 = 0
    for (let i = 0; i < field1.length; i++) {
      max1 = Math.max(max1, Math.abs(field1[i]))
      max4 = Math.max(max4, Math.abs(field4[i]))
    }
    expect(max1).toBeGreaterThan(0.5)
    expect(max4 / max1).toBeGreaterThan(3.5)
    expect(copyMachinePixelScale(4)).toBe(4)
    expect(copyMachinePixelScale(0)).toBe(1)
  })

  it('is byte-identical across reload-style re-renders from the same seed', () => {
    const source = createCheckerboard(FIXTURE_SIZE)
    const run = () =>
      renderCopyMachinePass(source, COPY_MACHINE_DEFAULTS, createSeededRandom(FIXTURE_SEED), 1)
    const first = run()
    const second = run()
    expect(Array.from(first.data)).toEqual(Array.from(second.data))
  })

  it('omits baked companions from saved canvas JSON', async () => {
    const { omitCopyMachineCompanionsFromCanvasJSON } = await import('./copyMachineTreatment')
    const saved = omitCopyMachineCompanionsFromCanvasJSON({
      objects: [
        { id: 'headline', treatments: [{ type: 'copy-machine', seed: 4719 }] },
        { id: 'bake', copyMachineSourceId: 'headline' },
        { id: 'ghost', copyGhostSourceId: 'headline' },
        { id: 'xerox', treatments: [{ type: 'xerox', seed: 1 }] },
      ],
    })
    expect(saved.objects?.map((item) => (item as { id: string }).id)).toEqual(['headline', 'xerox'])
  })
})

function blank(size: number, opaque: boolean): ImageData {
  const imageData = new ImageData(size, size)
  for (let i = 0; i < imageData.data.length; i += 4) {
    imageData.data[i] = 255
    imageData.data[i + 1] = 255
    imageData.data[i + 2] = 255
    imageData.data[i + 3] = opaque ? 255 : 0
  }
  return imageData
}

const QUIET = {
  ...COPY_MACHINE_DEFAULTS,
  wobble: 0,
  drag: 0,
  grain: 0,
  bands: 0,
  streaks: 0,
  voids: 0,
  edge: 0,
}

describe('copyMachine toner model', () => {
  it('copies an opaque sheet as paper and a transparent layer as toner only', () => {
    expect(isOpaqueSource(createCheckerboard(FIXTURE_SIZE))).toBe(true)
    expect(isOpaqueSource(blank(FIXTURE_SIZE, false))).toBe(false)

    const sheet = applyTonalPasses(createCheckerboard(FIXTURE_SIZE), QUIET, createSeededRandom(1))
    expect(sheet.data[3]).toBe(255)

    const type = new ImageData(FIXTURE_SIZE, FIXTURE_SIZE)
    for (let y = 20; y < 40; y++) {
      for (let x = 10; x < 54; x++) type.data[(y * FIXTURE_SIZE + x) * 4 + 3] = 255
    }
    const toner = applyTonalPasses(type, QUIET, createSeededRandom(1))
    expect(toner.data[(30 * FIXTURE_SIZE + 30) * 4 + 3]).toBeGreaterThan(240)
    expect(toner.data[(5 * FIXTURE_SIZE + 5) * 4 + 3]).toBe(0)
  })

  it('spreads toner so a hairline comes out thicker', () => {
    const line = new ImageData(FIXTURE_SIZE, FIXTURE_SIZE)
    for (let y = 0; y < FIXTURE_SIZE; y++) line.data[(y * FIXTURE_SIZE + 32) * 4 + 3] = 255
    const inked = (image: ImageData) => {
      let count = 0
      for (let x = 0; x < FIXTURE_SIZE; x++) if (image.data[(32 * FIXTURE_SIZE + x) * 4 + 3] > 64) count++
      return count
    }
    const copy = applyTonalPasses(line, { ...QUIET, contrast: 100 }, createSeededRandom(2))
    expect(inked(copy)).toBeGreaterThan(inked(line))
  })

  it('speckles bare paper with loose toner when grain is up', () => {
    const copy = applyTonalPasses(blank(128, true), { ...QUIET, grain: 100 }, createSeededRandom(3))
    let specks = 0
    for (let i = 0; i < copy.data.length; i += 4) if (copy.data[i] < 128) specks++
    expect(specks).toBeGreaterThan(0)
  })

  it('runs streaks along the scan and bands across it', () => {
    const streaked = applyTonalPasses(blank(96, true), { ...QUIET, streaks: 100, dragAngle: 90 }, createSeededRandom(4))
    // A vertical scan prints streaks as columns: find a dark column hit in most rows.
    let best = 0
    for (let x = 0; x < 96; x++) {
      let dark = 0
      for (let y = 0; y < 96; y++) if (streaked.data[(y * 96 + x) * 4] < 200) dark++
      best = Math.max(best, dark)
    }
    expect(best).toBeGreaterThan(40)
  })

  it('brings the lid shadow in from the frame', () => {
    const copy = applyTonalPasses(blank(100, true), { ...QUIET, edge: 80 }, createSeededRandom(5))
    expect(copy.data[(50 * 100 + 0) * 4]).toBeLessThan(80)
    expect(copy.data[(50 * 100 + 50) * 4]).toBe(255)
  })
})

describe('copyMachine generations', () => {
  it('reduces about the centre and leaves white glass around an opaque sheet', () => {
    const reduced = resampleGeneration(createCheckerboard(FIXTURE_SIZE), 50)
    expect(reduced.data[3]).toBe(255)
    expect(reduced.data[0]).toBe(255)
  })

  it('keeps a transparent layer transparent outside the reduced copy', () => {
    const type = new ImageData(FIXTURE_SIZE, FIXTURE_SIZE)
    for (let y = 16; y < 48; y++) {
      for (let x = 16; x < 48; x++) type.data[(y * FIXTURE_SIZE + x) * 4 + 3] = 255
    }
    const reduced = resampleGeneration(type, 50)
    expect(reduced.data[3]).toBe(0)
    expect(reduced.data[(32 * FIXTURE_SIZE + 32) * 4 + 3]).toBeGreaterThan(200)
  })

  it('degrades further with each generation, deterministically', () => {
    const source = createCheckerboard(FIXTURE_SIZE)
    const once = renderCopyMachinePass(source, { ...QUIET, contrast: 80 }, createSeededRandom(6))
    const four = () => renderCopyMachinePass(source, { ...QUIET, contrast: 80, generations: 4, copyScale: 110 }, createSeededRandom(6))
    expect(imageDataDigest(four().data)).toBe(imageDataDigest(four().data))
    expect(imageDataDigest(four().data)).not.toBe(imageDataDigest(once.data))
  })

  it('reads older saved treatments without the new params', () => {
    const params = copyMachineParamsFromRecord({ wobble: 10 })
    expect(params.generations).toBe(1)
    expect(params.copyScale).toBe(100)
    expect(params.streaks).toBe(COPY_MACHINE_DEFAULTS.streaks)
    expect(params.edge).toBe(0)
  })
})

describe('copyMachine scan drift', () => {
  it('shifts the original along the slip rather than blurring every row the same', () => {
    const source = createCheckerboard(FIXTURE_SIZE)
    const drifted = applyDrag(source, { drag: 100, dragAngle: 0 }, createSeededRandom(7))
    let changedRows = 0
    for (let y = 0; y < FIXTURE_SIZE; y++) {
      let changed = false
      for (let x = 0; x < FIXTURE_SIZE; x++) {
        const i = (y * FIXTURE_SIZE + x) * 4
        if (drifted.data[i] !== source.data[i]) changed = true
      }
      if (changed) changedRows++
    }
    expect(changedRows).toBeGreaterThan(FIXTURE_SIZE / 2)
  })
})

describe('xerox through the copier', () => {
  it('degrades with each generation', () => {
    const early = copyMachineParamsFromGeneration(1)
    const late = copyMachineParamsFromGeneration(10)
    expect(late.generations).toBeGreaterThan(early.generations)
    expect(late.contrast).toBeGreaterThan(early.contrast)
    expect(late.grain).toBeGreaterThan(early.grain)
    expect(early.drag).toBe(0)
    expect(late.drag).toBeGreaterThan(0)
    expect(late.ghost).toBe(0)
  })

  it('clamps out-of-range generations', () => {
    expect(copyMachineParamsFromGeneration(99)).toEqual(copyMachineParamsFromGeneration(10))
    expect(copyMachineParamsFromGeneration(Number.NaN)).toEqual(copyMachineParamsFromGeneration(5))
  })
})
