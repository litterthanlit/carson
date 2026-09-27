import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { MESH_SIZE, warpHandles, warpPoint, withHandle, type Vec, type Warp } from '../lib/warp'

type WarpOverlayProps = {
  warp: Warp
  /** Layer's full transform (local → poster), Fabric matrix order. */
  matrix: number[]
  /** Unwarped box size in local units. */
  boxWidth: number
  boxHeight: number
  posterWidth: number
  posterHeight: number
  displayScale: number
  onChange: (warp: Warp) => void
}

function apply(m: number[], p: Vec): Vec {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] }
}

function invert(m: number[]): number[] {
  const det = m[0] * m[3] - m[1] * m[2] || 1e-12
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det]
}

/**
 * Handles and a live mesh preview for Distort / Warp editing, drawn in poster
 * space over the canvas. Dragging a handle updates the layer's warp in place.
 */
export function WarpOverlay({ warp, matrix, boxWidth, boxHeight, posterWidth, posterHeight, displayScale, onChange }: WarpOverlayProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<number | null>(null)
  const scale = displayScale > 0 ? displayScale : 1
  const toPoster = (n: Vec) => apply(matrix, { x: (n.x - 0.5) * boxWidth, y: (n.y - 0.5) * boxHeight })
  const handleRadius = 6 / scale

  const lines: string[] = []
  const steps = 24
  const divisions = warp.type === 'mesh' ? MESH_SIZE - 1 : 4
  for (let g = 0; g <= divisions; g += 1) {
    const f = g / divisions
    const across: string[] = []
    const down: string[] = []
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps
      const a = toPoster(warpPoint(warp, t, f))
      const b = toPoster(warpPoint(warp, f, t))
      across.push(`${a.x},${a.y}`)
      down.push(`${b.x},${b.y}`)
    }
    lines.push(across.join(' '), down.join(' '))
  }

  const pointerToNormalized = (event: ReactPointerEvent): Vec => {
    const rect = rootRef.current!.getBoundingClientRect()
    const poster = { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale }
    const local = apply(invert(matrix), poster)
    return { x: local.x / boxWidth + 0.5, y: local.y / boxHeight + 0.5 }
  }

  return (
    <div
      ref={rootRef}
      className="warp-overlay"
      onPointerMove={(event) => {
        if (dragRef.current == null) return
        onChange(withHandle(warp, dragRef.current, pointerToNormalized(event)))
      }}
      onPointerUp={() => {
        dragRef.current = null
      }}
      onPointerCancel={() => {
        dragRef.current = null
      }}
    >
      <svg viewBox={`0 0 ${posterWidth} ${posterHeight}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {lines.map((points, index) => (
          <polyline key={index} className="warp-grid" points={points} />
        ))}
      </svg>
      {warpHandles(warp).map((handle, index) => {
        const p = toPoster(handle)
        return (
          <button
            key={index}
            type="button"
            className="warp-handle"
            aria-label={warp.type === 'distort' ? ['Top-left corner', 'Top-right corner', 'Bottom-right corner', 'Bottom-left corner'][index] : `Warp point ${index + 1}`}
            style={{ left: p.x * scale, top: p.y * scale, width: handleRadius * 2 * scale, height: handleRadius * 2 * scale }}
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              try {
                rootRef.current?.setPointerCapture(event.pointerId)
              } catch {
                // Synthetic pointers can't be captured; dragging still tracks via the overlay.
              }
              dragRef.current = index
            }}
            onKeyDown={(event) => {
              const step = (event.shiftKey ? 10 : 1) / Math.max(boxWidth, boxHeight)
              const delta: Record<string, Vec> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } }
              const move = delta[event.key]
              if (!move) return
              event.preventDefault()
              event.stopPropagation()
              onChange(withHandle(warp, index, { x: handle.x + move.x, y: handle.y + move.y }))
            }}
          />
        )
      })}
    </div>
  )
}
