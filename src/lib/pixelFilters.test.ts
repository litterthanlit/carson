import { describe, expect, it } from 'vitest'
import { filters as fabricFilters } from 'fabric'
import {
  buildFxFilters,
  FX_KINDS,
  fxChipLabel,
  isFxKind,
  isTreatmentFilter,
  THRESHOLD_LEGACY_LEVEL,
  thresholdMatrix,
  motionBlurImageData,
  posterizeImageData,
  radialBlurImageData,
  zoomBlurImageData,
} from './pixelFilters'

function makeBuffer(width: number, height: number, paint: (x: number, y: number, pixel: Uint8ClampedArray) => void) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = data.subarray((y * width + x) * 4, (y * width + x) * 4 + 4)
      paint(x, y, pixel)
    }
  }
  return { data, width, height }
}

describe('pixelFilters', () => {
  it('recognizes fx kinds', () => {
    expect(isFxKind('motion-blur')).toBe(true)
    expect(isFxKind('not-a-filter')).toBe(false)
  })

  it('labels motion blur with angle', () => {
    expect(fxChipLabel('motion-blur', { angle: 45, distance: 32 })).toBe('Motion·45°')
  })

  it('spreads a vertical white line horizontally under motion blur', () => {
    const image = makeBuffer(21, 7, (x, _y, pixel) => {
      const on = x === 10
      pixel[0] = on ? 255 : 0
      pixel[1] = on ? 255 : 0
      pixel[2] = on ? 255 : 0
      pixel[3] = 255
    })
    motionBlurImageData(image, 8, 0)
    const center = image.data[(3 * 21 + 10) * 4] ?? 0
    const beside = image.data[(3 * 21 + 12) * 4] ?? 0
    const far = image.data[(3 * 21 + 20) * 4] ?? 0
    expect(center).toBeGreaterThan(beside)
    expect(beside).toBeGreaterThan(far)
    expect(beside).toBeGreaterThan(0)
  })

  it('radial blur keeps the center pixel', () => {
    const image = makeBuffer(17, 17, (x, y, pixel) => {
      const on = x === 8 && y === 8
      pixel[0] = on ? 255 : 0
      pixel[1] = 0
      pixel[2] = 0
      pixel[3] = 255
    })
    radialBlurImageData(image, 80, 50, 50)
    const center = (8 * 17 + 8) * 4
    expect(image.data[center]).toBeGreaterThan(200)
  })

  it('zoom blur keeps the center pixel', () => {
    const image = makeBuffer(17, 17, (x, y, pixel) => {
      const on = x === 8 && y === 8
      pixel[0] = on ? 255 : 0
      pixel[1] = 0
      pixel[2] = 0
      pixel[3] = 255
    })
    zoomBlurImageData(image, 80, 50, 50)
    const center = (8 * 17 + 8) * 4
    expect(image.data[center]).toBeGreaterThan(200)
  })

  it('posterize collapses mid-gray to a coarse level', () => {
    const image = makeBuffer(2, 1, (_x, _y, pixel) => {
      pixel[0] = 120
      pixel[1] = 120
      pixel[2] = 120
      pixel[3] = 255
    })
    posterizeImageData(image, 2)
    expect(image.data[0]).toBe(0)
  })

  it('builds a non-empty motion-blur filter stack', () => {
    const filters = buildFxFilters('motion-blur', { distance: 40, angle: 15 })
    expect(filters.length).toBe(1)
    expect(filters[0]?.type).toBe('MotionBlur')
  })

  it('builds gaussian, film, and stylize stacks', () => {
    expect(buildFxFilters('gaussian-blur', { radius: 20 }).length).toBe(1)
    expect(buildFxFilters('sepia', {}).length).toBe(1)
    expect(buildFxFilters('watercolor', { amount: 40 }).length).toBeGreaterThan(1)
  })

  it('builds one marked filter for each print-process kind', () => {
    const cases = [
      ['halftone-dots', { cell: 28, angle: 45, contrast: 25 }, 'HalftoneDots'],
      ['risograph', { inks: 0, offset: 20, grain: 35 }, 'Risograph'],
      ['dither', { scale: 8, threshold: 50 }, 'BayerDither'],
      ['rgb-split', { distance: 16, angle: 0 }, 'RgbSplit'],
      ['scan-lines', { spacing: 24, darkness: 55, jitter: 20 }, 'ScanLines'],
      ['duotone', { palette: 1, contrast: 30 }, 'Duotone'],
    ] as const
    for (const [kind, params, type] of cases) {
      expect(isFxKind(kind)).toBe(true)
      const built = buildFxFilters(kind, params)
      expect(built.map((filter) => filter.type)).toEqual([type])
      expect(built.every(isTreatmentFilter)).toBe(true)
    }
    expect(FX_KINDS.every((kind) => buildFxFilters(kind, {}).length > 0)).toBe(true)
  })

  it('keeps fractional pixel params, which arrive scaled down for previews', () => {
    const [dots] = buildFxFilters('halftone-dots', { cell: 4.4, angle: 45, contrast: 25 })
    expect((dots as unknown as { cell: number }).cell).toBeCloseTo(4.4)
    const [split] = buildFxFilters('rgb-split', { distance: 2.5, angle: 0 })
    expect((split as unknown as { distance: number }).distance).toBeCloseTo(2.5)
  })

  it('names palettes and sizes in the treatment chip', () => {
    expect(fxChipLabel('risograph', { inks: 1, offset: 20, grain: 35 })).toBe('Riso·Black + Red')
    expect(fxChipLabel('duotone', { palette: 1, contrast: 30 })).toBe('Duotone·Navy / Cream')
    expect(fxChipLabel('halftone-dots', { cell: 28, angle: 45, contrast: 25 })).toBe('Dots·28')
    expect(fxChipLabel('threshold', { level: 62 })).toBe('Threshold·62')
    expect(fxChipLabel('threshold', {})).toBe('Threshold')
  })

  it('rebuilds saved Threshold treatments, which have no level, exactly as before', () => {
    const legacy = [new fabricFilters.BlackWhite(), new fabricFilters.Contrast({ contrast: 0.2 })]
    const serialize = (list: { toObject: () => object }[]) => list.map((filter) => filter.toObject())
    expect(serialize(buildFxFilters('threshold', {}))).toEqual(serialize(legacy))
    // The new preset's default level is the same cut, so nothing changes until the slider moves.
    expect(serialize(buildFxFilters('threshold', { level: THRESHOLD_LEGACY_LEVEL }))).toEqual(serialize(legacy))
  })

  it('moves the threshold cut with the level', () => {
    const run = (level: number, gray: number) => {
      const imageData = makeBuffer(1, 1, (_x, _y, pixel) => pixel.set([gray, gray, gray, 255])) as unknown as ImageData
      for (const filter of buildFxFilters('threshold', { level })) {
        filter.applyTo2d({ imageData } as never)
      }
      return imageData.data[0]
    }
    // Matches BlackWhite at the legacy level: the ramp is centred on mean RGB 1/3.
    expect(thresholdMatrix(THRESHOLD_LEGACY_LEVEL)[4]).toBeCloseTo(-1)
    expect(run(50, 60)).toBe(0)
    expect(run(50, 140)).toBe(255)
    // Raising the level drops mid gray into black; the ends clear everything.
    expect(run(80, 140)).toBe(0)
    expect(run(0, 5)).toBe(255)
    expect(run(100, 250)).toBe(0)
    // Alpha passes through.
    const imageData = makeBuffer(1, 1, (_x, _y, pixel) => pixel.set([200, 200, 200, 90])) as unknown as ImageData
    for (const filter of buildFxFilters('threshold', { level: 30 })) filter.applyTo2d({ imageData } as never)
    expect(imageData.data[3]).toBe(90)
  })
})
