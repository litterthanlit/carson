import { describe, expect, it } from 'vitest'
import {
  closePath,
  deletePathAnchor,
  getPathAnchorPoints,
  insertPointOnSegment,
  isPathClosed,
  movePathPoint,
  segmentHitInPathLocal,
  type PathData,
} from './pathEditing'

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

  it('inserts a point on a line segment', () => {
    const next = insertPointOnSegment(
      [
        ['M', 0, 0],
        ['L', 100, 0],
      ],
      1,
      0.5,
      50,
      0,
    )

    expect(next).toEqual([
      ['M', 0, 0],
      ['L', 50, 0],
      ['L', 100, 0],
    ])
  })

  it('deletes a line anchor when enough points remain', () => {
    const next = deletePathAnchor(
      [
        ['M', 0, 0],
        ['L', 50, 0],
        ['L', 100, 0],
      ],
      { commandIndex: 1, x: 50, y: 0, role: 'anchor' },
    )

    expect(next).toEqual([
      ['M', 0, 0],
      ['L', 100, 0],
    ])
  })

  it('refuses to delete the move anchor or the last two anchors', () => {
    const path: PathData = [
      ['M', 0, 0],
      ['L', 100, 0],
    ]
    expect(deletePathAnchor(path, { commandIndex: 0, x: 0, y: 0, role: 'anchor' })).toBeNull()
    expect(deletePathAnchor(path, { commandIndex: 1, x: 100, y: 0, role: 'anchor' })).toBeNull()
  })

  it('closes an open path by linking back to the first anchor', () => {
    const path: PathData = [
      ['M', 0, 0],
      ['L', 100, 0],
      ['L', 100, 100],
    ]
    expect(isPathClosed(path)).toBe(false)
    expect(closePath(path)).toEqual([
      ['M', 0, 0],
      ['L', 100, 0],
      ['L', 100, 100],
      ['L', 0, 0],
    ])
    expect(isPathClosed(closePath(path))).toBe(true)
  })

  it('finds the nearest segment in local space', () => {
    const hit = segmentHitInPathLocal(
      [
        ['M', 0, 0],
        ['L', 100, 0],
      ],
      50,
      4,
      10,
    )

    expect(hit).not.toBeNull()
    expect(hit?.commandIndex).toBe(1)
    expect(hit?.x).toBeCloseTo(50, 0)
    expect(hit?.y).toBeCloseTo(0, 0)
  })
})
