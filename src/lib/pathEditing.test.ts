import { describe, expect, it } from 'vitest'
import { getPathAnchorPoints, movePathPoint } from './pathEditing'

describe('pathEditing', () => {
  it('extracts anchor and control points from path commands', () => {
    const points = getPathAnchorPoints([
      ['M', 0, 0],
      ['C', 10, 10, 20, 20, 30, 30],
      ['L', 40, 40],
    ])

    expect(points).toEqual([
      { commandIndex: 0, x: 0, y: 0, role: 'anchor' },
      { commandIndex: 1, x: 10, y: 10, role: 'control-out' },
      { commandIndex: 1, x: 20, y: 20, role: 'control-in' },
      { commandIndex: 1, x: 30, y: 30, role: 'anchor' },
      { commandIndex: 2, x: 40, y: 40, role: 'anchor' },
    ])
  })

  it('moves anchor and control coordinates in place', () => {
    const next = movePathPoint(
      [
        ['M', 0, 0],
        ['C', 10, 10, 20, 20, 30, 30],
      ],
      { commandIndex: 1, x: 30, y: 30, role: 'anchor' },
      50,
      60,
    )

    expect(next[1]).toEqual(['C', 10, 10, 20, 20, 50, 60])
  })
})
