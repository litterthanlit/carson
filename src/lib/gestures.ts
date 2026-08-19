/**
 * Gestures — recordable treatment macro chains (CM-4).
 * Pure, deterministic; seeds derived like copyMachineLayerSeeds.
 */
import type { FabricObject } from 'fabric'
import { COPY_MACHINE_DEFAULTS, copyMachineParamsToRecord } from './copyMachine'
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
  decay: 'Decay',
  distress: 'Distress',
  'cold-wash': 'Cold wash',
  slice: 'Slice',
  crop: 'Crop',
  tear: 'Tear',
  'bad-crop': 'Bad crop',
  'glyph-break': 'Glyph break',
  scrape: 'Scrape',
  fx: 'Filter',
}

function stepLabel(type: TreatmentType): string {
  return STEP_LABELS[type] ?? type
}

/** Human-readable chain label, e.g. Copy → Scatter → Copy */
export function gestureLabel(gesture: Gesture): string {
  if (gesture.name.trim()) return gesture.name
  return gesture.steps.map((step) => stepLabel(step.type)).join(' → ')
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
  const draft: Gesture = { id: '', name: '', steps }
  return {
    id: '',
    name: gestureLabel(draft),
    steps,
  }
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
