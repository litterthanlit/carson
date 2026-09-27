import { describe, expect, it } from 'vitest'
import { BACKSTORE_MAX_PIXELS, backstoreScale } from './backstoreScale'

describe('backstoreScale', () => {
  it('matches screen resolution when the poster is zoomed out', () => {
    // A3 @ 300dpi fit into a laptop viewport on a 2× display.
    const scale = backstoreScale(0.126, 2, 3508, 4961)
    expect(scale).toBeGreaterThanOrEqual(0.126 * 2)
    expect(scale).toBeLessThan(0.4)
    // ~70× fewer pixels than Fabric's default (dpr 2 → scale 2).
    expect((2 / scale) ** 2).toBeGreaterThan(25)
  })

  it('never exceeds full retina resolution', () => {
    expect(backstoreScale(4, 2, 1080, 1350)).toBe(2)
    expect(backstoreScale(1, 1, 1080, 1350)).toBe(1)
  })

  it('stays inside the pixel budget for huge posters', () => {
    const scale = backstoreScale(8, 2, 4961, 7016)
    expect(4961 * scale * 7016 * scale).toBeLessThanOrEqual(BACKSTORE_MAX_PIXELS + 1)
  })

  it('quantizes so tiny zoom changes reuse the same backing store', () => {
    expect(backstoreScale(0.5, 2, 2000, 2000)).toBe(backstoreScale(0.49, 2, 2000, 2000))
  })

  it('tolerates bad inputs', () => {
    expect(backstoreScale(Number.NaN, 0, 1000, 1000)).toBeGreaterThan(0)
  })
})
