import { describe, expect, it } from 'vitest'
import {
  addTreatment,
  buildTreatmentFilters,
  captureTransformBaseline,
  patchTransformBaseline,
  readTransformBaseline,
  readTreatments,
  treatmentLabel,
} from './treatments'

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

  it('lets Tension strengthen Age selected without changing stored amount', () => {
    const treatment = { id: '2', type: 'decay' as const, seed: 2, enabled: true, params: { amount: 40 } }
    const rested = buildTreatmentFilters([treatment], 1)
    const restless = buildTreatmentFilters([treatment], 2)
    const restedNoise = rested.find((filter) => filter.type === 'Noise')
    const restlessNoise = restless.find((filter) => filter.type === 'Noise')
    expect(Number((restlessNoise as { noise?: number } | undefined)?.noise)).toBeGreaterThan(
      Number((restedNoise as { noise?: number } | undefined)?.noise),
    )
    expect(treatment.params.amount).toBe(40)
  })

  it('builds cold-wash filter stack', () => {
    const filters = buildTreatmentFilters([
      { id: '1', type: 'cold-wash', seed: 1, enabled: true, params: {} },
    ])
    expect(filters).toHaveLength(4)
  })

  it('labels copy-machine treatments with seed identity', () => {
    expect(
      treatmentLabel({
        id: '1',
        type: 'copy-machine',
        seed: 4719,
        enabled: true,
        params: {},
      }),
    ).toBe('Copy·#4719')
  })

  it('keeps xerox, scatter, and slice labels unchanged', () => {
    expect(
      treatmentLabel({ id: '1', type: 'xerox', seed: 1, enabled: true, params: { generation: 5 } }),
    ).toBe('Xerox·5')
    expect(
      treatmentLabel({ id: '2', type: 'scatter', seed: 88, enabled: true, params: {} }),
    ).toBe('Scatter·#88')
    expect(
      treatmentLabel({
        id: '3',
        type: 'slice',
        seed: 2,
        enabled: true,
        params: { direction: 0, pieces: 5 },
      }),
    ).toBe('Slice·H·5')
  })

  it('patches pose on an existing transform baseline without touching scale or opacity', () => {
    const object = {
      left: 10,
      top: 20,
      angle: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 0.8,
      set: (values: Record<string, unknown>) => Object.assign(object, values),
    } as never
    captureTransformBaseline(object)
    patchTransformBaseline(object, { left: 80, top: 90, angle: -12 })
    expect(readTransformBaseline(object)).toEqual({
      left: 80,
      top: 90,
      angle: -12,
      scaleX: 1,
      scaleY: 1,
      opacity: 0.8,
    })
  })

  it('stacks copy-machine generations instead of replacing', () => {
    const object = { set: (values: Record<string, unknown>) => Object.assign(object, values) } as never
    addTreatment(object, 'copy-machine', { wobble: 35 }, 1)
    addTreatment(object, 'copy-machine', { wobble: 60 }, 2)
    const stack = readTreatments(object)
    expect(stack).toHaveLength(2)
    expect(stack.map((item) => item.seed)).toEqual([1, 2])
  })

  it('stores pixel filters as stackable fx treatments', () => {
    const object = { set: (values: Record<string, unknown>) => Object.assign(object, values) } as never
    addTreatment(object, 'fx', { distance: 36, angle: 45 }, 9, { fxKind: 'motion-blur' })
    const stack = readTreatments(object)
    expect(stack[0]?.fxKind).toBe('motion-blur')
    expect(treatmentLabel(stack[0]!)).toBe('Motion·45°')
    const filters = buildTreatmentFilters(stack)
    expect(filters[0]?.type).toBe('MotionBlur')
  })
})
