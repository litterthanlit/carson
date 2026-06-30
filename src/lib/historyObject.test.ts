import { describe, expect, it } from 'vitest'
import { Rect } from 'fabric'
import { applyObjectPatch, captureObjectPatch } from './historyObject'

describe('historyObject', () => {
  it('round-trips object patches', () => {
    const object = new Rect({ left: 10, top: 20, width: 40, height: 40, opacity: 0.8 })
    object.set({ name: 'Block', visible: true, selectable: true, evented: true } as Partial<Rect>)
    const before = captureObjectPatch(object)
    object.set({ left: 30, top: 50, opacity: 0.4, name: 'Moved' } as Partial<Rect>)
    applyObjectPatch(object, before)
    expect(object.left).toBe(10)
    expect(object.top).toBe(20)
    expect(object.opacity).toBe(0.8)
    expect((object as unknown as { name: string }).name).toBe('Block')
  })
})
