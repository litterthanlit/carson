import { describe, expect, it } from 'vitest'
import { Polygon, Rect, type FabricObject } from 'fabric'
import { emptyLayerMask, rasterizeLayerMask, vectorMaskClip, writeLayerMask, type LayerMask } from './layerMask'
import {
  applyWeaveToMask,
  hasWeave,
  layerOutline,
  nextWeaveParity,
  outlinesOverlap,
  pickWeaveThread,
  planWeave,
  removeWeaveFromMask,
  tornEdgeClip,
  type WeaveCrossing,
} from './weave'

const square = (x: number, y: number, size = 10) => [
  { x, y },
  { x: x + size, y },
  { x: x + size, y: y + size },
  { x, y: y + size },
]

const alpha = (mask: LayerMask, nx: number, ny: number, size = 100) => {
  const image = rasterizeLayerMask(mask, size, size)
  const x = Math.floor(nx * size)
  const y = Math.floor(ny * size)
  return image.data[(y * size + x) * 4 + 3]
}

describe('planWeave', () => {
  const crossings: WeaveCrossing[] = [
    { id: 'c', outline: square(200, 0) },
    { id: 'a', outline: square(0, 0) },
    { id: 'b', outline: square(100, 0) },
  ]

  it('orders crossings along a horizontal thread and alternates under/over', () => {
    const plan = planWeave(0, crossings)
    expect(plan.crossings.map((crossing) => crossing.id)).toEqual(['a', 'b', 'c'])
    expect(plan.crossings.map((crossing) => crossing.under)).toEqual([true, false, true])
  })

  it('swaps over and under with the other parity', () => {
    expect(planWeave(0, crossings, 1).crossings.map((crossing) => crossing.under)).toEqual([false, true, false])
  })

  it('reads a word rotated -90° from bottom to top', () => {
    const stacked: WeaveCrossing[] = [
      { id: 'top', outline: square(0, 0) },
      { id: 'bottom', outline: square(0, 200) },
    ]
    expect(planWeave(-90, stacked).crossings.map((crossing) => crossing.id)).toEqual(['bottom', 'top'])
  })
})

describe('weave mask', () => {
  const plan = planWeave(0, [
    { id: 'left', outline: square(0, 0, 40) },
    { id: 'right', outline: square(60, 0, 40) },
  ])
  const identity = (point: { x: number; y: number }) => ({ x: point.x / 100, y: point.y / 100 })

  it('conceals the thread only inside scraps it passes under', () => {
    const mask = applyWeaveToMask(emptyLayerMask(), plan, identity)
    expect(alpha(mask, 0.2, 0.2)).toBe(0)
    expect(alpha(mask, 0.8, 0.2)).toBe(255)
    expect(alpha(mask, 0.5, 0.8)).toBe(255)
  })

  it('replaces an earlier weave but keeps the user’s own mask work', () => {
    const start: LayerMask = {
      ...emptyLayerMask(),
      regions: [{ points: square(0, 0.9, 0.1), op: 'conceal', feather: 0, at: 0 }],
    }
    const first = applyWeaveToMask(start, plan, identity)
    const second = applyWeaveToMask(first, planWeave(0, plan.crossings, nextWeaveParity(first)), identity)
    expect(second.regions?.filter((region) => region.weave)).toHaveLength(1)
    expect(second.regions?.filter((region) => !region.weave)).toHaveLength(1)
    expect(alpha(second, 0.2, 0.2)).toBe(255)
    expect(alpha(second, 0.8, 0.2)).toBe(0)
  })

  it('flips parity on each re-run and can be removed', () => {
    expect(nextWeaveParity(null)).toBe(0)
    const woven = applyWeaveToMask(emptyLayerMask(), plan, identity)
    expect(hasWeave(woven)).toBe(true)
    expect(nextWeaveParity(woven)).toBe(1)
    const cleared = removeWeaveFromMask(woven)
    expect(hasWeave(cleared)).toBe(false)
    expect(nextWeaveParity(cleared)).toBe(0)
  })
})

describe('outlines', () => {
  it('detects overlap from bounding boxes', () => {
    expect(outlinesOverlap(square(0, 0), square(5, 5))).toBe(true)
    expect(outlinesOverlap(square(0, 0), square(20, 20))).toBe(false)
  })

  it('follows a rotated rectangle', () => {
    const rect = new Rect({ left: 50, top: 50, width: 20, height: 10, angle: 90, originX: 'center', originY: 'center', strokeWidth: 0 })
    const outline = layerOutline(rect)
    const xs = outline.map((point) => Math.round(point.x))
    const ys = outline.map((point) => Math.round(point.y))
    expect(Math.min(...xs)).toBe(45)
    expect(Math.max(...xs)).toBe(55)
    expect(Math.min(...ys)).toBe(40)
    expect(Math.max(...ys)).toBe(60)
  })

  it('uses a polygon’s own points', () => {
    const polygon = new Polygon([
      { x: 10, y: 10 },
      { x: 30, y: 10 },
      { x: 20, y: 40 },
    ], { strokeWidth: 0 })
    const outline = layerOutline(polygon).map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) }))
    expect(outline).toEqual([
      { x: 10, y: 10 },
      { x: 30, y: 10 },
      { x: 20, y: 40 },
    ])
  })

  it('uses a torn-edge clip instead of the bounding box', () => {
    const rect = new Rect({ left: 50, top: 50, width: 100, height: 100, strokeWidth: 0 })
    writeLayerMask(rect, { ...emptyLayerMask(), clipGeom: tornEdgeClip(100, 100, 7) })
    const outline = layerOutline(rect)
    expect(outline.length).toBeGreaterThan(4)
    for (const point of outline) {
      expect(point.x).toBeGreaterThanOrEqual(0)
      expect(point.x).toBeLessThanOrEqual(100)
    }
  })

  it('picks the biggest type layer as the thread', () => {
    // Plain stand-ins: measuring real Textboxes needs a canvas the test env lacks.
    const layer = (type: string, width: number, height: number) =>
      ({ type, width, height, scaleX: 1, scaleY: 1 }) as unknown as FabricObject
    const small = layer('textbox', 50, 20)
    const big = layer('textbox', 400, 200)
    const scrap = layer('rect', 2000, 2000)
    expect(pickWeaveThread([small, scrap, big])).toBe(big)
    expect(pickWeaveThread([scrap])).toBe(scrap)
  })
})

describe('tornEdgeClip', () => {
  it('is deterministic per seed and stays inside the layer', () => {
    const a = tornEdgeClip(800, 120, 42)
    expect(tornEdgeClip(800, 120, 42)).toEqual(a)
    expect(tornEdgeClip(800, 120, 43)).not.toEqual(a)
    for (const point of a.points ?? []) {
      expect(point.x).toBeGreaterThanOrEqual(0)
      expect(point.x).toBeLessThanOrEqual(1)
      expect(point.y).toBeGreaterThanOrEqual(0)
      expect(point.y).toBeLessThanOrEqual(1)
    }
  })

  it('keeps the middle of the scrap and drops the corners', () => {
    const mask: LayerMask = { ...emptyLayerMask(), clipGeom: tornEdgeClip(100, 100, 3) }
    expect(alpha(mask, 0.5, 0.5)).toBe(255)
    expect(alpha(mask, 0.005, 0.005)).toBe(0)
  })
})

describe('vectorMaskClip', () => {
  const size = { width: 200, height: 100 }
  const plan = planWeave(0, [{ id: 'a', outline: square(0, 0, 50) }])
  const toLocal = (point: { x: number; y: number }) => ({ x: point.x / 200, y: point.y / 100 })

  it('clips a torn edge as a sharp polygon in layer space', () => {
    const clip = vectorMaskClip({ ...emptyLayerMask(), clipGeom: tornEdgeClip(200, 100, 5) }, size)
    expect(clip?.type).toBe('polygon')
    expect(clip?.inverted).toBe(false)
  })

  it('clips a weave as the inverted union of its cuts', () => {
    const clip = vectorMaskClip(applyWeaveToMask(emptyLayerMask(), plan, toLocal), size)
    expect(clip?.type).toBe('group')
    expect(clip?.inverted).toBe(true)
  })

  it('falls back to the raster mask once anything is painted or combined', () => {
    const woven = applyWeaveToMask(emptyLayerMask(), plan, toLocal)
    expect(vectorMaskClip({ ...woven, strokes: [{ x: 0.5, y: 0.5, radius: 0.1, hardness: 1, reveal: false }] }, size)).toBeNull()
    expect(vectorMaskClip({ ...woven, clipGeom: tornEdgeClip(200, 100, 5) }, size)).toBeNull()
  })
})
