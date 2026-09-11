import { describe, expect, it } from 'vitest'
import {
  addAnchor,
  canCommitDraft,
  closeDraft,
  dragLastHandle,
  emptyBezierDraft,
  endHandleDrag,
  isCloseHit,
  previewSvgPath,
  removeLastAnchor,
  draftToSvgPath,
} from './bezierPen'

describe('bezierPen', () => {
  it('builds an open polyline from corner clicks', () => {
    let draft = emptyBezierDraft()
    draft = endHandleDrag(addAnchor(draft, 0, 0))
    draft = endHandleDrag(addAnchor(draft, 40, 0))
    draft = endHandleDrag(addAnchor(draft, 40, 30))

    expect(draftToSvgPath(draft)).toBe('M 0 0 L 40 0 L 40 30')
    expect(canCommitDraft(draft)).toBe(true)
  })

  it('pulls mirrored handles while dragging a new point', () => {
    let draft = emptyBezierDraft()
    draft = addAnchor(draft, 10, 10)
    draft = dragLastHandle(draft, 18, 10)

    expect(draft.points[0]?.x).toBe(10)
    expect(draft.points[0]?.y).toBe(10)
    expect(draft.points[0]?.outX).toBe(8)
    expect(draft.points[0]?.outY).toBe(0)
    expect(draft.points[0]?.inX).toBe(-8)
    expect(draft.points[0]?.inY).toBeCloseTo(0)
    expect(draftToSvgPath(endHandleDrag(addAnchor(endHandleDrag(draft), 40, 10)))).toMatch(
      /^M 10 10 C 18 10 40 10 40 10$/,
    )
  })

  it('closes when clicking near the first anchor', () => {
    let draft = emptyBezierDraft()
    draft = endHandleDrag(addAnchor(draft, 0, 0))
    draft = endHandleDrag(addAnchor(draft, 20, 0))
    draft = endHandleDrag(addAnchor(draft, 10, 16))

    expect(isCloseHit(draft, 1, 1, 8)).toBe(true)
    expect(isCloseHit(draft, 40, 40, 8)).toBe(false)
    expect(draftToSvgPath(closeDraft(draft))).toBe('M 0 0 L 20 0 L 10 16 L 0 0 Z')
  })

  it('rubber-bands a live cursor without committing it', () => {
    let draft = emptyBezierDraft()
    draft = endHandleDrag(addAnchor(draft, 0, 0))
    draft = { ...draft, cursor: { x: 12, y: 4 } }

    expect(previewSvgPath(draft)).toBe('M 0 0 L 12 4')
    expect(draftToSvgPath(draft)).toBe('M 0 0')
  })

  it('refuses to commit a single point and undoes the last anchor', () => {
    let draft = endHandleDrag(addAnchor(emptyBezierDraft(), 5, 5))
    expect(canCommitDraft(draft)).toBe(false)
    draft = endHandleDrag(addAnchor(draft, 8, 9))
    draft = removeLastAnchor(draft)
    expect(draft.points).toHaveLength(1)
    expect(removeLastAnchor(draft).points).toHaveLength(0)
  })
})
