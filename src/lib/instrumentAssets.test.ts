import { describe, expect, it } from 'vitest'
import {
  canSaveTreatmentAsInstrument,
  findSavedInstrument,
  instrumentIdForTreatment,
  MAX_SAVED_INSTRUMENTS,
  savedInstrumentDefaultName,
  savedInstrumentFromTreatment,
  upsertSavedInstrument,
  type SavedInstrument,
} from './instrumentAssets'
import type { Treatment } from './treatments'

function xerox(params: Record<string, number> = { generation: 8 }): Treatment {
  return {
    id: 'tx-1',
    type: 'xerox',
    seed: 12,
    enabled: true,
    params,
  }
}

describe('instrument assets', () => {
  it('maps layer treatments onto registry instruments and skips poster looks', () => {
    expect(instrumentIdForTreatment('xerox', { generation: 5 })).toBe('xerox')
    expect(instrumentIdForTreatment('decay-marks', { kind: 0 })).toBe('ink-loss')
    expect(instrumentIdForTreatment('decay-marks', { kind: 1 })).toBe('fold')
    expect(instrumentIdForTreatment('decay-marks', { kind: 2 })).toBe('wear')
    expect(instrumentIdForTreatment('scrape')).toBeUndefined()
    expect(instrumentIdForTreatment('press-check')).toBeUndefined()
    expect(canSaveTreatmentAsInstrument({ type: 'xerox' })).toBe(true)
    expect(canSaveTreatmentAsInstrument({ type: 'press-check' })).toBe(false)
  })

  it('freezes current params into a named document asset', () => {
    const asset = savedInstrumentFromTreatment(xerox(), 'instrument-1', 'Heavy copy')
    expect(asset).toEqual({
      id: 'instrument-1',
      name: 'Heavy copy',
      treatmentType: 'xerox',
      params: { generation: 8 },
      instrumentId: 'xerox',
    })
    expect(savedInstrumentDefaultName(xerox())).toBe('Xerox 8')
    expect(savedInstrumentFromTreatment({ ...xerox(), type: 'press-check' }, 'instrument-2')).toBeNull()
  })

  it('upserts by id and caps the document list', () => {
    const first = upsertSavedInstrument([], {
      id: 'instrument-1',
      name: 'Heavy copy',
      treatmentType: 'xerox',
      params: { generation: 8 },
      instrumentId: 'xerox',
    })
    const renamed = upsertSavedInstrument(first, {
      id: 'instrument-1',
      name: 'Heavier copy',
      treatmentType: 'xerox',
      params: { generation: 12 },
      instrumentId: 'xerox',
    })
    expect(renamed).toHaveLength(1)
    expect(findSavedInstrument(renamed, 'instrument-1')?.name).toBe('Heavier copy')
    expect(findSavedInstrument(renamed, 'instrument-1')?.params.generation).toBe(12)

    let list: SavedInstrument[] = []
    for (let index = 0; index < MAX_SAVED_INSTRUMENTS + 3; index += 1) {
      list = upsertSavedInstrument(list, {
        id: `instrument-${index}`,
        name: `Look ${index}`,
        treatmentType: 'xerox',
        params: { generation: 5 },
        instrumentId: 'xerox',
      })
    }
    expect(list).toHaveLength(MAX_SAVED_INSTRUMENTS)
    expect(list[0]?.id).toBe(`instrument-${MAX_SAVED_INSTRUMENTS + 2}`)
  })
})
