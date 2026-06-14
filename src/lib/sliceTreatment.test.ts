import { describe, expect, it } from 'vitest'
import { sliceDirectionFromParams, sliceDirectionToParam } from './sliceTreatment'
import { treatmentLabel } from './treatments'

describe('sliceTreatment', () => {
  it('maps direction params to axis labels', () => {
    expect(sliceDirectionFromParams({ direction: 0 })).toBe('horizontal')
    expect(sliceDirectionFromParams({ direction: 1 })).toBe('vertical')
    expect(sliceDirectionToParam('horizontal')).toBe(0)
    expect(sliceDirectionToParam('vertical')).toBe(1)
  })

  it('labels slice treatments in the stack UI', () => {
    expect(
      treatmentLabel({
        id: '1',
        type: 'slice',
        seed: 99,
        enabled: true,
        params: { direction: 1, pieces: 5, gap: 9 },
      }),
    ).toBe('Slice·V·5')
  })
})
