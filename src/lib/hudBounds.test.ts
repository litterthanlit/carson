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

describe('hudPlacement', () => {
  it('docks above the selection when there is room', async () => {
    const { hudPlacement, HUD_HEIGHT } = await import('./hudBounds')
    const placement = hudPlacement({ left: 100, top: 400, width: 200, height: 100 }, 0.5)
    expect(placement.side).toBe('above')
    expect(placement.top).toBe(200 - 10 - HUD_HEIGHT)
    expect(placement.left).toBe(50)
  })

  it('flips below near the top edge and clamps left', async () => {
    const { hudPlacement } = await import('./hudBounds')
    const placement = hudPlacement({ left: -40, top: 10, width: 200, height: 100 }, 1)
    expect(placement.side).toBe('below')
    expect(placement.top).toBe(120)
    expect(placement.left).toBe(0)
  })
})
