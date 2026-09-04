import { describe, expect, it } from 'vitest'
import { omitPressCheckFragmentsFromCanvasJSON } from './pressCheckTreatment'

describe('pressCheckTreatment', () => {
  it('omits companion overlays from saved canvas JSON', () => {
    const saved = omitPressCheckFragmentsFromCanvasJSON({
      objects: [
        { id: 'headline', treatments: [{ type: 'xerox', seed: 1 }] },
        { id: 'press', pressCheckTreatmentId: 'tx-1', pressCheckFragment: true },
        { id: 'echo', treatments: [{ type: 'misprint', seed: 2 }] },
      ],
    })
    expect(saved.objects?.map((item) => (item as { id: string }).id)).toEqual(['headline', 'echo'])
  })
})
