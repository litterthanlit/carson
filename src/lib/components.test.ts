import { describe, expect, it } from 'vitest'
import type { FabricObject } from 'fabric'
import {
  applySlotOverrides,
  detachInstance,
  ensureComponentSlotIds,
  instanceRoot,
  mergeSlotOverride,
  overrideCount,
  readComponentId,
  recordOverrideFromPatch,
  retargetObjectIds,
  treatmentsFromSnapshot,
  writeComponentId,
} from './components'

function fakeObject(id: string, extras: Record<string, unknown> = {}): FabricObject {
  const record: Record<string, unknown> = { id, type: extras.type ?? 'textbox', ...extras }
  return {
    ...record,
    set(values: Record<string, unknown>) {
      Object.assign(record, values)
      Object.assign(this, values)
    },
    getObjects: extras.getObjects,
    group: extras.group,
  } as unknown as FabricObject
}

describe('component instances', () => {
  it('mergeSlotOverride writes text and fill per slot', () => {
    const next = mergeSlotOverride({}, 'headline', { text: 'NEW', fill: '#e11d48' })
    expect(next.headline).toEqual({ text: 'NEW', fill: '#e11d48' })
    expect(overrideCount(next)).toBe(1)
  })

  it('recordOverrideFromPatch stores on the instance root', () => {
    const child = fakeObject('child', { componentSlotId: 'headline', text: 'OLD' })
    const root = fakeObject('root', { componentId: 'comp-1', type: 'group', getObjects: () => [child] })
    ;(child as unknown as { group: FabricObject }).group = root
    expect(recordOverrideFromPatch(child, { text: 'HEADLINE' })).toBe(true)
    expect(instanceRoot(child)).toBe(root)
    const overrides = (root as unknown as { componentOverrides: Record<string, { text: string }> }).componentOverrides
    expect(overrides.headline.text).toBe('HEADLINE')
  })

  it('applySlotOverrides writes text onto the matching slot', () => {
    const child = fakeObject('child', { componentSlotId: 'headline', text: 'OLD' })
    applySlotOverrides(child, { headline: { text: 'UPDATED', fill: '#111' } })
    expect((child as unknown as { text: string }).text).toBe('UPDATED')
    expect((child as unknown as { fill: string }).fill).toBe('#111')
  })

  it('ensureComponentSlotIds fills missing slots from object ids', () => {
    const object = fakeObject('text-1')
    ensureComponentSlotIds(object)
    expect((object as unknown as { componentSlotId: string }).componentSlotId).toBe('text-1')
  })

  it('retargetObjectIds assigns new ids without dropping slot ids', () => {
    const object = fakeObject('old-id', { componentSlotId: 'headline', kind: 'text' })
    let n = 0
    retargetObjectIds(object, () => `text-${++n}`)
    expect((object as unknown as { id: string }).id).toBe('text-1')
    expect((object as unknown as { componentSlotId: string }).componentSlotId).toBe('headline')
  })

  it('detachInstance clears the link and overrides', () => {
    const object = fakeObject('root', { componentId: 'comp-1', componentOverrides: { a: { text: 'x' } } })
    detachInstance(object)
    expect(readComponentId(object)).toBeNull()
    expect((object as unknown as { componentOverrides: object }).componentOverrides).toEqual({})
  })

  it('treatmentsFromSnapshot reads a saved stack', () => {
    const treatments = treatmentsFromSnapshot({
      treatments: [{ id: 't1', type: 'xerox', seed: 9, enabled: true, params: { generation: 5 } }],
    })
    expect(treatments).toHaveLength(1)
    expect(treatments[0]?.type).toBe('xerox')
    expect(treatmentsFromSnapshot({ treatments: 'nope' })).toEqual([])
  })

  it('writeComponentId null unsets the instance', () => {
    const object = fakeObject('root')
    writeComponentId(object, 'comp-9')
    expect(readComponentId(object)).toBe('comp-9')
    writeComponentId(object, null)
    expect(readComponentId(object)).toBeNull()
  })
})
