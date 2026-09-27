import { describe, expect, it } from 'vitest'
import { needsDetail } from './detailOverlay'

describe('needsDetail', () => {
  it('only refines when the backing store is softer than the screen', () => {
    // A3 at fit on a 2× display: backstore already covers the screen.
    expect(needsDetail(0.375, 0.126, 2)).toBe(false)
    // A3 at 245% on a 2× display with the 24MP cap (~1.17×): refine.
    expect(needsDetail(1.17, 2.45, 2)).toBe(true)
    // Within 2% counts as sharp.
    expect(needsDetail(0.99, 1, 1)).toBe(false)
  })
})
