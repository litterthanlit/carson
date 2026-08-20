import { useRef } from 'react'
import type { LayoutGuide } from '../lib/grid'

type LayoutGuidesOverlayProps = {
  posterWidth: number
  posterHeight: number
  displayScale: number
  guides: LayoutGuide[]
  onAddGuide: (axis: 'v' | 'h', position: number) => void
  onMoveGuide: (id: string, position: number) => void
  onRemoveGuide: (id: string) => void
}

function clamp(value: number, max: number) {
  return Math.min(max, Math.max(0, value))
}

export function LayoutGuidesOverlay({
  posterWidth,
  posterHeight,
  displayScale,
  guides,
  onAddGuide,
  onMoveGuide,
  onRemoveGuide,
}: LayoutGuidesOverlayProps) {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const scale = displayScale > 0 ? displayScale : 1

  const posterPoint = (clientX: number, clientY: number) => {
    const rect = shellRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    }
  }

  const startGuideDrag = (guide: LayoutGuide, event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    const max = guide.axis === 'v' ? posterWidth : posterHeight
    let last = guide.position
    const onMove = (moveEvent: PointerEvent) => {
      const point = posterPoint(moveEvent.clientX, moveEvent.clientY)
      last = guide.axis === 'v' ? point.x : point.y
      onMoveGuide(guide.id, last)
    }
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      if (last < -12 || last > max + 12) onRemoveGuide(guide.id)
      else onMoveGuide(guide.id, clamp(last, max))
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
  }

  return (
    <div className="layout-guides-overlay" ref={shellRef} aria-hidden="true">
      <button
        type="button"
        className="layout-ruler layout-ruler-corner"
        tabIndex={-1}
        title="Layout rulers"
        onPointerDown={(event) => event.preventDefault()}
      />
      <button
        type="button"
        className="layout-ruler layout-ruler-top"
        tabIndex={-1}
        title="Click to add a vertical guide"
        aria-label="Add vertical guide"
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          const point = posterPoint(event.clientX, event.clientY)
          onAddGuide('v', clamp(point.x, posterWidth))
        }}
      />
      <button
        type="button"
        className="layout-ruler layout-ruler-left"
        tabIndex={-1}
        title="Click to add a horizontal guide"
        aria-label="Add horizontal guide"
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          const point = posterPoint(event.clientX, event.clientY)
          onAddGuide('h', clamp(point.y, posterHeight))
        }}
      />
      {guides.map((guide) => (
        <button
          key={guide.id}
          type="button"
          className={guide.axis === 'v' ? 'layout-guide layout-guide-v' : 'layout-guide layout-guide-h'}
          style={
            guide.axis === 'v'
              ? { left: `${guide.position * scale}px` }
              : { top: `${guide.position * scale}px` }
          }
          title="Drag to move · drag off the poster to delete"
          aria-label={guide.axis === 'v' ? 'Vertical guide' : 'Horizontal guide'}
          onPointerDown={(event) => startGuideDrag(guide, event)}
        />
      ))}
    </div>
  )
}
