import { describe, expect, it } from 'vitest'
import {
  decayMarkKindFromParams,
  decayMarkKindToParam,
  decayMarksForTreatment,
  omitDecayMarkFragmentsFromCanvasJSON,
} from './decayMarksTreatment'
import { treatmentLabel } from './treatments'

describe('decayMarksTreatment', () => {
  it('encodes ink-loss, fold, and wear overlay as stack params', () => {
    expect(decayMarkKindFromParams({ kind: 0 })).toBe('ink-loss')
    expect(decayMarkKindFromParams({ kind: 1 })).toBe('fold')
    expect(decayMarkKindFromParams({ kind: 2 })).toBe('all')
    expect(decayMarkKindToParam('ink-loss')).toBe(0)
    expect(decayMarkKindToParam('fold')).toBe(1)
    expect(decayMarkKindToParam('all')).toBe(2)
  })

  it('labels decay-mark treatments in the chip row', () => {
    expect(
      treatmentLabel({
        id: '1',
        type: 'decay-marks',
        seed: 9,
        enabled: true,
        params: { amount: 40, kind: 0 },
      }),
    ).toBe('Ink loss·40')
    expect(
      treatmentLabel({
        id: '2',
        type: 'decay-marks',
        seed: 9,
        enabled: true,
        params: { amount: 55, kind: 1 },
      }),
    ).toBe('Fold·55')
    expect(
      treatmentLabel({
        id: '3',
        type: 'decay-marks',
        seed: 9,
        enabled: true,
        params: { amount: 70, kind: 2 },
      }),
    ).toBe('Wear·70')
  })

  it('creates deterministic ink-loss chips from seed and filters by kind', () => {
    const source = { id: 'photo', left: 100, top: 80, width: 500, height: 300 }
    const ink = decayMarksForTreatment(source, {
      id: 'tx-1',
      type: 'decay-marks',
      seed: 4719,
      enabled: true,
      params: { amount: 50, kind: 0 },
    })
    const fold = decayMarksForTreatment(source, {
      id: 'tx-2',
      type: 'decay-marks',
      seed: 4719,
      enabled: true,
      params: { amount: 50, kind: 1 },
    })
    expect(ink.length).toBeGreaterThan(0)
    expect(ink.every((mark) => mark.kind === 'ink-loss')).toBe(true)
    expect(fold.length).toBeGreaterThan(0)
    expect(fold.every((mark) => mark.kind === 'fold')).toBe(true)
    expect(decayMarksForTreatment(source, {
      id: 'tx-1',
      type: 'decay-marks',
      seed: 4719,
      enabled: true,
      params: { amount: 50, kind: 0 },
    })).toEqual(ink)
  })

  it('lets Tension increase mark count without changing stored amount', () => {
    const source = { id: 'photo', left: 100, top: 80, width: 500, height: 300 }
    const treatment = {
      id: 'tx-1',
      type: 'decay-marks' as const,
      seed: 12,
      enabled: true,
      params: { amount: 50, kind: 2 },
    }
    const composed = decayMarksForTreatment(source, treatment, 1)
    const restless = decayMarksForTreatment(source, treatment, 2)
    expect(treatment.params.amount).toBe(50)
    expect(restless.length).toBeGreaterThan(composed.length)
  })

  it('omits companion fragments from saved canvas JSON', () => {
    const saved = omitDecayMarkFragmentsFromCanvasJSON({
      objects: [
        { id: 'headline', treatments: [{ type: 'decay-marks', seed: 1 }] },
        { id: 'chip', decayMarkSourceId: 'headline' },
        { id: 'xerox', treatments: [{ type: 'xerox', seed: 1 }] },
      ],
    })
    expect(saved.objects?.map((item) => (item as { id: string }).id)).toEqual(['headline', 'xerox'])
  })
})
