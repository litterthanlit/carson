import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { effectivePressure } from '../lib/brush'

export type BrushInputSample = { x: number; y: number; pressure: number }

type BrushOverlayProps = {
  active: boolean
  displayScale: number
  /** Brush diameter in poster px, for the cursor ring. */
  size: number
  erase: boolean
  onStrokeStart: (sample: BrushInputSample) => void
  onStrokeMove: (samples: BrushInputSample[]) => void
  onStrokeEnd: () => void
}

/**
 * Pointer capture surface for the brush. Reads coalesced events so pens sampling
 * at 240Hz+ keep their full resolution, and normalizes pressure per pointer type.
 */
export function BrushOverlay({ active, displayScale, size, erase, onStrokeStart, onStrokeMove, onStrokeEnd }: BrushOverlayProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const ringRef = useRef<HTMLDivElement | null>(null)
  const drawingRef = useRef(false)
  const [hover, setHover] = useState(false)
  const scale = displayScale > 0 ? displayScale : 1
  const diameter = Math.max(4, size * scale)

  const toSample = (event: PointerEvent | ReactPointerEvent): BrushInputSample => {
    const rect = rootRef.current!.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left) / scale,
      y: (event.clientY - rect.top) / scale,
      pressure: effectivePressure(event.pressure, event.pointerType),
    }
  }

  const moveRing = (event: ReactPointerEvent) => {
    const ring = ringRef.current
    const rect = rootRef.current?.getBoundingClientRect()
    if (!ring || !rect) return
    ring.style.transform = `translate(${event.clientX - rect.left - diameter / 2}px, ${event.clientY - rect.top - diameter / 2}px)`
  }

  if (!active) return null

  return (
    <div
      ref={rootRef}
      className={erase ? 'brush-overlay is-erasing' : 'brush-overlay'}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // Synthetic or already-released pointers can't be captured; painting still works.
        }
        drawingRef.current = true
        moveRing(event)
        onStrokeStart(toSample(event))
      }}
      onPointerMove={(event) => {
        moveRing(event)
        if (!drawingRef.current) return
        const native = event.nativeEvent
        const coalesced = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : []
        onStrokeMove((coalesced.length ? coalesced : [native]).map(toSample))
      }}
      onPointerUp={() => {
        if (!drawingRef.current) return
        drawingRef.current = false
        onStrokeEnd()
      }}
      onPointerCancel={() => {
        if (!drawingRef.current) return
        drawingRef.current = false
        onStrokeEnd()
      }}
    >
      <div
        ref={ringRef}
        className="brush-ring"
        aria-hidden="true"
        style={{ width: diameter, height: diameter, opacity: hover ? 1 : 0 }}
      />
    </div>
  )
}
