import { describe, expect, it } from 'vitest'
import {
  MIN_CROP_SIZE,
  clampCrop,
  coverCrop,
  cropCenterOffset,
  fullCrop,
  isFullCrop,
  moveCrop,
  resizeCrop,
  setCropField,
} from './cropGeometry'

const source = { width: 2000, height: 1500 }

describe('crop rectangles', () => {
  it('starts from the whole image and knows when it is whole again', () => {
    expect(fullCrop(source)).toEqual({ x: 0, y: 0, width: 2000, height: 1500 })
    expect(isFullCrop({ x: 0.2, y: 0, width: 1999.7, height: 1500 }, source)).toBe(true)
    expect(isFullCrop({ x: 10, y: 0, width: 1990, height: 1500 }, source)).toBe(false)
  })

  it('keeps a crop inside the image and above the minimum size', () => {
    expect(clampCrop({ x: -50, y: 1400, width: 3000, height: 2 }, source)).toEqual({ x: 0, y: 1400 - 0, width: 2000, height: MIN_CROP_SIZE })
  })

  it('measures the crop centre from the image centre', () => {
    expect(cropCenterOffset({ x: 500, y: 300, width: 900, height: 600 }, source)).toEqual({ x: -50, y: -150 })
    expect(cropCenterOffset(fullCrop(source), source)).toEqual({ x: 0, y: 0 })
  })

  it('slides a crop and stops at the edges', () => {
    const rect = { x: 100, y: 100, width: 500, height: 400 }
    expect(moveCrop(rect, { x: 50, y: -20 }, source)).toEqual({ x: 150, y: 80, width: 500, height: 400 })
    expect(moveCrop(rect, { x: 5000, y: -5000 }, source)).toEqual({ x: 1500, y: 0, width: 500, height: 400 })
  })
})

describe('resizeCrop', () => {
  const start = { x: 200, y: 200, width: 800, height: 400 }

  it('moves only the dragged edges, the opposite side staying put', () => {
    expect(resizeCrop(start, 'se', { x: 100, y: 50 }, source)).toEqual({ x: 200, y: 200, width: 900, height: 450 })
    expect(resizeCrop(start, 'nw', { x: 100, y: 50 }, source)).toEqual({ x: 300, y: 250, width: 700, height: 350 })
    expect(resizeCrop(start, 'n', { x: 999, y: -100 }, source)).toEqual({ x: 200, y: 100, width: 800, height: 500 })
  })

  it('never leaves the image or collapses', () => {
    expect(resizeCrop(start, 'w', { x: -1000, y: 0 }, source).x).toBe(0)
    expect(resizeCrop(start, 'e', { x: -5000, y: 0 }, source).width).toBe(MIN_CROP_SIZE)
  })

  it('keeps the proportions with Shift, anchored at the opposite corner', () => {
    const rect = resizeCrop(start, 'se', { x: 200, y: 0 }, source, true)
    expect(rect).toEqual({ x: 200, y: 200, width: 1000, height: 500 })
    const nw = resizeCrop(start, 'nw', { x: 0, y: 100 }, source, true)
    expect(nw.width / nw.height).toBeCloseTo(2)
    expect(nw.x + nw.width).toBe(1000)
    expect(nw.y + nw.height).toBe(600)
  })

  it('grows an edge about its centre line with proportions kept, and shrinks to fit the image', () => {
    const rect = resizeCrop(start, 's', { x: 0, y: 100 }, source, true)
    expect(rect).toEqual({ x: 100, y: 200, width: 1000, height: 500 })
    const capped = resizeCrop(start, 'se', { x: 5000, y: 0 }, source, true)
    expect(capped.x + capped.width).toBeLessThanOrEqual(source.width)
    expect(capped.y + capped.height).toBeLessThanOrEqual(source.height)
    expect(capped.width / capped.height).toBeCloseTo(2)
  })
})

describe('setCropField', () => {
  const rect = { x: 100, y: 100, width: 800, height: 400 }

  it('moves the frame with X and Y, resizes it with W and H', () => {
    expect(setCropField(rect, 'x', 300, source)).toEqual({ ...rect, x: 300 })
    expect(setCropField(rect, 'width', 1000, source)).toEqual({ ...rect, width: 1000 })
    expect(setCropField(rect, 'height', 9999, source)).toEqual({ ...rect, y: 0, height: 1500 })
  })

  it('changes the other side to match when proportions are kept', () => {
    expect(setCropField(rect, 'width', 1000, source, true)).toEqual({ x: 100, y: 100, width: 1000, height: 500 })
    expect(setCropField(rect, 'height', 200, source, true)).toEqual({ x: 100, y: 100, width: 400, height: 200 })
  })

  it('ignores a value that is not a number', () => {
    expect(setCropField(rect, 'x', Number.NaN, source)).toBe(rect)
  })
})

describe('coverCrop', () => {
  it('covers the old box with a centred crop of the new image', () => {
    // A 900×600 box filled by a 1200×1600 portrait: scale to the width, crop the height.
    const { scale, crop } = coverCrop({ width: 1200, height: 1600 }, { width: 900, height: 600 })
    expect(scale).toBe(0.75)
    expect(crop).toEqual({ x: 0, y: 400, width: 1200, height: 800 })
    expect(crop.width * scale).toBe(900)
    expect(crop.height * scale).toBe(600)
  })
})
