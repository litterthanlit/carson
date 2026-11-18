import { useRef, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react'
import { CROP_HANDLES, type CropHandle, type CropRect, type Vec } from '../lib/cropGeometry'
import type { CropSession } from '../lib/cropSession'

type CropOverlayProps = {
  session: CropSession
  posterWidth: number
  posterHeight: number
  displayScale: number
}

const HANDLE_LABELS: Record<CropHandle, string> = {
  nw: 'Crop top-left corner',
  n: 'Crop top edge',
  ne: 'Crop top-right corner',
  e: 'Crop right edge',
  se: 'Crop bottom-right corner',
  s: 'Crop bottom edge',
  sw: 'Crop bottom-left corner',
  w: 'Crop left edge',
}

const HANDLE_CURSORS: Record<CropHandle, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
}

function apply(m: number[], p: Vec): Vec {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] }
}

function handlePoint(rect: CropRect, handle: CropHandle): Vec {
  const x = handle.includes('w') ? rect.x : handle.includes('e') ? rect.x + rect.width : rect.x + rect.width / 2
  const y = handle.startsWith('n') ? rect.y : handle.startsWith('s') ? rect.y + rect.height : rect.y + rect.height / 2
  return { x, y }
}

type Drag =
  | { kind: 'handle'; handle: CropHandle; from: CropRect; start: Vec }
  | { kind: 'pan'; from: ReturnType<CropSession['panStart']>; start: Vec }

/**
 * Crop mode over the canvas: the whole image shows, everything outside the
 * frame is dimmed, eight handles resize the frame and dragging anywhere else
 * slides the photo under it. Handles are buttons: Tab to one, arrows move it.
 */
export function CropOverlay({ session, posterWidth, posterHeight, displayScale }: CropOverlayProps) {
  const { rect, keepAspect } = useSyncExternalStore(session.subscribe, session.snapshot)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const scale = displayScale > 0 ? displayScale : 1
  const matrix = session.matrix()
  const { width: sourceWidth, height: sourceHeight } = session.source
  // Local coordinates have their origin at the whole image's centre.
  const toPoster = (p: Vec) => apply(matrix, { x: p.x - sourceWidth / 2, y: p.y - sourceHeight / 2 })
  const quad = (r: CropRect) =>
    [
      { x: r.x, y: r.y },
      { x: r.x + r.width, y: r.y },
      { x: r.x + r.width, y: r.y + r.height },
      { x: r.x, y: r.y + r.height },
    ].map(toPoster)
  const path = (points: Vec[]) => `M${points.map((p) => `${p.x},${p.y}`).join('L')}Z`
  const image = quad({ x: 0, y: 0, width: sourceWidth, height: sourceHeight })
  const frame = quad(rect)
  const thirds: string[] = []
  for (const t of [1 / 3, 2 / 3]) {
    const a = toPoster({ x: rect.x + rect.width * t, y: rect.y })
    const b = toPoster({ x: rect.x + rect.width * t, y: rect.y + rect.height })
    const c = toPoster({ x: rect.x, y: rect.y + rect.height * t })
    const d = toPoster({ x: rect.x + rect.width, y: rect.y + rect.height * t })
    thirds.push(`M${a.x},${a.y}L${b.x},${b.y}`, `M${c.x},${c.y}L${d.x},${d.y}`)
  }

  const pointerPoster = (event: ReactPointerEvent): Vec => {
    const box = rootRef.current!.getBoundingClientRect()
    return { x: (event.clientX - box.left) / scale, y: (event.clientY - box.top) / scale }
  }

  const capture = (event: ReactPointerEvent) => {
    try {
      rootRef.current?.setPointerCapture(event.pointerId)
    } catch {
      // Synthetic pointers can't be captured; the overlay still tracks the drag.
    }
  }

  return (
    <div
      ref={rootRef}
      className="crop-overlay"
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        capture(event)
        dragRef.current = { kind: 'pan', from: session.panStart(), start: pointerPoster(event) }
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current
        if (!drag) return
        const now = pointerPoster(event)
        const delta = session.toLocal({ x: now.x - drag.start.x, y: now.y - drag.start.y })
        if (drag.kind === 'pan') session.pan(drag.from, delta)
        else session.resize(drag.from, drag.handle, delta, keepAspect || event.shiftKey)
      }}
      onPointerUp={() => {
        dragRef.current = null
      }}
      onPointerCancel={() => {
        dragRef.current = null
      }}
    >
      <svg viewBox={`0 0 ${posterWidth} ${posterHeight}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path className="crop-dim" d={`${path(image)}${path(frame)}`} fillRule="evenodd" />
        <path className="crop-image-edge" d={path(image)} />
        <path className="crop-thirds" d={thirds.join('')} />
        <path className="crop-frame" d={path(frame)} />
      </svg>
      {CROP_HANDLES.map((handle) => {
        const p = toPoster(handlePoint(rect, handle))
        return (
          <button
            key={handle}
            type="button"
            className={`crop-handle crop-handle-${handle.length === 2 ? 'corner' : 'edge'}`}
            aria-label={HANDLE_LABELS[handle]}
            title={`${HANDLE_LABELS[handle]}: drag, or arrow keys (Shift ×10)`}
            style={{ left: p.x * scale, top: p.y * scale, cursor: HANDLE_CURSORS[handle] }}
            onPointerDown={(event) => {
              if (event.button !== 0) return
              event.preventDefault()
              event.stopPropagation()
              capture(event)
              dragRef.current = { kind: 'handle', handle, from: session.rect, start: pointerPoster(event) }
            }}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 10 : 1
              const moves: Record<string, Vec> = {
                ArrowLeft: { x: -step, y: 0 },
                ArrowRight: { x: step, y: 0 },
                ArrowUp: { x: 0, y: -step },
                ArrowDown: { x: 0, y: step },
              }
              const move = moves[event.key]
              if (!move) return
              event.preventDefault()
              event.stopPropagation()
              session.resize(session.rect, handle, move)
            }}
          />
        )
      })}
    </div>
  )
}
