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

describe('mask regions (selection → mask)', () => {
  const square = [
    { x: 0.25, y: 0.25 },
    { x: 0.75, y: 0.25 },
    { x: 0.75, y: 0.75 },
    { x: 0.25, y: 0.75 },
  ]
  const alphaAt = (image: ImageData, x: number, y: number) => image.data[(y * image.width + x) * 4 + 3]

  it('conceals inside the selection and keeps the rest', async () => {
    const { rasterizeLayerMask, emptyLayerMask } = await import('./layerMask')
    const image = rasterizeLayerMask(
      { ...emptyLayerMask(), regions: [{ points: square, op: 'conceal', feather: 0, at: 0 }] },
      40,
      40,
    )
    expect(alphaAt(image, 20, 20)).toBe(0)
    expect(alphaAt(image, 2, 2)).toBe(255)
  })

  it('intersect keeps only the selection; inverted flips it', async () => {
    const { rasterizeLayerMask, emptyLayerMask } = await import('./layerMask')
    const keep = rasterizeLayerMask({ ...emptyLayerMask(), regions: [{ points: square, op: 'intersect', feather: 0, at: 0 }] }, 40, 40)
    expect(alphaAt(keep, 20, 20)).toBe(255)
    expect(alphaAt(keep, 2, 2)).toBe(0)
    const inverted = rasterizeLayerMask(
      { ...emptyLayerMask(), regions: [{ points: square, op: 'conceal', feather: 0, inverted: true, at: 0 }] },
      40,
      40,
    )
    expect(alphaAt(inverted, 20, 20)).toBe(255)
    expect(alphaAt(inverted, 2, 2)).toBe(0)
  })

  it('feathers the edge into a gradient', async () => {
    const { regionCoverage } = await import('./layerMask')
    const coverage = regionCoverage(80, 80, { points: square, op: 'conceal', feather: 0.08, at: 0 })
    const edge = coverage[40 * 80 + 20]
    expect(edge).toBeGreaterThan(0.2)
    expect(edge).toBeLessThan(0.8)
    expect(coverage[40 * 80 + 40]).toBeGreaterThan(0.95)
  })

  it('replays strokes and regions in the order they were made', async () => {
    const { rasterizeLayerMask, emptyLayerMask } = await import('./layerMask')
    // Stroke conceals the center, then a reveal region paints it back.
    const mask = {
      ...emptyLayerMask(),
      strokes: [{ x: 0.5, y: 0.5, radius: 0.1, hardness: 0.9, reveal: false }],
      regions: [{ points: square, op: 'reveal' as const, feather: 0, at: 1 }],
    }
    expect(alphaAt(rasterizeLayerMask(mask, 40, 40), 20, 20)).toBe(255)
    // Region first, stroke after: the center stays concealed.
    const reordered = { ...mask, regions: [{ ...mask.regions[0], at: 0 }] }
    expect(alphaAt(rasterizeLayerMask(reordered, 40, 40), 20, 20)).toBe(0)
  })
})
