import { describe, expect, it } from 'vitest'
import { addTreatment, buildTreatmentFilters, readTreatments } from './treatments'

describe('treatments', () => {
  it('stores treatments on a plain object bag', () => {
    const object = { set: (values: Record<string, unknown>) => Object.assign(object, values) } as never
    addTreatment(object, 'xerox', { generation: 5 }, 4719)
    const stack = readTreatments(object)
    expect(stack).toHaveLength(1)
    expect(stack[0].type).toBe('xerox')
    expect(stack[0].seed).toBe(4719)
  })

  it('replaces an existing slice treatment on the same layer', () => {
    const object = { set: (values: Record<string, unknown>) => Object.assign(object, values) } as never
    addTreatment(object, 'slice', { direction: 0, pieces: 5, gap: 9 }, 1)
    addTreatment(object, 'slice', { direction: 1, pieces: 3, gap: 4 }, 2)
    const stack = readTreatments(object)
    expect(stack).toHaveLength(1)
    expect(stack[0].params.direction).toBe(1)
    expect(stack[0].seed).toBe(2)
  })

  it('replaces an existing crop treatment on the same layer', () => {
    const object = { set: (values: Record<string, unknown>) => Object.assign(object, values) } as never
    addTreatment(object, 'crop', { mode: 0 }, 1)
    addTreatment(object, 'crop', { mode: 1 }, 2)
    const stack = readTreatments(object)
    expect(stack).toHaveLength(1)
    expect(stack[0].params.mode).toBe(1)
    expect(stack[0].seed).toBe(2)
  })

  it('builds filter stacks for xerox and decay', () => {
    const filters = buildTreatmentFilters([
      { id: '1', type: 'xerox', seed: 1, enabled: true, params: { generation: 5 } },
      { id: '2', type: 'decay', seed: 2, enabled: true, params: { amount: 40 } },
    ])
    expect(filters.length).toBeGreaterThan(2)
  })

  it('builds cold-wash filter stack', () => {
    const filters = buildTreatmentFilters([
      { id: '1', type: 'cold-wash', seed: 1, enabled: true, params: {} },
    ])
    expect(filters).toHaveLength(4)
  })
})
