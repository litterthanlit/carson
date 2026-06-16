import { describe, expect, it } from 'vitest'
import { isOutOfGamut, softProofHex } from './cmykPreview'

describe('cmykPreview', () => {
  it('soft-proofs hex colors', () => {
    expect(softProofHex('#ff0000')).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('reports gamut delta for bright RGB', () => {
    expect(typeof isOutOfGamut(255, 0, 255)).toBe('boolean')
  })
})
