import { describe, expect, it } from 'vitest'
import { hudBoundsEqual, readHudBounds } from './hudBounds'

describe('hudBounds', () => {
  it('reads bounds from a fabric-like object', () => {
    const object = {
      getBoundingRect: () => ({ left: 10, top: 20, width: 100, height: 40 }),
    }
    expect(readHudBounds(object)).toEqual({ left: 10, top: 20, width: 100, height: 40 })
  })

  it('returns null when no object is active', () => {
    expect(readHudBounds(null)).toBeNull()
  })

  it('treats identical bounds as equal so live HUD can skip setState', () => {
    const bounds = { left: 1, top: 2, width: 3, height: 4 }
    expect(hudBoundsEqual(bounds, { ...bounds })).toBe(true)
    expect(hudBoundsEqual(bounds, { ...bounds, left: 9 })).toBe(false)
  })
})
