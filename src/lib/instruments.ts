/**
 * Instrument registry — named chaos operators for Horizon 3.2.
 * Palette buttons resolve here; Tension scales intensity keys at render, not in stored params.
 */
import { COPY_MACHINE_DEFAULTS, copyMachineParamsToRecord } from './copyMachine'
import { PRESS_CHECK_DEFAULTS, pressCheckParamsToRecord } from './pressCheck'
import { misprintParamsFromGeneration } from './misprintTreatment'
import type { TreatmentType } from './treatments'
import { scaleInstrumentParams } from './instrumentTension'

export type InstrumentScope = 'layer' | 'poster' | 'document'

export type InstrumentId =
  | 'age'
  | 'ink-loss'
  | 'fold'
  | 'wear'
  | 'xerox'
  | 'copy-machine'
  | 'misprint'
  | 'type-strips'
  | 'scatter'
  | 'distress'
  | 'cold-wash'
  | 'press-check'

export type Instrument = {
  id: InstrumentId
  name: string
  treatmentType: TreatmentType
  defaultParams: Record<string, number>
  scope: InstrumentScope
  /** Intensity keys Tension multiplies at render. Empty = look is tension-invariant. */
  tensionKeys: readonly string[]
}

export const INSTRUMENTS: Instrument[] = [
  {
    id: 'age',
    name: 'Age selected',
    treatmentType: 'decay',
    defaultParams: { amount: 55 },
    scope: 'layer',
    tensionKeys: ['amount'],
  },
  {
    id: 'ink-loss',
    name: 'Ink loss',
    treatmentType: 'decay-marks',
    defaultParams: { amount: 55, kind: 0 },
    scope: 'layer',
    tensionKeys: ['amount'],
  },
  {
    id: 'fold',
    name: 'Fold marks',
    treatmentType: 'decay-marks',
    defaultParams: { amount: 55, kind: 1 },
    scope: 'layer',
    tensionKeys: ['amount'],
  },
  {
    id: 'wear',
    name: 'Wear overlay',
    treatmentType: 'decay-marks',
    defaultParams: { amount: 55, kind: 2 },
    scope: 'layer',
    tensionKeys: ['amount'],
  },
  {
    id: 'xerox',
    name: 'Copy selected',
    treatmentType: 'xerox',
    defaultParams: { generation: 5 },
    scope: 'layer',
    tensionKeys: ['generation'],
  },
  {
    id: 'copy-machine',
    name: 'Copy machine',
    treatmentType: 'copy-machine',
    defaultParams: copyMachineParamsToRecord(COPY_MACHINE_DEFAULTS),
    scope: 'layer',
    tensionKeys: ['contrast', 'grain', 'voids', 'wobble', 'wobbleFreq', 'drag', 'bands', 'ghost', 'ghostOffset'],
  },
  {
    id: 'misprint',
    name: 'Misprint offset',
    treatmentType: 'misprint',
    defaultParams: misprintParamsFromGeneration(5),
    scope: 'layer',
    tensionKeys: ['offset'],
  },
  {
    id: 'type-strips',
    name: 'Type strip',
    treatmentType: 'type-strips',
    defaultParams: { rows: 5, height: 18, gap: 4, jitter: 12 },
    scope: 'layer',
    tensionKeys: ['jitter'],
  },
  {
    id: 'scatter',
    name: 'Scatter',
    treatmentType: 'scatter',
    defaultParams: { distance: 46, rotation: 18, scale: 0.14 },
    scope: 'layer',
    tensionKeys: ['distance', 'rotation', 'scale'],
  },
  {
    id: 'distress',
    name: 'Distress',
    treatmentType: 'distress',
    defaultParams: { intensity: 70 },
    scope: 'layer',
    tensionKeys: ['intensity'],
  },
  {
    id: 'cold-wash',
    name: 'Cold wash',
    treatmentType: 'cold-wash',
    defaultParams: {},
    scope: 'layer',
    tensionKeys: [],
  },
  {
    id: 'press-check',
    name: 'Press Check',
    treatmentType: 'press-check',
    defaultParams: pressCheckParamsToRecord(PRESS_CHECK_DEFAULTS),
    scope: 'poster',
    tensionKeys: ['inkSpread', 'misregistration', 'paperTooth'],
  },
]

const BY_ID = new Map<InstrumentId, Instrument>(INSTRUMENTS.map((item) => [item.id, item]))

const TENSION_KEYS_BY_TYPE = new Map<TreatmentType, readonly string[]>()
for (const instrument of INSTRUMENTS) {
  const existing = TENSION_KEYS_BY_TYPE.get(instrument.treatmentType)
  if (!existing || instrument.tensionKeys.length > existing.length) {
    TENSION_KEYS_BY_TYPE.set(instrument.treatmentType, instrument.tensionKeys)
  }
}

export function getInstrument(id: InstrumentId): Instrument {
  const instrument = BY_ID.get(id)
  if (!instrument) throw new Error(`Unknown instrument: ${id}`)
  return instrument
}

export function resolveInstrumentParams(
  id: InstrumentId,
  overrides: Record<string, number> = {},
): Record<string, number> {
  return { ...getInstrument(id).defaultParams, ...overrides }
}

export function tensionKeysForTreatment(type: TreatmentType): readonly string[] {
  return TENSION_KEYS_BY_TYPE.get(type) ?? []
}

export function instrumentUsesTension(type: TreatmentType): boolean {
  return tensionKeysForTreatment(type).length > 0
}

export function scaleTreatmentParams(
  type: TreatmentType,
  params: Record<string, number>,
  tensionScale = 1,
): Record<string, number> {
  return scaleInstrumentParams(params, tensionKeysForTreatment(type), tensionScale)
}
