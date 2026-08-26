import { describe, expect, it } from 'vitest'
import { Path, Rect } from 'fabric'
import { applyObjectPatch, captureObjectPatch, capturePathEditPatch } from './historyObject'
import { readLayerMask, writeLayerMask } from './layerMask'

describe('historyObject', () => {
  it('round-trips object patches', () => {
    const object = new Rect({
      left: 10,
      top: 20,
      width: 40,
      height: 40,
      opacity: 0.8,
      globalCompositeOperation: 'multiply',
    })
    object.set({ name: 'Block', visible: true, selectable: true, evented: true } as Partial<Rect>)
    const before = captureObjectPatch(object)
    object.set({
      left: 30,
      top: 50,
      opacity: 0.4,
      name: 'Moved',
      globalCompositeOperation: 'screen',
    } as Partial<Rect>)
    applyObjectPatch(object, before)
    expect(object.left).toBe(10)
    expect(object.top).toBe(20)
    expect(object.opacity).toBe(0.8)
    expect(object.globalCompositeOperation).toBe('multiply')
    expect((object as unknown as { name: string }).name).toBe('Block')
  })

  it('round-trips layer masks', () => {
    const object = new Rect({ width: 80, height: 40 })
    object.set({ name: 'Masked' } as Partial<Rect>)
    writeLayerMask(object, {
      enabled: true,
      inverted: false,
      clipJson: null,
      clipGeom: null,
      strokes: [{ x: 0.4, y: 0.5, radius: 0.2, hardness: 0.3, reveal: false }],
    })
    const before = captureObjectPatch(object)
    writeLayerMask(object, null)
    applyObjectPatch(object, before)
    const restored = readLayerMask(object)
    expect(restored?.strokes).toHaveLength(1)
    expect(restored?.strokes[0]?.x).toBe(0.4)
  })

  it('keeps the current blend mode when restoring a legacy patch', () => {
    const object = new Rect({ width: 40, height: 40, globalCompositeOperation: 'difference' })
    applyObjectPatch(
      object,
      JSON.stringify({
        left: 12,
        top: 8,
        opacity: 1,
        name: 'Legacy',
        visible: true,
        selectable: true,
        evented: true,
      }),
    )
    expect(object.left).toBe(12)
    expect(object.globalCompositeOperation).toBe('difference')
  })

  it('round-trips path geometry in path edit patches', () => {
    const path = new Path('M 0 0 L 80 20 L 120 60', {
      left: 10,
      top: 20,
      angle: 15,
      stroke: '#111',
      fill: '',
    })
    path.set({ name: 'Pen stroke' } as Partial<Path>)
    const before = capturePathEditPatch(path)
    path._setPath(
      [
        ['M', 0, 0],
        ['L', 90, 25],
        ['L', 120, 60],
      ],
      true,
    )
    path.set({ left: 40, angle: 30 } as Partial<Path>)
    applyObjectPatch(path, before)
    expect(path.left).toBe(10)
    expect(path.angle).toBe(15)
    expect(path.path[1]).toEqual(['L', 80, 20])
  })
})
