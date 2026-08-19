import { describe, expect, it } from 'vitest'
import {
  buildFxFilters,
  fxChipLabel,
  isFxKind,
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
})
