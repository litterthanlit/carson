import { describe, expect, it } from 'vitest'
import { Rect } from 'fabric'
import {
  brushRadiusForSize,
  canvasPointToMaskLocal,
  emptyLayerMask,
  hasMaskContent,
  layerMaskLabel,
  rasterizeLayerMask,
  readLayerMask,
  stampsAlongSegment,
  writeLayerMask,
  type LayerMask,
} from './layerMask'

describe('layerMask', () => {
  it('stores mask data on a fabric object without flattening', () => {
    const object = new Rect({ left: 10, top: 20, width: 80, height: 40 })
    const mask: LayerMask = {
      ...emptyLayerMask(),
      strokes: [{ x: 0.5, y: 0.5, radius: 0.2, hardness: 0.4, reveal: false }],
    }
    writeLayerMask(object, mask)
    expect(hasMaskContent(readLayerMask(object))).toBe(true)
    expect(layerMaskLabel(mask)).toBe('Mask·1')
  })

  it('starts fully revealed and conceals under a center stamp', () => {
    const mask: LayerMask = {
      ...emptyLayerMask(),
      strokes: [{ x: 0.5, y: 0.5, radius: 0.4, hardness: 1, reveal: false }],
    }
    const image = rasterizeLayerMask(mask, 32, 32)
    const center = (16 * 32 + 16) * 4 + 3
    const corner = 3
    expect(image.data[center]).toBeLessThan(20)
    expect(image.data[corner]).toBeGreaterThan(200)
  })

  it('clip geom starts concealed outside the ellipse', () => {
    const mask: LayerMask = {
      ...emptyLayerMask(),
      clipGeom: { kind: 'ellipse', cx: 0.5, cy: 0.5, rx: 0.25, ry: 0.25, angle: 0 },
      strokes: [],
    }
    const image = rasterizeLayerMask(mask, 40, 40)
    const center = (20 * 40 + 20) * 4 + 3
    const corner = 3
    expect(image.data[center]).toBeGreaterThan(200)
    expect(image.data[corner]).toBeLessThan(20)
  })

  it('invert flips reveal and conceal', () => {
    const mask: LayerMask = {
      ...emptyLayerMask(),
      inverted: true,
      strokes: [{ x: 0.5, y: 0.5, radius: 0.4, hardness: 1, reveal: false }],
    }
    const image = rasterizeLayerMask(mask, 32, 32)
    const center = (16 * 32 + 16) * 4 + 3
    const corner = 3
    expect(image.data[center]).toBeGreaterThan(200)
    expect(image.data[corner]).toBeLessThan(20)
  })

  it('maps canvas points into 0-1 object space', () => {
    const object = new Rect({
      left: 0,
      top: 0,
      width: 100,
      height: 50,
      originX: 'left',
      originY: 'top',
    })
    object.setCoords()
    const local = canvasPointToMaskLocal(object, 50, 25)
    expect(local.x).toBeGreaterThan(0.3)
    expect(local.x).toBeLessThan(0.7)
    expect(local.y).toBeGreaterThan(0.3)
    expect(local.y).toBeLessThan(0.7)
  })

  it('spaces brush stamps along a stroke', () => {
    const stamps = stampsAlongSegment({ x: 0, y: 0 }, { x: 0.2, y: 0 }, 0.05)
    expect(stamps.length).toBeGreaterThanOrEqual(4)
    expect(stamps.at(-1)).toEqual({ x: 0.2, y: 0 })
  })

  it('scales brush size into a local radius', () => {
    expect(brushRadiusForSize(4)).toBeLessThan(brushRadiusForSize(80))
    expect(brushRadiusForSize(50)).toBeGreaterThan(0.05)
    expect(brushRadiusForSize(50)).toBeLessThan(0.3)
  })
})
