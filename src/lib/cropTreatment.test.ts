import { describe, expect, it } from 'vitest'
import { cropModeFromParams, cropModeToParam } from './cropTreatment'
import { treatmentLabel } from './treatments'

describe('cropTreatment', () => {
  it('maps crop mode params', () => {
    expect(cropModeFromParams({ mode: 0 })).toBe('close')
    expect(cropModeFromParams({ mode: 1 })).toBe('edge')
    expect(cropModeFromParams({ mode: 2 })).toBe('off-center')
    expect(cropModeToParam('close')).toBe(0)
    expect(cropModeToParam('edge')).toBe(1)
    expect(cropModeToParam('off-center')).toBe(2)
  })

  it('labels crop treatments in the stack UI', () => {
    expect(
      treatmentLabel({
        id: '1',
        type: 'crop',
        seed: 42,
        enabled: true,
        params: { mode: 2 },
      }),
    ).toBe('Crop·off-center')
  })
})
