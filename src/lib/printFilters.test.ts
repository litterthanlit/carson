import { describe, expect, it } from 'vitest'
import {
  BayerDither,
  bayer8,
  Duotone,
  DUOTONE_PALETTES,
  duotoneImageData,
  ditherImageData,
  HalftoneDots,
  halftoneDotsImageData,
  hash12,
  hexToRgb,
  RgbSplit,
  rgbSplitImageData,
  Risograph,
  risographImageData,
  RISO_INKS,
  ScanLines,
  scanLinesImageData,
} from './printFilters'

type Buffer = { data: Uint8ClampedArray; width: number; height: number }

function fill(width: number, height: number, rgba: [number, number, number, number]): Buffer {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < data.length; index += 4) data.set(rgba, index)
  return { data, width, height }
}

function paint(width: number, height: number, at: (x: number, y: number) => [number, number, number, number]): Buffer {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data.set(at(x, y), (y * width + x) * 4)
  }
  return { data, width, height }
}

function pixel(image: Buffer, x: number, y: number) {
  return Array.from(image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4))
}

function copy(image: Buffer): Buffer {
  return { data: image.data.slice(), width: image.width, height: image.height }
}

/** Mean of a channel over the buffer, 0–255. */
function mean(image: Buffer, channel: number) {
  let sum = 0
  for (let index = channel; index < image.data.length; index += 4) sum += image.data[index] ?? 0
  return sum / (image.data.length / 4)
}

function allTransparent(image: Buffer) {
  for (let index = 3; index < image.data.length; index += 4) if (image.data[index] !== 0) return false
  return true
}

describe('print filter helpers', () => {
  it('builds the classic 8×8 Bayer matrix', () => {
    expect([0, 1, 2, 3].map((x) => bayer8(x, 0))).toEqual([0, 32, 8, 40])
    expect([0, 1, 2, 3].map((x) => bayer8(x, 1))).toEqual([48, 16, 56, 24])
    const all = new Set<number>()
    for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) all.add(bayer8(x, y))
    expect(all.size).toBe(64)
    expect(Math.max(...all)).toBe(63)
  })

  it('hashes coordinates stably into [0, 1)', () => {
    expect(hash12(12, 34)).toBe(hash12(12, 34))
    expect(hash12(12, 34)).not.toBe(hash12(13, 34))
    for (let index = 0; index < 200; index += 1) {
      const value = hash12(index, index * 7)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('parses palette hex colours', () => {
    expect(hexToRgb('#ff0080')).toEqual([1, 0, 128 / 255])
    for (const pair of RISO_INKS) expect(hexToRgb(pair.accent).every((value) => value >= 0 && value <= 1)).toBe(true)
  })
})

describe('halftone dots', () => {
  it('prints solid black as solid ink and white as bare paper', () => {
    const black = fill(24, 24, [0, 0, 0, 255])
    halftoneDotsImageData(black, 8, 45, 25)
    expect(mean(black, 0)).toBeLessThan(2)
    expect(mean(black, 3)).toBe(255)

    const white = fill(24, 24, [255, 255, 255, 255])
    halftoneDotsImageData(white, 8, 45, 25)
    expect(mean(white, 0)).toBe(255)
    expect(mean(white, 3)).toBe(255)
  })

  it('breaks mid gray into dots that keep roughly its tone', () => {
    const gray = fill(64, 64, [128, 128, 128, 255])
    halftoneDotsImageData(gray, 8, 0, 0)
    const values = new Set(Array.from({ length: 64 * 64 }, (_, index) => gray.data[index * 4]))
    expect(values.has(0)).toBe(true)
    expect(values.has(255)).toBe(true)
    // Luma of 128 is ~50%; with no contrast the dots cover about that much.
    expect(mean(gray, 0)).toBeGreaterThan(90)
    expect(mean(gray, 0)).toBeLessThan(165)
  })

  it('keeps transparent areas transparent', () => {
    const clear = fill(20, 20, [0, 0, 0, 0])
    halftoneDotsImageData(clear, 6, 45, 100)
    expect(allTransparent(clear)).toBe(true)
  })

  it('lets dots ink just past a shape edge, but never leaves a paper box', () => {
    // Left half solid black, right half transparent.
    const half = paint(32, 16, (x) => (x < 16 ? [0, 0, 0, 255] : [0, 0, 0, 0]))
    halftoneDotsImageData(half, 8, 45, 25)
    expect(pixel(half, 31, 8)[3]).toBe(0)
    for (let y = 0; y < 16; y += 1) {
      for (let x = 16; x < 32; x += 1) {
        const [r, g, b, a] = pixel(half, x, y)
        // Anything inked outside the shape is ink-coloured, not paper.
        if ((a ?? 0) > 0) expect(Math.max(r ?? 0, g ?? 0, b ?? 0)).toBeLessThan(8)
      }
    }
  })

  it('is deterministic and handles the cell size extremes', () => {
    const source = paint(40, 30, (x, y) => [x * 6, y * 8, 120, 255])
    const a = copy(source)
    const b = copy(source)
    halftoneDotsImageData(a, 12, 30, 40)
    halftoneDotsImageData(b, 12, 30, 40)
    expect(a.data).toEqual(b.data)

    // Smaller than a pixel: the screen fades to its average tone instead of aliasing.
    const tiny = fill(16, 16, [128, 128, 128, 255])
    halftoneDotsImageData(tiny, 0.5, 45, 0)
    const values = new Set(Array.from({ length: 256 }, (_, index) => tiny.data[index * 4]))
    expect(values.size).toBe(1)
    const big = copy(source)
    halftoneDotsImageData(big, 480, 90, 100)
    expect(big.data.every((value) => Number.isFinite(value))).toBe(true)
  })
})

describe('risograph', () => {
  it('overprints both inks on black and leaves white as paper', () => {
    const black = fill(16, 16, [0, 0, 0, 255])
    risographImageData(black, 1, 0, 0)
    // Black + Red: black on black is black.
    expect(pixel(black, 8, 8)).toEqual([0, 0, 0, 255])

    const white = fill(16, 16, [255, 255, 255, 255])
    risographImageData(white, 0, 4, 60)
    expect(pixel(white, 8, 8)).toEqual([255, 255, 255, 255])
  })

  it('shows the accent ink alone where misregistration pushes it past the shape', () => {
    const square = paint(40, 40, (x, y) => (x >= 10 && x < 20 && y >= 10 && y < 20 ? [0, 0, 0, 255] : [0, 0, 0, 0]))
    risographImageData(square, 0, 10, 0)
    // Offset is down-right; the pink accent lands at (27, 25), outside the source square.
    const [r, g, b, a] = pixel(square, 27, 25)
    const pink = hexToRgb(RISO_INKS[0]!.accent).map((value) => Math.round(value * 255))
    expect(a).toBe(255)
    expect(Math.abs((r ?? 0) - pink[0]!)).toBeLessThan(3)
    expect(Math.abs((g ?? 0) - pink[1]!)).toBeLessThan(3)
    expect(Math.abs((b ?? 0) - pink[2]!)).toBeLessThan(3)
    // Far from the shape, it stays transparent.
    expect(pixel(square, 2, 38)[3]).toBe(0)
  })

  it('grains deterministically and only takes ink away', () => {
    const source = fill(48, 48, [0, 0, 0, 255])
    const a = copy(source)
    const b = copy(source)
    risographImageData(a, 2, 6, 100)
    risographImageData(b, 2, 6, 100)
    expect(a.data).toEqual(b.data)
    const solid = copy(source)
    risographImageData(solid, 2, 6, 0)
    expect(mean(a, 1)).toBeGreaterThan(mean(solid, 1))
  })

  it('clamps an out-of-range ink index to the palette', () => {
    const a = fill(8, 8, [60, 60, 60, 255])
    const b = fill(8, 8, [60, 60, 60, 255])
    risographImageData(a, 99, 0, 0)
    risographImageData(b, RISO_INKS.length - 1, 0, 0)
    expect(a.data).toEqual(b.data)
  })
})

describe('duotone', () => {
  it('maps black to the shadow ink and white to the highlight, keeping alpha', () => {
    const palette = DUOTONE_PALETTES[1]!
    const shadow = hexToRgb(palette.shadow).map((value) => Math.round(value * 255))
    const highlight = hexToRgb(palette.highlight).map((value) => Math.round(value * 255))
    const image = paint(2, 1, (x) => (x === 0 ? [0, 0, 0, 200] : [255, 255, 255, 40]))
    duotoneImageData(image, 1, 30)
    expect(pixel(image, 0, 0)).toEqual([...shadow, 200])
    expect(pixel(image, 1, 0)).toEqual([...highlight, 40])
  })

  it('pushes mids apart with contrast', () => {
    const soft = fill(1, 1, [90, 90, 90, 255])
    const hard = fill(1, 1, [90, 90, 90, 255])
    duotoneImageData(soft, 0, 0)
    duotoneImageData(hard, 0, 100)
    expect(soft.data[0]).toBeGreaterThan(hard.data[0] ?? 0)
  })
})

describe('bayer dither', () => {
  it('outputs only black ink, white paper or nothing', () => {
    const image = paint(32, 32, (x, y) => [x * 8, y * 8, 128, x < 4 ? 0 : 255])
    ditherImageData(image, 3, 50)
    for (let index = 0; index < image.data.length; index += 4) {
      const rgba = Array.from(image.data.subarray(index, index + 4))
      expect([0, 255]).toContain(rgba[3])
      if (rgba[3] === 255) expect([0, 255]).toContain(rgba[0])
    }
  })

  it('dithers mid gray to about half ink, and threshold extremes to all paper or all ink', () => {
    const half = fill(32, 32, [128, 128, 128, 255])
    ditherImageData(half, 4, 50)
    expect(mean(half, 0)).toBeGreaterThan(100)
    expect(mean(half, 0)).toBeLessThan(155)

    const light = fill(32, 32, [128, 128, 128, 255])
    ditherImageData(light, 4, 0)
    const dark = fill(32, 32, [128, 128, 128, 255])
    ditherImageData(dark, 4, 100)
    expect(mean(light, 0)).toBeGreaterThan(240)
    expect(mean(dark, 0)).toBeLessThan(15)
  })

  it('keeps transparent areas transparent at any threshold', () => {
    for (const threshold of [0, 50, 100]) {
      const clear = fill(16, 16, [0, 0, 0, 0])
      ditherImageData(clear, 3, threshold)
      expect(allTransparent(clear)).toBe(true)
    }
  })

  it('fades to a smooth tone once cells are too small to resolve', () => {
    const tiny = fill(16, 16, [128, 128, 128, 255])
    ditherImageData(tiny, 0.5, 50)
    expect(new Set(Array.from({ length: 256 }, (_, index) => tiny.data[index * 4])).size).toBe(1)
  })

  it('blocks the pattern at larger scales', () => {
    const image = fill(16, 16, [128, 128, 128, 255])
    ditherImageData(image, 4, 50)
    // Every pixel in a 4×4 block matches its top-left pixel.
    for (let y = 0; y < 16; y += 1) {
      for (let x = 0; x < 16; x += 1) expect(pixel(image, x, y)).toEqual(pixel(image, x - (x % 4), y - (y % 4)))
    }
  })
})

describe('rgb split', () => {
  it('leaves an image untouched at distance 0', () => {
    const image = paint(8, 8, (x, y) => [x * 30, y * 30, 90, 255])
    const before = image.data.slice()
    rgbSplitImageData(image, 0, 0)
    expect(image.data).toEqual(before)
  })

  it('fringes black type with coloured edges and keeps transparent areas clear', () => {
    const bar = paint(30, 4, (x) => (x >= 10 && x < 20 ? [0, 0, 0, 255] : [0, 0, 0, 0]))
    rgbSplitImageData(bar, 3, 0)
    // The red plate moves right and the blue plate left. Left edge: blue alone prints yellow over
    // white, then blue + green print red. Right edge: red + green print blue, then red alone, cyan.
    expect(pixel(bar, 8, 1)).toEqual([255, 255, 0, 255])
    expect(pixel(bar, 11, 1)).toEqual([255, 0, 0, 255])
    expect(pixel(bar, 18, 1)).toEqual([0, 0, 255, 255])
    expect(pixel(bar, 21, 1)).toEqual([0, 255, 255, 255])
    expect(pixel(bar, 15, 1)).toEqual([0, 0, 0, 255])
    expect(pixel(bar, 0, 1)[3]).toBe(0)
    expect(pixel(bar, 29, 1)[3]).toBe(0)
  })
})

describe('scan lines', () => {
  it('darkens paper and opens gaps through ink in the bands only', () => {
    const paper = fill(4, 20, [255, 255, 255, 255])
    scanLinesImageData(paper, 10, 100, 0)
    // First half of each period is clear, second half is the band.
    expect(pixel(paper, 1, 2)).toEqual([255, 255, 255, 255])
    expect(pixel(paper, 1, 8)).toEqual([0, 0, 0, 255])

    const ink = fill(4, 20, [0, 0, 0, 255])
    scanLinesImageData(ink, 10, 100, 0)
    expect(pixel(ink, 1, 2)).toEqual([0, 0, 0, 255])
    expect(pixel(ink, 1, 8)[3]).toBe(0)
  })

  it('keeps transparent areas transparent and jitters rows deterministically', () => {
    const clear = fill(10, 10, [0, 0, 0, 0])
    scanLinesImageData(clear, 4, 100, 100)
    expect(allTransparent(clear)).toBe(true)

    const source = paint(40, 40, (x) => [x * 6, 0, 0, 255])
    const a = copy(source)
    const b = copy(source)
    scanLinesImageData(a, 6, 0, 100)
    scanLinesImageData(b, 6, 0, 100)
    expect(a.data).toEqual(b.data)
    expect(a.data).not.toEqual(source.data)
  })

  it('is a no-op with no darkness and no jitter', () => {
    const image = paint(6, 6, (x, y) => [x * 40, y * 40, 10, 200])
    const before = image.data.slice()
    scanLinesImageData(image, 8, 0, 0)
    expect(image.data).toEqual(before)
  })
})

describe('print filter classes', () => {
  it('serialize every param so applied filters rebuild after reload', () => {
    const cases = [
      [new HalftoneDots({ cell: 30, angle: 15, contrast: 40 }), { cell: 30, angle: 15, contrast: 40 }],
      [new Risograph({ inks: 2, offset: 24, grain: 10 }), { inks: 2, offset: 24, grain: 10 }],
      [new Duotone({ palette: 3, contrast: 70 }), { palette: 3, contrast: 70 }],
      [new BayerDither({ scale: 5, threshold: 60 }), { scale: 5, threshold: 60 }],
      [new RgbSplit({ distance: 12, angle: 90 }), { distance: 12, angle: 90 }],
      [new ScanLines({ spacing: 20, darkness: 40, jitter: 5 }), { spacing: 20, darkness: 40, jitter: 5 }],
    ] as const
    for (const [filter, params] of cases) {
      expect(filter.toObject()).toEqual({ type: filter.type, ...params })
    }
  })

  it('round-trips through the class registry', async () => {
    const { classRegistry } = await import('fabric')
    const original = new Risograph({ inks: 3, offset: 18, grain: 42 })
    const Revived = classRegistry.getClass(original.type) as typeof Risograph
    const revived = await Revived.fromObject(original.toObject())
    expect(revived).toBeInstanceOf(Risograph)
    expect(revived.toObject()).toEqual(original.toObject())
  })

  it('runs the Canvas2D path through applyTo2d', () => {
    const imageData = fill(8, 8, [0, 0, 0, 255]) as unknown as ImageData
    new Duotone({ palette: 2, contrast: 30 }).applyTo2d({ imageData })
    const red = hexToRgb(DUOTONE_PALETTES[2]!.shadow).map((value) => Math.round(value * 255))
    expect(Array.from(imageData.data.subarray(0, 3))).toEqual(red)
  })
})
