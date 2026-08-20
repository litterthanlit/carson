import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Canvas, FabricObject } from 'fabric'
import {
  clearLayerThumbnailCache,
  createLayerThumbnail,
  invalidateLayerThumbnail,
  layerThumbnailSignature,
} from './layerThumbnail'

function mockObject(overrides: Record<string, unknown> = {}) {
  const toDataURL = vi.fn((_options?: { format?: string; quality?: number }) => 'data:image/jpeg;base64,cached')
  const object = {
    type: 'textbox',
    visible: true,
    width: 200,
    height: 80,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    fill: '#111111',
    opacity: 1,
    filters: [],
    treatments: [],
    id: 'layer-1',
    text: 'RAY GUN',
    getBoundingRect: () => ({ left: 0, top: 0, width: 200, height: 80 }),
    toDataURL,
    ...overrides,
  }
  return { object: object as unknown as FabricObject, toDataURL }
}

describe('layerThumbnail', () => {
  beforeEach(() => {
    clearLayerThumbnailCache()
  })

  it('skips hidden objects without rasterizing', () => {
    const { object, toDataURL } = mockObject({ visible: false })
    expect(createLayerThumbnail(object, {} as Canvas)).toBeNull()
    expect(toDataURL).not.toHaveBeenCalled()
  })

  it('rasterizes as a small jpeg', () => {
    const { object, toDataURL } = mockObject()
    const thumb = createLayerThumbnail(object, {} as Canvas)
    expect(thumb).toMatch(/^data:image\/jpeg/)
    expect(toDataURL).toHaveBeenCalledTimes(1)
    const options = toDataURL.mock.calls[0]?.[0]
    expect(options?.format).toBe('jpeg')
    expect(options?.quality).toBeLessThanOrEqual(0.75)
  })

  it('reuses a cached raster when the signature is unchanged', () => {
    const { object, toDataURL } = mockObject()
    const first = createLayerThumbnail(object, {} as Canvas)
    const second = createLayerThumbnail(object, {} as Canvas)
    expect(second).toBe(first)
    expect(toDataURL).toHaveBeenCalledTimes(1)
  })

  it('rebakes after invalidation or a signature change', () => {
    const first = mockObject()
    createLayerThumbnail(first.object, {} as Canvas)
    invalidateLayerThumbnail('layer-1')
    createLayerThumbnail(first.object, {} as Canvas)
    expect(first.toDataURL).toHaveBeenCalledTimes(2)

    const moved = mockObject({ angle: 12 })
    createLayerThumbnail(moved.object, {} as Canvas)
    expect(moved.toDataURL).toHaveBeenCalledTimes(1)
  })

  it('changes signature when treatments or text change', () => {
    const a = layerThumbnailSignature({
      id: 'layer-1',
      type: 'textbox',
      width: 200,
      height: 80,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      fill: '#111',
      text: 'A',
      treatments: [],
      filters: [],
    })
    const b = layerThumbnailSignature({
      id: 'layer-1',
      type: 'textbox',
      width: 200,
      height: 80,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      fill: '#111',
      text: 'B',
      treatments: [{ id: 't1', type: 'xerox', seed: 1, enabled: true, params: {} }],
      filters: [],
    })
    expect(a).not.toBe(b)
  })
})
