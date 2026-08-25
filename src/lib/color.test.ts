import { describe, expect, it } from 'vitest'
import { blendModeLabel, isBlendMode, resolveBlendPreview } from './color'

describe('blend preview', () => {
  it('labels Fabric composite ops in plain language', () => {
    expect(blendModeLabel('source-over')).toBe('Normal')
    expect(blendModeLabel('multiply')).toBe('Multiply')
    expect(isBlendMode('overlay')).toBe(true)
    expect(isBlendMode('xor')).toBe(false)
  })

  it('uses the hovered mode as a live preview without committing', () => {
    expect(resolveBlendPreview('source-over', 'multiply')).toBe('multiply')
    expect(resolveBlendPreview('multiply', null)).toBe('multiply')
    expect(resolveBlendPreview('multiply', 'not-a-mode')).toBe('multiply')
    expect(resolveBlendPreview('bogus', null)).toBe('source-over')
  })
})
