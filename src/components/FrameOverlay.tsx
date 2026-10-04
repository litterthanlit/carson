import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  clipSegmentToRect,
  frameDashPattern,
  frameGeometry,
  frameRectFromDrag,
  snapToTargets,
  type FrameSpec,
} from '../lib/frameHandles'
import { SELECTION_ACCENT } from '../lib/selectionChrome'
import { SNAP_SCREEN_THRESHOLD } from '../lib/editorConstants'

export type FrameRect = { left: number; top: number; width: number; height: number }
export type FrameSnapTargets = { xs: number[]; ys: number[] }

type FrameOverlayProps = {
  /** The Frame tool is active: the overlay captures pointer input. */
  active: boolean
  posterWidth: number
  posterHeight: number
  displayScale: number
  spec: FrameSpec
  color: string
  /** Edges to snap to, read once when a drag starts. */
  readSnapTargets: () => FrameSnapTargets
  onDraw: (rect: FrameRect) => void
  /** A click without a drag: frame whatever layer is under the point. */
  onPick: (point: { x: number; y: number }) => void
}

type Point = { x: number; y: number }
type Draft = {
  anchor: Point
  current: Point
  rect: FrameRect
  guides: { v: number[]; h: number[] }
  dragged: boolean
}

/** Screen pixels a press may travel and still count as a click. */
const CLICK_SLOP_PX = 4

/**
 * Drag a frame out on the poster (Shift square, Alt from center, ⌘/Ctrl to skip
 * snapping), or click a layer to frame it exactly. The preview is the frame
 * itself, at its real weight and handle size.
 */
export function FrameOverlay({ active, posterWidth, posterHeight, displayScale, spec, color, readSnapTargets, onDraw, onPick }: FrameOverlayProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const targetsRef = useRef<FrameSnapTargets>({ xs: [], ys: [] })
  const [draft, setDraft] = useState<Draft | null>(null)
  const scale = displayScale > 0 ? displayScale : 1

  useEffect(() => {
    if (!draft) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setDraft(null)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [draft])

  useEffect(() => {
    if (!active) setDraft(null)
  }, [active])

  const toPoster = (event: { clientX: number; clientY: number }): Point => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale }
  }

  const snap = (point: Point, enabled: boolean) => {
    if (!enabled) return { point, v: [] as number[], h: [] as number[] }
    const threshold = SNAP_SCREEN_THRESHOLD / scale
    const x = snapToTargets(point.x, targetsRef.current.xs, threshold)
    const y = snapToTargets(point.y, targetsRef.current.ys, threshold)
    return { point: { x: x.value, y: y.value }, v: x.guide === null ? [] : [x.guide], h: y.guide === null ? [] : [y.guide] }
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!active || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    targetsRef.current = readSnapTargets()
    const raw = toPoster(event)
    const snapped = snap(raw, !(event.metaKey || event.ctrlKey))
    setDraft({
      anchor: snapped.point,
      current: raw,
      rect: { left: snapped.point.x, top: snapped.point.y, width: 0, height: 0 },
      guides: { v: [], h: [] },
      dragged: false,
    })
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draft) return
    const raw = toPoster(event)
    const dragged =
      draft.dragged || Math.hypot(raw.x - draft.anchor.x, raw.y - draft.anchor.y) * scale > CLICK_SLOP_PX
    const snapped = snap(raw, !(event.metaKey || event.ctrlKey))
    const rect = frameRectFromDrag(draft.anchor, snapped.point, { square: event.shiftKey, fromCenter: event.altKey })
    setDraft({ ...draft, current: raw, rect, guides: { v: snapped.v, h: snapped.h }, dragged })
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const finished = draft
    setDraft(null)
    if (!finished) return
    if (!finished.dragged) {
      onPick(toPoster(event))
      return
    }
    // A flat drag still makes a frame: a rule with handles at its ends.
    const rect = {
      ...finished.rect,
      width: Math.max(1, finished.rect.width),
      height: Math.max(1, finished.rect.height),
    }
    onDraw(rect)
  }

  const shown = draft?.dragged ? draft.rect : null
  let preview: { d: string; handles: { x: number; y: number }[] } | null = null
  if (shown) {
    const cx = shown.left + shown.width / 2
    const cy = shown.top + shown.height / 2
    const poster = { left: 0, top: 0, right: posterWidth, bottom: posterHeight }
    const geometry = frameGeometry(Math.max(1, shown.width), Math.max(1, shown.height), spec, {
      reach: 4 * (posterWidth + posterHeight),
      clipRay: (from, to) => clipSegmentToRect({ x: from.x + cx, y: from.y + cy }, { x: to.x + cx, y: to.y + cy }, poster),
    })
    preview = {
      d: geometry.segments.map((s) => `M${s.x1 + cx} ${s.y1 + cy}L${s.x2 + cx} ${s.y2 + cy}`).join(''),
      handles: geometry.handles.map((handle) => ({ x: handle.x + cx, y: handle.y + cy })),
    }
  }

  const fill = spec.handleFill === 'solid' ? color : spec.handleFill === 'knockout' ? spec.knockout : 'none'

  return (
    <div
      ref={rootRef}
      className={active ? 'frame-overlay is-active' : 'frame-overlay'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDraft(null)}
    >
      {shown && preview ? (
        <>
          <svg
            className="frame-overlay-svg"
            viewBox={`0 0 ${posterWidth} ${posterHeight}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            {draft?.guides.v.map((x) => (
              <line key={`v${x}`} className="frame-overlay-guide" x1={x} y1={0} x2={x} y2={posterHeight} stroke={SELECTION_ACCENT} />
            ))}
            {draft?.guides.h.map((y) => (
              <line key={`h${y}`} className="frame-overlay-guide" x1={0} y1={y} x2={posterWidth} y2={y} stroke={SELECTION_ACCENT} />
            ))}
            {preview.d ? (
              <path
                d={preview.d}
                fill="none"
                stroke={color}
                strokeWidth={spec.weight}
                strokeLinecap="square"
                strokeDasharray={frameDashPattern(spec.dash, spec.weight).join(' ') || undefined}
              />
            ) : null}
            {preview.handles.map((handle, index) => (
              <rect
                key={index}
                x={handle.x - spec.handleSize / 2}
                y={handle.y - spec.handleSize / 2}
                width={spec.handleSize}
                height={spec.handleSize}
                fill={fill}
                stroke={color}
                strokeWidth={spec.weight}
              />
            ))}
          </svg>
          <span
            className="frame-overlay-size"
            style={{ left: (shown.left + shown.width / 2) * scale, top: (shown.top + shown.height) * scale + spec.handleSize * scale * 0.5 + 8 }}
          >
            {Math.round(shown.width)} × {Math.round(shown.height)}
          </span>
        </>
      ) : null}
    </div>
  )
}
