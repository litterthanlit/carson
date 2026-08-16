import { describe, expect, it } from 'vitest'
import { constrainMoveDelta, constrainUniformScale, snapRotation } from './transformConstraints'

describe('transformConstraints', () => {
  it('locks move to the dominant axis', () => {
    expect(constrainMoveDelta(12, 3)).toEqual({ dx: 12, dy: 0 })
    expect(constrainMoveDelta(-2, 9)).toEqual({ dx: 0, dy: 9 })
  })

  it('scales both axes from the larger relative change', () => {
    expect(constrainUniformScale(2, 1.1, { scaleX: 1, scaleY: 1 })).toEqual({ scaleX: 2, scaleY: 2 })
    expect(constrainUniformScale(1.05, 0.5, { scaleX: 1, scaleY: 1 })).toEqual({ scaleX: 0.5, scaleY: 0.5 })
  })

  it('snaps rotation to 15 degrees', () => {
    expect(snapRotation(7)).toBe(0)
    expect(snapRotation(8)).toBe(15)
    expect(snapRotation(-22)).toBe(-15)
  })
})
