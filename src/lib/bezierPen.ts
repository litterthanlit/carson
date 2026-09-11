/**
 * Click-to-place bezier pen — Illustrator-style anchors and handles.
 * Pure geometry; callers inject canvas pointers and commit a Fabric path.
 */

export type BezierAnchor = {
  x: number
  y: number
  inX: number
  inY: number
  outX: number
  outY: number
}

export type BezierPenDraft = {
  points: BezierAnchor[]
  closed: boolean
  cursor: { x: number; y: number } | null
  dragging: boolean
}

const HANDLE_EPS = 0.5

export function emptyBezierDraft(): BezierPenDraft {
  return { points: [], closed: false, cursor: null, dragging: false }
}

export function cornerAnchor(x: number, y: number): BezierAnchor {
  return { x, y, inX: 0, inY: 0, outX: 0, outY: 0 }
}

export function hasOutgoingHandle(point: BezierAnchor) {
  return Math.hypot(point.outX, point.outY) > HANDLE_EPS
}

export function hasIncomingHandle(point: BezierAnchor) {
  return Math.hypot(point.inX, point.inY) > HANDLE_EPS
}

export function isCloseHit(
  draft: BezierPenDraft,
  x: number,
  y: number,
  threshold: number,
) {
  if (draft.points.length < 2 || draft.closed) return false
  const first = draft.points[0]
  if (!first) return false
  return Math.hypot(x - first.x, y - first.y) <= threshold
}

export function addAnchor(draft: BezierPenDraft, x: number, y: number): BezierPenDraft {
  if (draft.closed) return draft
  return {
    ...draft,
    points: [...draft.points, cornerAnchor(x, y)],
    cursor: null,
    dragging: true,
  }
}

export function dragLastHandle(draft: BezierPenDraft, x: number, y: number): BezierPenDraft {
  if (!draft.dragging || draft.points.length === 0) return draft
  const last = draft.points[draft.points.length - 1]
  if (!last) return draft
  const outX = x - last.x
  const outY = y - last.y
  const nextLast: BezierAnchor = {
    ...last,
    outX,
    outY,
    inX: -outX,
    inY: -outY,
  }
  return {
    ...draft,
    points: [...draft.points.slice(0, -1), nextLast],
    cursor: { x, y },
  }
}

export function endHandleDrag(draft: BezierPenDraft): BezierPenDraft {
  return { ...draft, dragging: false, cursor: draft.cursor }
}

export function moveCursor(draft: BezierPenDraft, x: number, y: number): BezierPenDraft {
  if (draft.dragging || draft.closed) return draft
  return { ...draft, cursor: { x, y } }
}

export function closeDraft(draft: BezierPenDraft): BezierPenDraft {
  if (draft.points.length < 2) return draft
  return { ...draft, closed: true, dragging: false, cursor: null }
}

export function removeLastAnchor(draft: BezierPenDraft): BezierPenDraft {
  if (draft.points.length === 0 || draft.closed) return emptyBezierDraft()
  return {
    ...draft,
    points: draft.points.slice(0, -1),
    dragging: false,
    cursor: null,
  }
}

function segmentCommand(from: BezierAnchor, to: BezierAnchor) {
  if (hasOutgoingHandle(from) || hasIncomingHandle(to)) {
    return ` C ${from.x + from.outX} ${from.y + from.outY} ${to.x + to.inX} ${to.y + to.inY} ${to.x} ${to.y}`
  }
  return ` L ${to.x} ${to.y}`
}

export function draftToSvgPath(draft: BezierPenDraft): string {
  const points = draft.points
  const first = points[0]
  if (!first) return ''
  let d = `M ${first.x} ${first.y}`
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1]
    const curr = points[index]
    if (!prev || !curr) continue
    d += segmentCommand(prev, curr)
  }
  if (draft.closed && points.length >= 2) {
    const last = points[points.length - 1]
    if (last) d += segmentCommand(last, first)
    d += ' Z'
  }
  return d
}

/** Rubber-band preview including the live cursor as a corner point. */
export function previewSvgPath(draft: BezierPenDraft): string {
  if (!draft.cursor || draft.dragging || draft.closed || draft.points.length === 0) {
    return draftToSvgPath(draft)
  }
  return draftToSvgPath({
    ...draft,
    points: [...draft.points, cornerAnchor(draft.cursor.x, draft.cursor.y)],
  })
}

export function canCommitDraft(draft: BezierPenDraft) {
  return draft.points.length >= 2
}
