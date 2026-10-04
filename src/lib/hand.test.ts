import { describe, expect, it } from 'vitest'
import { createSeededRandom } from './random'
import { handJitter, handShove, pressMisfeed } from './hand'

describe('hand', () => {
  it('jitters mostly small, now and then large', () => {
    const random = createSeededRandom(3)
    const values = Array.from({ length: 4000 }, () => handJitter(random))
    for (const value of values) expect(Math.abs(value)).toBeLessThanOrEqual(1)
    const small = values.filter((value) => Math.abs(value) < 0.33).length / values.length
    // A flat range would put a third here; a hand puts well over half.
    expect(small).toBeGreaterThan(0.5)
  })

  it('shoves in millimetres of the sheet', () => {
    const near = handShove(createSeededRandom(9), 10, 12, 11.8)
    const far = handShove(createSeededRandom(9), 10, 12, 23.6)
    expect(Math.hypot(far.dx, far.dy)).toBeCloseTo(Math.hypot(near.dx, near.dy) * 2, 6)
    expect(Math.hypot(near.dx, near.dy)).toBeLessThanOrEqual(10 * 11.8)
    expect(Math.abs(near.angle)).toBeLessThanOrEqual(12)
  })

  it('misfeeds a fraction of a millimetre, mostly along the feed, turning about the gripper edge', () => {
    const point = { x: 400, y: 900 }
    const landed = pressMisfeed(createSeededRandom(5), point, 0.8, 11.8, 2000)
    const shift = Math.hypot(landed.x - point.x, landed.y - point.y)
    expect(shift).toBeGreaterThan(0)
    expect(Math.abs(landed.angle)).toBeLessThan(0.6)
    // Far from the gripper the turn moves the point more than near it.
    const nearGripper = pressMisfeed(createSeededRandom(5), { x: 400, y: 10 }, 0.8, 11.8, 2000)
    expect(Math.abs(landed.x - point.x)).toBeGreaterThanOrEqual(Math.abs(nearGripper.x - 400) - 1e-6)
  })

  it('is the same move for the same seed', () => {
    expect(handShove(createSeededRandom(1), 8, 10, 11.8)).toEqual(handShove(createSeededRandom(1), 8, 10, 11.8))
  })
})
