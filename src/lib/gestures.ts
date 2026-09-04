/**
 * Gestures — recordable instrument performances (Horizon 3 A3).
 * Pure, deterministic; seeds derived like copyMachineLayerSeeds.
 */
import type { FabricObject } from 'fabric'
import { COPY_MACHINE_DEFAULTS, copyMachineParamsToRecord } from './copyMachine'
import { decayMarkKindFromParams } from './decayMarksTreatment'
import { sliceDirectionFromParams } from './sliceTreatment'
import { addTreatment, type Treatment, type TreatmentType } from './treatments'
import type { FxKind } from './pixelFilters'

export type GestureStep = {
  type: TreatmentType
  params: Record<string, number>
  fxKind?: FxKind
}

export type Gesture = {
  id: string
  name: string
  steps: GestureStep[]
}

export type GesturePerformance = {
  recording: boolean
  plays: GestureStep[]
}

export const MAX_PERFORMANCE_STEPS = 24

export const COPY_SCATTER_COPY_GESTURE: Gesture = {
  id: 'copy-scatter-copy',
  name: 'Copy → Scatter → Copy',
  steps: [
    { type: 'copy-machine', params: copyMachineParamsToRecord(COPY_MACHINE_DEFAULTS) },
    { type: 'scatter', params: { distance: 46, rotation: 18, scale: 0.14 } },
    { type: 'copy-machine', params: copyMachineParamsToRecord(COPY_MACHINE_DEFAULTS) },
  ],
}

const STEP_LABELS: Partial<Record<TreatmentType, string>> = {
  'copy-machine': 'Copy',
  scatter: 'Scatter',
  xerox: 'Xerox',
  decay: 'Age',
  distress: 'Distress',
  'cold-wash': 'Cold wash',
  slice: 'Slice',
  crop: 'Crop',
  tear: 'Tear',
  'bad-crop': 'Bad crop',
  'glyph-break': 'Break letters',
  scrape: 'Scrape',
  'press-check': 'Press Check',
  'decay-marks': 'Decay marks',
  misprint: 'Misprint',
  'type-strips': 'Type strip',
  fx: 'Filter',
}

function cloneStep(step: GestureStep): GestureStep {
  const next: GestureStep = {
    type: step.type,
    params: { ...step.params },
  }
  if (step.fxKind) next.fxKind = step.fxKind
  return next
}

/** Play-time chain label, e.g. Xerox 3 / Scatter 30% / Strips */
export function gestureStepLabel(step: GestureStep): string {
  switch (step.type) {
    case 'xerox':
      return `Xerox ${Math.round(step.params.generation ?? 5)}`
    case 'scatter':
      return `Scatter ${Math.round(step.params.distance ?? 46)}%`
    case 'slice':
      return sliceDirectionFromParams(step.params) === 'vertical' ? 'Columns' : 'Strips'
    case 'copy-machine':
      return 'Copy'
    case 'decay':
      return `Age ${Math.round(step.params.amount ?? 55)}`
    case 'decay-marks': {
      const kind = decayMarkKindFromParams(step.params)
      const amount = Math.round(step.params.amount ?? 55)
      if (kind === 'fold') return `Fold ${amount}`
      if (kind === 'all') return `Wear ${amount}`
      return `Ink loss ${amount}`
    }
    case 'distress':
      return `Distress ${Math.round(step.params.intensity ?? 70)}`
    case 'cold-wash':
      return 'Cold wash'
    case 'misprint':
      return `Misprint ${Math.round(step.params.offset ?? 10)}`
    case 'type-strips':
      return 'Type strip'
    case 'press-check':
      return 'Press Check'
    default:
      return STEP_LABELS[step.type] ?? step.type
  }
}

/** Human-readable chain label, e.g. Strips → Scatter 46% → Xerox 5 */
export function gestureLabel(gesture: Gesture): string {
  if (gesture.name.trim()) return gesture.name
  return gesture.steps.map(gestureStepLabel).join(' → ')
}

export function idlePerformance(): GesturePerformance {
  return { recording: false, plays: [] }
}

export function startRecording(): GesturePerformance {
  return { recording: true, plays: [] }
}

export function stopRecording(performance: GesturePerformance): GesturePerformance {
  return { ...performance, recording: false }
}

export function toggleRecording(performance: GesturePerformance): GesturePerformance {
  return performance.recording ? stopRecording(performance) : startRecording()
}

export function clearPlays(performance: GesturePerformance): GesturePerformance {
  return { ...performance, plays: [] }
}

/** Append a play while recording. No-op when idle or at the step cap. */
export function recordPlay(performance: GesturePerformance, play: GestureStep): GesturePerformance {
  if (!performance.recording) return performance
  if (performance.plays.length >= MAX_PERFORMANCE_STEPS) return performance
  return {
    ...performance,
    plays: [...performance.plays, cloneStep(play)],
  }
}

export function gestureFromPlays(plays: GestureStep[], id = '', name = ''): Gesture {
  const steps = plays.map(cloneStep)
  const draft: Gesture = { id: '', name: '', steps }
  return {
    id,
    name: name.trim() || gestureLabel(draft),
    steps,
  }
}

export function gestureFromPerformance(performance: GesturePerformance, id: string, name?: string): Gesture | null {
  if (performance.plays.length === 0) return null
  return gestureFromPlays(performance.plays, id, name ?? '')
}

/** Record enabled treatments as gesture steps; bypassed steps are omitted. */
export function gestureFromTreatments(treatments: Treatment[]): Gesture {
  const steps: GestureStep[] = treatments
    .filter((item) => item.enabled)
    .map((item) => {
      const step: GestureStep = {
        type: item.type,
        params: { ...item.params },
      }
      if (item.fxKind) step.fxKind = item.fxKind
      return step
    })
  return gestureFromPlays(steps)
}

/** Per-step seeds from one master seed — same contract as copyMachineLayerSeeds. */
export function gestureStepSeeds(masterSeed: number, stepCount: number): number[] {
  const count = Math.max(0, Math.floor(stepCount))
  const base = Math.floor(masterSeed) >>> 0
  return Array.from({ length: count }, (_, index) => (base + index) >>> 0)
}

/** Apply each gesture step via addTreatment (stacking allowed). */
export function applyGestureToObject(object: FabricObject, gesture: Gesture, masterSeed: number): void {
  const seeds = gestureStepSeeds(masterSeed, gesture.steps.length)
  for (let index = 0; index < gesture.steps.length; index += 1) {
    const step = gesture.steps[index]!
    addTreatment(object, step.type, step.params, seeds[index]!, { fxKind: step.fxKind })
  }
}
