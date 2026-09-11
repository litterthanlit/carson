import { describe, expect, it } from 'vitest'
import { plateInkToPaperRgba, rgbaToCmykPlates } from './cmykPlates'

function pixel(r: number, g: number, b: number, a = 255) {
  return new Uint8ClampedArray([r, g, b, a])
}

describe('cmykPlates', () => {
  it('puts no ink on white paper', () => {
    const plates = rgbaToCmykPlates(pixel(255, 255, 255), 1, 1)
    expect(plates.cyan[0]).toBe(0)
    expect(plates.magenta[0]).toBe(0)
    expect(plates.yellow[0]).toBe(0)
    expect(plates.black[0]).toBe(0)
  })

  it('puts black ink on a process-black pixel', () => {
    const plates = rgbaToCmykPlates(pixel(0, 0, 0), 1, 1)
    expect(plates.cyan[0]).toBe(0)
    expect(plates.magenta[0]).toBe(0)
    expect(plates.yellow[0]).toBe(0)
    expect(plates.black[0]).toBe(255)
  })

  it('separates a pure screen red onto magenta and yellow plates', () => {
    const plates = rgbaToCmykPlates(pixel(255, 0, 0), 1, 1)
    expect(plates.cyan[0]).toBe(0)
    expect(plates.magenta[0]).toBe(255)
    expect(plates.yellow[0]).toBe(255)
    expect(plates.black[0]).toBe(0)
  })

  it('scales ink by alpha so a knockout stays paper', () => {
    const plates = rgbaToCmykPlates(pixel(0, 0, 0, 0), 1, 1)
    expect(plates.black[0]).toBe(0)
    const half = rgbaToCmykPlates(pixel(0, 0, 0, 128), 1, 1)
    expect(half.black[0]).toBeGreaterThan(120)
    expect(half.black[0]).toBeLessThan(140)
  })

  it('renders a plate as paper-white grayscale', () => {
    const rgba = plateInkToPaperRgba(new Uint8ClampedArray([0, 255]))
    expect(Array.from(rgba.slice(0, 4))).toEqual([255, 255, 255, 255])
    expect(Array.from(rgba.slice(4))).toEqual([0, 0, 0, 255])
  })
})
