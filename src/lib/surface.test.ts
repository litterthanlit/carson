import { describe, expect, it } from 'vitest'
import { createSeededRandom } from './random'
import { abradeSurface, ageSurface, erodeInk, type SurfaceRaster } from './surface'

const SIZE = 120

/** A black block of ink on a transparent layer, or on white paper when opaque. */
function raster(opaque: boolean): SurfaceRaster {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4
      const ink = x >= 30 && x < 90 && y >= 30 && y < 90
      const value = ink ? 17 : 250
      data[i] = data[i + 1] = data[i + 2] = value
      data[i + 3] = opaque ? 255 : ink ? 255 : 0
    }
  }
  return { data, width: SIZE, height: SIZE, opaque, pxPerMm: 4, paper: [246, 243, 236] }
}

const at = (surface: SurfaceRaster, x: number, y: number) => surface.data.slice((y * SIZE + x) * 4, (y * SIZE + x) * 4 + 4)
const inkLeft = (surface: SurfaceRaster) => {
  let total = 0
  for (let y = 30; y < 90; y++) for (let x = 30; x < 90; x++) total += surface.opaque ? 255 - at(surface, x, y)[0] : at(surface, x, y)[3]
  return total
}

describe('surface', () => {
  it('ages ink alone: it thins and warms toward brown', () => {
    const surface = raster(false)
    ageSurface(surface, 0.9, createSeededRandom(1))
    const [r, , b, a] = at(surface, 60, 60)
    expect(a).toBeLessThan(255)
    expect(r).toBeGreaterThan(b)
  })

  it('ages a sheet: the paper yellows, more toward its edges', () => {
    const surface = raster(true)
    ageSurface(surface, 1, createSeededRandom(2))
    const blueLoss = (x: number, y: number) => 250 - at(surface, x, y)[2]
    let edge = 0
    let middle = 0
    for (let i = 0; i < 20; i++) {
      edge += blueLoss(i % 3, 10 + i * 5) + blueLoss(SIZE - 1 - (i % 3), 10 + i * 5)
      middle += blueLoss(20 + (i % 3), 10 + i * 5) + blueLoss(SIZE - 21 - (i % 3), 10 + i * 5)
    }
    expect(blueLoss(5, 5)).toBeGreaterThan(0)
    expect(edge).toBeGreaterThan(middle)
  })

  it('rubs off more ink the harder it is distressed, and never adds any', () => {
    const light = raster(false)
    const hard = raster(false)
    const before = inkLeft(raster(false))
    abradeSurface(light, 0.3, createSeededRandom(3))
    abradeSurface(hard, 0.95, createSeededRandom(3))
    expect(inkLeft(light)).toBeLessThan(before)
    expect(inkLeft(hard)).toBeLessThan(inkLeft(light))
  })

  it('chips ink from its edges first', () => {
    const surface = raster(false)
    erodeInk(surface, 0.8, createSeededRandom(4))
    let edgeLoss = 0
    let coreLoss = 0
    for (let i = 32; i < 88; i++) {
      edgeLoss += 255 - at(surface, 30, i)[3] + (255 - at(surface, 89, i)[3])
      coreLoss += 255 - at(surface, 58, i)[3] + (255 - at(surface, 61, i)[3])
    }
    expect(edgeLoss).toBeGreaterThan(coreLoss * 2)
    // Ink loss never touches bare paper.
    expect(at(surface, 5, 5)[3]).toBe(0)
  })

  it('does nothing at zero and is the same wear for the same seed', () => {
    const untouched = raster(false)
    ageSurface(untouched, 0, createSeededRandom(5))
    abradeSurface(untouched, 0, createSeededRandom(5))
    erodeInk(untouched, 0, createSeededRandom(5))
    expect([...untouched.data]).toEqual([...raster(false).data])
    const run = () => {
      const surface = raster(true)
      abradeSurface(surface, 0.7, createSeededRandom(6))
      return [...surface.data]
    }
    expect(run()).toEqual(run())
  })
})
