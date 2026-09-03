import { describe, expect, it } from 'vitest'
import { COPY_MACHINE_DEFAULTS, copyMachineParamsToRecord } from './copyMachine'
import {
  applyGestureToObject,
  COPY_SCATTER_COPY_GESTURE,
  gestureFromPerformance,
  gestureFromTreatments,
  gestureLabel,
  gestureStepLabel,
  gestureStepSeeds,
  idlePerformance,
  MAX_PERFORMANCE_STEPS,
  recordPlay,
  startRecording,
  stopRecording,
  toggleRecording,
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
    expect(gestureLabel(gesture)).toBe('Copy → Scatter 10%')
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

    const gestureStack = readTreatments(gestureObject)
    const manualStack = readTreatments(manualObject)
    expect(gestureStack.map((item) => ({ type: item.type, seed: item.seed, params: item.params }))).toEqual(
      manualStack.map((item) => ({ type: item.type, seed: item.seed, params: item.params })),
    )
  })
})

describe('gesture performances', () => {
  it('records ordered instrument plays, not the current stack snapshot', () => {
    let performance = startRecording()
    performance = recordPlay(performance, { type: 'slice', params: { direction: 0, pieces: 5, gap: 9 } })
    performance = recordPlay(performance, { type: 'scatter', params: { distance: 30, rotation: 18, scale: 0.14 } })
    performance = recordPlay(performance, { type: 'xerox', params: { generation: 3 } })

    const recorded = gestureFromPerformance(performance, 'perf-1')
    expect(recorded?.steps.map((step) => step.type)).toEqual(['slice', 'scatter', 'xerox'])
    expect(recorded?.name).toBe('Strips → Scatter 30% → Xerox 3')
    expect(gestureStepLabel(recorded!.steps[1]!)).toBe('Scatter 30%')

    const stack: Treatment[] = [
      {
        id: 'xerox-first',
        type: 'xerox',
        seed: 1,
        enabled: false,
        params: { generation: 3 },
      },
      {
        id: 'scatter',
        type: 'scatter',
        seed: 2,
        enabled: true,
        params: { distance: 30, rotation: 18, scale: 0.14 },
      },
    ]
    expect(gestureFromTreatments(stack).steps.map((step) => step.type)).toEqual(['scatter'])
    expect(recorded?.steps).not.toEqual(gestureFromTreatments(stack).steps)
  })

  it('ignores plays while idle and keeps them after stop so they can still be saved', () => {
    let performance = idlePerformance()
    performance = recordPlay(performance, { type: 'xerox', params: { generation: 5 } })
    expect(performance.plays).toEqual([])

    performance = startRecording()
    performance = recordPlay(performance, { type: 'xerox', params: { generation: 5 } })
    performance = stopRecording(performance)
    expect(performance.recording).toBe(false)
    expect(performance.plays).toHaveLength(1)
    expect(gestureFromPerformance(performance, 'saved')?.name).toBe('Xerox 5')
  })

  it('starts a fresh take when recording is armed again', () => {
    let performance = startRecording()
    performance = recordPlay(performance, { type: 'xerox', params: { generation: 5 } })
    performance = toggleRecording(performance)
    performance = toggleRecording(performance)
    expect(performance.recording).toBe(true)
    expect(performance.plays).toEqual([])
  })

  it('caps recorded plays', () => {
    let performance = startRecording()
    for (let index = 0; index < MAX_PERFORMANCE_STEPS + 4; index += 1) {
      performance = recordPlay(performance, { type: 'xerox', params: { generation: index + 1 } })
    }
    expect(performance.plays).toHaveLength(MAX_PERFORMANCE_STEPS)
    expect(performance.plays.at(-1)?.params.generation).toBe(MAX_PERFORMANCE_STEPS)
  })

  it('replays a recorded performance as stacked treatments', () => {
    let performance = startRecording()
    performance = recordPlay(performance, { type: 'slice', params: { direction: 0, pieces: 5, gap: 9 } })
    performance = recordPlay(performance, { type: 'scatter', params: { distance: 30, rotation: 18, scale: 0.14 } })
    performance = recordPlay(performance, { type: 'xerox', params: { generation: 3 } })
    const gesture = gestureFromPerformance(performance, 'slice-scatter-xerox')!
    const object = stubObject()
    applyGestureToObject(object, gesture, 12)
    expect(readTreatments(object).map((item) => item.type)).toEqual(['slice', 'scatter', 'xerox'])
    expect(readTreatments(object).map((item) => item.seed)).toEqual([12, 13, 14])
  })
})
