import { describe, expect, it } from 'vitest'
import { getPrintScanProfile } from './editorModel'
import {
  misprintParamsFromGeneration,
  misprintPoseForTreatment,
  omitMisprintFragmentsFromCanvasJSON,
} from './misprintTreatment'
import { treatmentLabel } from './treatments'

describe('misprintTreatment', () => {
  it('derives offset and opacity from xerox generation', () => {
    expect(misprintParamsFromGeneration(1).offset).toBe(getPrintScanProfile(1).misregistration)
    expect(misprintParamsFromGeneration(5).offset).toBe(getPrintScanProfile(5).misregistration)
    expect(misprintParamsFromGeneration(5).opacity).toBeGreaterThan(misprintParamsFromGeneration(1).opacity)
    expect(misprintParamsFromGeneration(10).offset).toBeGreaterThan(misprintParamsFromGeneration(1).offset)
  })

  it('labels misprint treatments in the chip row', () => {
    expect(
      treatmentLabel({
        id: '1',
        type: 'misprint',
        seed: 9,
        enabled: true,
        params: { generation: 5, offset: 10, opacity: 0.27 },
      }),
    ).toBe('Misprint·10')
  })

  it('is deterministic for a seed and lets Tension widen the offset without mutating stored params', () => {
    const source = { left: 100, top: 80, angle: 4 }
    const treatment = {
      id: 'tx-1',
      type: 'misprint' as const,
      seed: 4719,
      enabled: true,
      params: { generation: 5, offset: 10, opacity: 0.27 },
    }
    const first = misprintPoseForTreatment(source, treatment, 1)
    const second = misprintPoseForTreatment(source, treatment, 1)
    const restless = misprintPoseForTreatment(source, treatment, 2)
    expect(first).toEqual(second)
    expect(treatment.params.offset).toBe(10)
    expect(Math.abs(restless.left - source.left)).toBeGreaterThan(Math.abs(first.left - source.left))
  })

  it('omits companion fragments from saved canvas JSON', () => {
    const saved = omitMisprintFragmentsFromCanvasJSON({
      objects: [
        { id: 'headline', treatments: [{ type: 'misprint', seed: 1 }] },
        { id: 'echo', misprintSourceId: 'headline' },
        { id: 'xerox', treatments: [{ type: 'xerox', seed: 1 }] },
      ],
    })
    expect(saved.objects?.map((item) => (item as { id: string }).id)).toEqual(['headline', 'xerox'])
  })
})
