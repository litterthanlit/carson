import { describe, expect, it } from 'vitest'
import { COPY_MACHINE_DEFAULTS, copyMachineParamsToRecord } from './copyMachine'
import {
  applyGestureToObject,
  COPY_SCATTER_COPY_GESTURE,
  gestureFromTreatments,
  gestureLabel,
  gestureStepSeeds,
} from './gestures'
import { addTreatment, readTreatments, type Treatment } from './treatments'

function stubObject() {
  const object = { set: (values: Record<string, unknown>) => Object.assign(object, values) } as never
  return object
}

describe('gestures', () => {
  it('COPY_SCATTER_COPY has three steps in copy-scatter-copy order', () => {
    expect(COPY_SCATTER_COPY_GESTURE.steps).toHaveLength(3)
    expect(COPY_SCATTER_COPY_GESTURE.steps.map((step) => step.type)).toEqual([
      'copy-machine',
      'scatter',
      'copy-machine',
    ])
    expect(COPY_SCATTER_COPY_GESTURE.steps[0]?.params).toEqual(copyMachineParamsToRecord(COPY_MACHINE_DEFAULTS))
    expect(COPY_SCATTER_COPY_GESTURE.steps[2]?.params).toEqual(copyMachineParamsToRecord(COPY_MACHINE_DEFAULTS))
  })

  it('gestureFromTreatments round-trips enabled treatment type and params', () => {
    const treatments: Treatment[] = [
      {
        id: 'a',
        type: 'copy-machine',
        seed: 1,
        enabled: true,
        params: { wobble: 42, drag: 30 },
      },
      {
        id: 'b',
        type: 'scatter',
        seed: 2,
        enabled: false,
        params: { distance: 46, rotation: 18, scale: 0.14 },
      },
      {
        id: 'c',
        type: 'scatter',
        seed: 3,
        enabled: true,
        params: { distance: 10, rotation: 5, scale: 0.2 },
      },
    ]
    const gesture = gestureFromTreatments(treatments)
    expect(gesture.steps).toEqual([
      { type: 'copy-machine', params: { wobble: 42, drag: 30 } },
      { type: 'scatter', params: { distance: 10, rotation: 5, scale: 0.2 } },
    ])
    expect(gestureLabel(gesture)).toBe('Copy → Scatter')
  })

  it('gestureStepSeeds is deterministic and distinct per step', () => {
    const first = gestureStepSeeds(4719, 3)
    const second = gestureStepSeeds(4719, 3)
    expect(first).toEqual([4719, 4720, 4721])
    expect(second).toEqual(first)
    expect(new Set(first).size).toBe(3)
    expect(gestureStepSeeds(10, 0)).toEqual([])
  })

  it('applyGestureToObject stacks copy-machine, scatter, copy-machine', () => {
    const object = stubObject()
    applyGestureToObject(object, COPY_SCATTER_COPY_GESTURE, 4719)
    const stack = readTreatments(object)
    expect(stack).toHaveLength(3)
    expect(stack.map((item) => item.type)).toEqual(['copy-machine', 'scatter', 'copy-machine'])
    expect(stack.map((item) => item.seed)).toEqual([4719, 4720, 4721])
  })

  it('matches manual addTreatment chain for the built-in gesture', () => {
    const gestureObject = stubObject()
    applyGestureToObject(gestureObject, COPY_SCATTER_COPY_GESTURE, 88)

    const manualObject = stubObject()
    const seeds = gestureStepSeeds(88, 3)
    COPY_SCATTER_COPY_GESTURE.steps.forEach((step, index) => {
      addTreatment(manualObject, step.type, step.params, seeds[index]!)
    })

    expect(readTreatments(gestureObject)).toEqual(readTreatments(manualObject))
  })
})
