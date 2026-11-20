import { describe, expect, it } from 'vitest'
import { breakRayGunCopy, normalizeCopyStream } from './breakCopy'

const SAMPLE =
  'RAY GUN POP 50 RG 58 4046 WORDS ROBERT PLANT AND JIMMY PAGE INTERVIEW BY DAVE GROHL PHOTOGRAPHY BY TERRY DOYLE'

describe('breakRayGunCopy', () => {
  it('strips word spaces, uppercases, inserts mid-word hyphens, and tightens leading', () => {
    const res = breakRayGunCopy(SAMPLE, 42)
    expect(res.lineHeight).toBeLessThan(0.95)
    expect(res.charSpacing).toBeLessThan(0)
    const lines = res.text.split('\n')
    expect(lines.length).toBeGreaterThan(5)
    // No spaces survive inside the broken lines.
    expect(res.text).not.toMatch(/[ \t]/)
    // Stripping line-end hyphens and newlines restores the exact character stream.
    const restored = res.text.replace(/-\n/g, '').replace(/\n/g, '')
    expect(restored).toBe(normalizeCopyStream(SAMPLE))
  })

  it('is deterministic per seed and produces distinct rhythms for different seeds', () => {
    const a = breakRayGunCopy(SAMPLE, 7)
    const b = breakRayGunCopy(SAMPLE, 7)
    const c = breakRayGunCopy(SAMPLE, 91)
    expect(a.text).toBe(b.text)
    expect(a.text).not.toBe(c.text)
  })

  it('never doubles trailing hyphens and handles short strings gracefully', () => {
    const res = breakRayGunCopy('RAY-GUN-POP-50', 11)
    expect(res.text).not.toContain('--')
    expect(breakRayGunCopy('HI', 1).text).toBe('HI')
  })
})
