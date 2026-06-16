import { describe, expect, it } from 'vitest'
import { treatmentLabel } from './treatments'

describe('artifact treatments', () => {
  it('labels tear, bad-crop, and glyph-break', () => {
    expect(
      treatmentLabel({ id: '1', type: 'tear', seed: 1, enabled: true, params: { pieces: 7 } }),
    ).toBe('Tear·7')
    expect(
      treatmentLabel({ id: '2', type: 'bad-crop', seed: 2, enabled: true, params: { direction: 0 } }),
    ).toBe('Bad crop·H')
    expect(
      treatmentLabel({ id: '3', type: 'glyph-break', seed: 3, enabled: true, params: { intensity: 80 } }),
    ).toBe('Glyphs·80')
  })
})
