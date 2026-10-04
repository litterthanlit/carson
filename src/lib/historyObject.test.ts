import { describe, expect, it } from 'vitest'
import { Path, Rect } from 'fabric'
import { applyObjectPatch, captureObjectPatch, capturePathEditPatch } from './historyObject'
import { readLayerMask, writeLayerMask } from './layerMask'
import { FrameHandles } from './frameHandles'

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
    expect(object.angle).toBe(0)
    expect(object.scaleX).toBe(1)
    expect(object.opacity).toBe(0.8)
    expect(object.globalCompositeOperation).toBe('multiply')
    expect((object as unknown as { name: string }).name).toBe('Block')
  })

  it('round-trips rotate and scale from a canvas transform patch', () => {
    const object = new Rect({
      left: 10,
      top: 20,
      width: 40,
      height: 40,
      angle: 12,
      scaleX: 1.5,
      scaleY: 0.8,
    })
    object.set({ name: 'Block' } as Partial<Rect>)
    const before = captureObjectPatch(object)
    object.set({ left: 80, top: 90, angle: 45, scaleX: 2, scaleY: 2 } as Partial<Rect>)
    applyObjectPatch(object, before)
    expect(object.left).toBe(10)
    expect(object.top).toBe(20)
    expect(object.angle).toBe(12)
    expect(object.scaleX).toBe(1.5)
    expect(object.scaleY).toBe(0.8)
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

  it('round-trips a frame\'s handles, lines and color', () => {
    const frame = new FrameHandles({ left: 0, top: 0, width: 200, height: 100, fill: '#1aa9d8', frame: { handles: ['tl'], extend: [] } })
    const before = captureObjectPatch(frame)
    frame.set({ frame: { ...frame.frame, handles: ['tl', 'br'], extend: ['top'], dash: 'dotted' }, fill: '#ff0000' })
    const after = captureObjectPatch(frame)
    expect(after).not.toBe(before)
    applyObjectPatch(frame, before)
    expect(frame.frame.handles).toEqual(['tl'])
    expect(frame.frame.extend).toEqual([])
    expect(frame.frame.dash).toBe('solid')
    expect(frame.fill).toBe('#1aa9d8')
    applyObjectPatch(frame, after)
    expect(frame.frame.handles).toEqual(['tl', 'br'])
    expect(frame.fill).toBe('#ff0000')
  })

  it('restores a frame color under the soft proof without touching the proofed fill', () => {
    const frame = new FrameHandles({ left: 0, top: 0, width: 200, height: 100, fill: '#1aa9d8' })
    const before = captureObjectPatch(frame)
    frame.set({ originalFill: '#ff0000', fill: '#ee1111' } as Partial<FrameHandles>)
    expect(JSON.parse(captureObjectPatch(frame)).frameColor).toBe('#ff0000')
    applyObjectPatch(frame, before)
    expect((frame as unknown as { originalFill: string }).originalFill).toBe('#1aa9d8')
    expect(frame.fill).toBe('#ee1111')
  })
})
