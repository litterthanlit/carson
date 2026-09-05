/**
 * Named Instrument assets — a tuned operator saved in the document (Horizon 3.2).
 * Not a marketplace. Replay applies the frozen params with a new seed.
 */
import { decayMarkKindFromParams } from './decayMarksTreatment'
import { gestureStepLabel, type GestureStep } from './gestures'
import { INSTRUMENTS, type InstrumentId } from './instruments'
import type { Treatment, TreatmentType } from './treatments'

export const MAX_SAVED_INSTRUMENTS = 24

export type SavedInstrument = {
  id: string
  name: string
  treatmentType: TreatmentType
  params: Record<string, number>
  instrumentId?: InstrumentId
  fxKind?: Treatment['fxKind']
}

export function canSaveTreatmentAsInstrument(treatment: Pick<Treatment, 'type'>): boolean {
  return treatment.type !== 'scrape' && treatment.type !== 'press-check'
}

export function instrumentIdForTreatment(
  type: TreatmentType,
  params: Record<string, number> = {},
): InstrumentId | undefined {
  if (type === 'decay-marks') {
    const kind = decayMarkKindFromParams(params)
    if (kind === 'fold') return 'fold'
    if (kind === 'all') return 'wear'
    return 'ink-loss'
  }
  return INSTRUMENTS.find((item) => item.treatmentType === type && item.scope === 'layer')?.id
}

export function savedInstrumentDefaultName(treatment: Pick<Treatment, 'type' | 'params' | 'fxKind'>): string {
  const step: GestureStep = {
    type: treatment.type,
    params: { ...treatment.params },
  }
  if (treatment.fxKind) step.fxKind = treatment.fxKind
  return gestureStepLabel(step)
}

export function savedInstrumentFromTreatment(
  treatment: Treatment,
  id: string,
  name?: string,
): SavedInstrument | null {
  if (!canSaveTreatmentAsInstrument(treatment)) return null
  const trimmed = name?.trim()
  const asset: SavedInstrument = {
    id,
    name: trimmed || savedInstrumentDefaultName(treatment),
    treatmentType: treatment.type,
    params: { ...treatment.params },
    instrumentId: instrumentIdForTreatment(treatment.type, treatment.params),
  }
  if (treatment.fxKind) asset.fxKind = treatment.fxKind
  return asset
}

export function upsertSavedInstrument(
  instruments: SavedInstrument[],
  asset: SavedInstrument,
): SavedInstrument[] {
  return [asset, ...instruments.filter((item) => item.id !== asset.id)].slice(0, MAX_SAVED_INSTRUMENTS)
}

export function findSavedInstrument(
  instruments: SavedInstrument[],
  instrumentId: string,
): SavedInstrument | undefined {
  return instruments.find((item) => item.id === instrumentId)
}
