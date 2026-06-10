import { describe, expect, it } from 'vitest'
import { computeSnap } from './snapping'

const canvas = { width: 1000, height: 1000 }

describe('computeSnap', () => {
  it('snaps to the canvas left edge within threshold', () => {
    const moving = { left: 4, top: 300, width: 100, height: 50 }
    const snap = computeSnap(moving, [], canvas, 6)
    expect(snap.dx).toBe(-4)
    expect(snap.vGuides).toEqual([0])
  })

  it('snaps to the canvas horizontal center', () => {
    const moving = { left: 447, top: 300, width: 100, height: 50 } // center at 497
    const snap = computeSnap(moving, [], canvas, 6)
    expect(snap.dx).toBe(3)
    expect(snap.vGuides).toEqual([500])
  })

  it('snaps to another object edge', () => {
    const moving = { left: 196, top: 600, width: 100, height: 50 }
    const other = { left: 200, top: 100, width: 80, height: 80 }
    const snap = computeSnap(moving, [other], canvas, 6)
    expect(snap.dx).toBe(4)
    expect(snap.vGuides).toEqual([200])
  })

  it('does not snap when outside the threshold', () => {
    const moving = { left: 320, top: 321, width: 100, height: 100 }
    const snap = computeSnap(moving, [], canvas, 6)
    expect(snap.dx).toBe(0)
    expect(snap.dy).toBe(0)
    expect(snap.vGuides).toEqual([])
    expect(snap.hGuides).toEqual([])
  })

  it('picks the closest candidate when several are within threshold', () => {
    const moving = { left: 2, top: 5, width: 100, height: 100 }
    const snap = computeSnap(moving, [], canvas, 6)
    expect(snap.dx).toBe(-2)
    expect(snap.dy).toBe(-5)
  })

  it('snaps vertically and horizontally independently', () => {
    const moving = { left: 3, top: 320, width: 100, height: 100 } // x near edge, y away from guides
    const snap = computeSnap(moving, [], canvas, 6)
    expect(snap.dx).toBe(-3)
    expect(snap.dy).toBe(0)
    expect(snap.hGuides).toEqual([])
  })
})
