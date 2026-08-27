import { describe, expect, it } from 'vitest'
import { formatCmyk, gamutReadout, isOutOfGamut, softProofHex } from './cmykPreview'

describe('cmykPreview', () => {
  it('soft-proofs hex colors', () => {
    expect(softProofHex('#ff0000')).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('keeps mid gray close to press', () => {
    expect(isOutOfGamut(128, 128, 128)).toBe(false)
  })

  it('reports a gamut shift for electric RGB greens', () => {
    expect(isOutOfGamut(0, 255, 0)).toBe(true)
    expect(softProofHex('#00ff00')).not.toBe('#00ff00')
  })

  it('builds an inspector readout without judging the color', () => {
    const hot = gamutReadout('#00ff00')
    expect(hot?.outOfGamut).toBe(true)
    expect(formatCmyk(hot!.cmyk)).toMatch(/^C\d+ M\d+ Y\d+ K\d+$/)
    expect(gamutReadout('#808080')?.outOfGamut).toBe(false)
  })
})
