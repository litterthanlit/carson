import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Copy, EyeOff, FlipHorizontal2, Scissors, SquareDashed, X } from 'lucide-react'
import {
  appendLassoPoint,
  ellipseSelectionPoints,
  isDegenerateSelection,
  rectSelectionPoints,
  selectionBounds,
  svgPolygonPoints,
  type PixelSelection,
  type Point,
  type SelectionMode,
} from '../lib/selection'

type SelectionOverlayProps = {
  posterWidth: number
  posterHeight: number
  displayScale: number
  /** The Select tool is active: the overlay captures pointer input. */
  active: boolean
  mode: SelectionMode
  selection: PixelSelection | null
  onSelectionChange: (selection: PixelSelection | null) => void
  /** Layer the actions apply to, if any. */
  targetName: string | null
  onMaskOut: () => void
  onKeepOnly: () => void
  onLayerViaCopy: () => void
  onLayerViaCut: () => void
}

type Draft = { anchor: Point; points: Point[] }

const BAR_HEIGHT = 36

export function SelectionOverlay({
  posterWidth,
  posterHeight,
  displayScale,
  active,
  mode,
  selection,
  onSelectionChange,
  targetName,
  onMaskOut,
  onKeepOnly,
  onLayerViaCopy,
  onLayerViaCut,
}: SelectionOverlayProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const scale = displayScale > 0 ? displayScale : 1

  const toPoster = (event: { clientX: number; clientY: number }): Point => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale }
  }

  const shapeFor = (anchor: Point, current: Point, event: { shiftKey: boolean; altKey: boolean }) => {
    const options = { square: event.shiftKey, fromCenter: event.altKey }
    return mode === 'ellipse' ? ellipseSelectionPoints(anchor, current, options) : rectSelectionPoints(anchor, current, options)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!active || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = toPoster(event)
    setDraft({ anchor: point, points: [point] })
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draft) return
    const point = toPoster(event)
    setDraft((current) => {
      if (!current) return current
      if (mode === 'lasso') return { ...current, points: appendLassoPoint(current.points, point, 3 / scale) }
      return { ...current, points: shapeFor(current.anchor, point, event) }
    })
  }

  const onPointerUp = () => {
    const finished = draft
    setDraft(null)
    if (!finished) return
    if (isDegenerateSelection(finished.points, 4 / scale)) {
      // A click (no drag) drops the selection, like Photoshop.
      onSelectionChange(null)
      return
    }
    onSelectionChange({ points: finished.points, inverted: false, feather: selection?.feather ?? 0 })
  }

  const shown = draft && draft.points.length > 2 ? draft.points : (selection?.points ?? null)
  const inverted = !draft && Boolean(selection?.inverted)
  const bounds = selection && !draft ? selectionBounds(selection.points) : null

  let barTop = 0
  let barLeft = 0
  if (bounds) {
    const above = bounds.top * scale - BAR_HEIGHT - 10
    barTop = above >= 0 ? above : (bounds.top + bounds.height) * scale + 10
    barLeft = Math.max(0, bounds.left * scale)
  }

  return (
    <div
      ref={rootRef}
      className={active ? 'selection-overlay is-active' : 'selection-overlay'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDraft(null)}
    >
      {shown ? (
        <svg
          className="selection-svg"
          viewBox={`0 0 ${posterWidth} ${posterHeight}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <path
            className="selection-tint"
            fillRule="evenodd"
            d={
              inverted
                ? `M${svgPolygonPoints(shown)}Z`
                : `M0,0H${posterWidth}V${posterHeight}H0Z M${svgPolygonPoints(shown)}Z`
            }
          />
          <polygon className="selection-ants-base" points={svgPolygonPoints(shown)} />
          <polygon className="selection-ants" points={svgPolygonPoints(shown)} />
          {inverted ? (
            <>
              <rect className="selection-ants-base" x={0} y={0} width={posterWidth} height={posterHeight} />
              <rect className="selection-ants" x={0} y={0} width={posterWidth} height={posterHeight} />
            </>
          ) : null}
        </svg>
      ) : null}
      {selection && bounds && !draft ? (
        <div
          className="selection-bar"
          role="toolbar"
          aria-label="Selection actions"
          style={{ top: barTop, left: barLeft }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span className="selection-bar-target" title={targetName ? `Acts on ${targetName}` : undefined}>
            <SquareDashed size={12} aria-hidden />
            {targetName ?? 'Pick a layer'}
          </span>
          <button type="button" disabled={!targetName} title="Hide the selected area on the layer mask (Delete)" onClick={onMaskOut}>
            <EyeOff size={13} aria-hidden />
            Mask out
          </button>
          <button type="button" disabled={!targetName} title="Hide everything outside the selection" onClick={onKeepOnly}>
            Keep only
          </button>
          <button type="button" disabled={!targetName} title="Lift the selected area to a new layer (⌘J)" onClick={onLayerViaCopy}>
            <Copy size={13} aria-hidden />
            Layer via copy
          </button>
          <button type="button" disabled={!targetName} title="Cut the selected area to a new layer (⇧⌘J)" onClick={onLayerViaCut}>
            <Scissors size={13} aria-hidden />
            Cut
          </button>
          <span className="selection-bar-rule" aria-hidden />
          <button
            type="button"
            aria-pressed={selection.inverted}
            title="Invert selection (⇧⌘I)"
            onClick={() => onSelectionChange({ ...selection, inverted: !selection.inverted })}
          >
            <FlipHorizontal2 size={13} aria-hidden />
            Invert
          </button>
          <label className="selection-feather" title="Feather: soften the selection edge (poster px)">
            Feather
            <input
              type="number"
              min={0}
              max={Math.round(Math.max(posterWidth, posterHeight) / 4)}
              value={Math.round(selection.feather)}
              onChange={(event) => onSelectionChange({ ...selection, feather: Math.max(0, Number(event.target.value) || 0) })}
            />
          </label>
          <button type="button" className="icon-button" aria-label="Deselect" title="Deselect (Esc)" onClick={() => onSelectionChange(null)}>
            <X size={13} />
          </button>
        </div>
      ) : null}
    </div>
  )
}
