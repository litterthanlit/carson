import { describe, expect, it } from 'vitest'
import { omitTypeStripFragmentsFromCanvasJSON, typeStripsForTreatment } from './typeStripsTreatment'
import { treatmentLabel } from './treatments'

describe('typeStripsTreatment', () => {
  it('labels type-strip treatments in the chip row', () => {
    expect(
      treatmentLabel({
        id: '1',
        type: 'type-strips',
        seed: 9,
        enabled: true,
        params: { rows: 5, height: 18, gap: 4, jitter: 12 },
      }),
    ).toBe('Type strip·5')
  })

  it('creates deterministic print bars from seed', () => {
    const source = { id: 'headline', text: 'RAY GUN', left: 40, top: 80, width: 400, height: 120 }
    const treatment = {
      id: 'tx-1',
      type: 'type-strips' as const,
      seed: 4719,
      enabled: true,
      params: { rows: 5, height: 18, gap: 4, jitter: 12 },
    }
    const first = typeStripsForTreatment(source, treatment)
    const second = typeStripsForTreatment(source, treatment)
    expect(first).toHaveLength(5)
    expect(first).toEqual(second)
    expect(first[0]?.text).toContain('RAY GUN')
    expect(first[0]?.top).toBeGreaterThan(source.top + source.height)
  })

  it('lets Tension increase jitter without changing stored params', () => {
    const source = { id: 'headline', text: 'CUT TYPE', left: 40, top: 80, width: 400, height: 120 }
    const treatment = {
      id: 'tx-1',
      type: 'type-strips' as const,
      seed: 12,
      enabled: true,
      params: { rows: 5, height: 18, gap: 4, jitter: 12 },
    }
    const composed = typeStripsForTreatment(source, treatment, 1)
    const restless = typeStripsForTreatment(source, treatment, 2)
    expect(treatment.params.jitter).toBe(12)
    const composedSpread = Math.max(...composed.map((strip) => Math.abs(strip.left - source.left)))
    const restlessSpread = Math.max(...restless.map((strip) => Math.abs(strip.left - source.left)))
    expect(restlessSpread).toBeGreaterThan(composedSpread)
  })

  it('omits companion fragments from saved canvas JSON', () => {
    const saved = omitTypeStripFragmentsFromCanvasJSON({
      objects: [
        { id: 'headline', treatments: [{ type: 'type-strips', seed: 1 }] },
        { id: 'strip', typeStripSourceId: 'headline' },
        { id: 'xerox', treatments: [{ type: 'xerox', seed: 1 }] },
      ],
    })
    expect(saved.objects?.map((item) => (item as { id: string }).id)).toEqual(['headline', 'xerox'])
  })
})
