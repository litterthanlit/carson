import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { rulerTicks, type RulerUnit } from '../lib/rulerTicks'

const RULER_SIZE = 20

type ViewportRulersProps = {
  scrollRef: RefObject<HTMLDivElement | null>
  displayScale: number
  posterWidth: number
  posterHeight: number
  dpi?: number
  /** Adds a guide in poster pixels. `v` = vertical line at x, `h` = horizontal line at y. */
  onAddGuide: (axis: 'v' | 'h', position: number) => void
}

type Geometry = {
  shell: DOMRect
  viewport: DOMRect
}

type DragState = { axis: 'v' | 'h'; moved: boolean; originX: number; originY: number }

function readCss(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

/**
 * Photoshop-style rulers pinned to the viewport edges. They show poster coordinates
 * (mm at print resolution, px otherwise) for whatever is scrolled into view, track
 * the cursor, and let you drag a guide out onto the poster.
 */
export function ViewportRulers({ scrollRef, displayScale, posterWidth, posterHeight, dpi, onAddGuide }: ViewportRulersProps) {
  const topRef = useRef<HTMLCanvasElement | null>(null)
  const leftRef = useRef<HTMLCanvasElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const cursorRef = useRef<{ x: number; y: number } | null>(null)
  const frameRef = useRef<number | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const printable = (dpi ?? 72) >= 150
  const [unit, setUnit] = useState<RulerUnit>(printable ? 'mm' : 'px')
  const [preview, setPreview] = useState<{ axis: 'v' | 'h'; offset: number } | null>(null)
  const effectiveUnit: RulerUnit = printable ? unit : 'px'

  const geometry = useCallback((): Geometry | null => {
    const scroller = scrollRef.current
    const shell = scroller?.querySelector<HTMLElement>('.canvas-shell')
    const root = rootRef.current
    if (!scroller || !shell || !root) return null
    return { shell: shell.getBoundingClientRect(), viewport: root.getBoundingClientRect() }
  }, [scrollRef])

  const draw = useCallback(() => {
    frameRef.current = null
    const geo = geometry()
    if (!geo) return
    const dpr = window.devicePixelRatio || 1
    const scale = displayScale > 0 ? displayScale : 1
    const colors = {
      bg: '#2a2a2a',
      poster: '#343434',
      tick: 'rgba(255,255,255,0.28)',
      major: 'rgba(255,255,255,0.5)',
      label: readCss('--text-faint', '#a3a3a3'),
      cursor: readCss('--accent', '#1473e6'),
      edge: '#1f1f1f',
    }
    const font = `500 10px ${readCss('--font', 'system-ui, sans-serif')}`

    const paint = (canvas: HTMLCanvasElement | null, axis: 'x' | 'y') => {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const length = axis === 'x' ? rect.width : rect.height
      if (length <= 0) return
      const w = Math.round(rect.width * dpr)
      const h = Math.round(rect.height * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, rect.width, rect.height)
      ctx.fillStyle = colors.bg
      ctx.fillRect(0, 0, rect.width, rect.height)

      // Screen offset of poster coordinate 0 along this ruler.
      const origin = axis === 'x' ? geo.shell.left - rect.left : geo.shell.top - rect.top
      const extent = (axis === 'x' ? posterWidth : posterHeight) * scale
      ctx.fillStyle = colors.poster
      if (axis === 'x') ctx.fillRect(origin, 0, extent, rect.height)
      else ctx.fillRect(0, origin, rect.width, extent)

      const ticks = rulerTicks({
        start: -origin / scale,
        end: (length - origin) / scale,
        displayScale: scale,
        unit: effectiveUnit,
        dpi,
      })
      ctx.font = font
      ctx.textBaseline = 'top'
      const thickness = axis === 'x' ? rect.height : rect.width
      for (const tick of ticks) {
        const at = Math.round(origin + tick.position * scale) + 0.5
        const size = tick.major ? thickness * 0.6 : thickness * 0.25
        ctx.strokeStyle = tick.major ? colors.major : colors.tick
        ctx.beginPath()
        if (axis === 'x') {
          ctx.moveTo(at, thickness)
          ctx.lineTo(at, thickness - size)
        } else {
          ctx.moveTo(thickness, at)
          ctx.lineTo(thickness - size, at)
        }
        ctx.stroke()
        if (tick.label) {
          ctx.fillStyle = colors.label
          if (axis === 'x') {
            ctx.fillText(tick.label, at + 3, 2)
          } else {
            ctx.save()
            ctx.translate(2, at + 3)
            ctx.rotate(Math.PI / 2)
            ctx.textBaseline = 'bottom'
            ctx.fillText(tick.label, 0, 0)
            ctx.restore()
          }
        }
      }

      const cursor = cursorRef.current
      if (cursor) {
        const at = Math.round((axis === 'x' ? cursor.x - rect.left : cursor.y - rect.top)) + 0.5
        if (at >= 0 && at <= length) {
          ctx.strokeStyle = colors.cursor
          ctx.beginPath()
          if (axis === 'x') {
            ctx.moveTo(at, 0)
            ctx.lineTo(at, thickness)
          } else {
            ctx.moveTo(0, at)
            ctx.lineTo(thickness, at)
          }
          ctx.stroke()
        }
      }

      ctx.strokeStyle = colors.edge
      ctx.beginPath()
      if (axis === 'x') {
        ctx.moveTo(0, rect.height - 0.5)
        ctx.lineTo(rect.width, rect.height - 0.5)
      } else {
        ctx.moveTo(rect.width - 0.5, 0)
        ctx.lineTo(rect.width - 0.5, rect.height)
      }
      ctx.stroke()
    }

    paint(topRef.current, 'x')
    paint(leftRef.current, 'y')
  }, [displayScale, dpi, effectiveUnit, geometry, posterHeight, posterWidth])

  const schedule = useCallback(() => {
    if (frameRef.current != null) return
    frameRef.current = window.requestAnimationFrame(draw)
  }, [draw])

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    // Layout (scroll padding, pasteboard) settles after this commit.
    schedule()
    const onPointer = (event: PointerEvent) => {
      cursorRef.current = { x: event.clientX, y: event.clientY }
      schedule()
    }
    const onLeave = () => {
      cursorRef.current = null
      schedule()
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(scroller)
    const shell = scroller.querySelector('.canvas-shell')
    if (shell) observer.observe(shell)
    scroller.addEventListener('scroll', schedule, { passive: true })
    scroller.addEventListener('pointermove', onPointer, { passive: true })
    scroller.addEventListener('pointerleave', onLeave)
    return () => {
      observer.disconnect()
      scroller.removeEventListener('scroll', schedule)
      scroller.removeEventListener('pointermove', onPointer)
      scroller.removeEventListener('pointerleave', onLeave)
      if (frameRef.current != null) window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [schedule, scrollRef])

  const posterCoord = (axis: 'v' | 'h', clientX: number, clientY: number) => {
    const geo = geometry()
    if (!geo) return 0
    const scale = displayScale > 0 ? displayScale : 1
    return axis === 'v' ? (clientX - geo.shell.left) / scale : (clientY - geo.shell.top) / scale
  }

  const clampTo = (axis: 'v' | 'h', value: number) =>
    Math.min(axis === 'v' ? posterWidth : posterHeight, Math.max(0, value))

  // The top ruler drags out horizontal guides; the left ruler drags out vertical ones
  // (Photoshop convention). A click without dragging drops a guide at the clicked mark.
  const beginDrag = (ruler: 'top' | 'left') => (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { axis: ruler === 'top' ? 'h' : 'v', moved: false, originX: event.clientX, originY: event.clientY }
  }

  const moveDrag = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    const root = rootRef.current
    if (!drag || !root) return
    if (Math.hypot(event.clientX - drag.originX, event.clientY - drag.originY) > 3) drag.moved = true
    if (!drag.moved) return
    const rect = root.getBoundingClientRect()
    setPreview(
      drag.axis === 'h'
        ? { axis: 'h', offset: event.clientY - rect.top }
        : { axis: 'v', offset: event.clientX - rect.left },
    )
  }

  const endDrag = (ruler: 'top' | 'left') => (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    setPreview(null)
    if (!drag) return
    if (drag.moved) {
      const position = posterCoord(drag.axis, event.clientX, event.clientY)
      const max = drag.axis === 'v' ? posterWidth : posterHeight
      // Releasing back over the ruler (or far off the poster) cancels.
      const overRuler =
        ruler === 'top'
          ? event.clientY - (rootRef.current?.getBoundingClientRect().top ?? 0) < RULER_SIZE
          : event.clientX - (rootRef.current?.getBoundingClientRect().left ?? 0) < RULER_SIZE
      if (!overRuler && position >= -12 && position <= max + 12) onAddGuide(drag.axis, clampTo(drag.axis, position))
      return
    }
    // Plain click: a guide perpendicular to the ruler at the clicked mark.
    const axis = ruler === 'top' ? 'v' : 'h'
    onAddGuide(axis, clampTo(axis, posterCoord(axis, event.clientX, event.clientY)))
  }

  return (
    <div className="viewport-rulers" ref={rootRef} aria-hidden="true">
      <button
        type="button"
        className="ruler-corner"
        tabIndex={-1}
        disabled={!printable}
        title={printable ? `Ruler units: ${effectiveUnit} (click to switch)` : 'Ruler units: px'}
        onClick={() => setUnit((value) => (value === 'mm' ? 'px' : 'mm'))}
      >
        {effectiveUnit}
      </button>
      <canvas
        ref={topRef}
        className="ruler ruler-top"
        title="Drag down for a horizontal guide · click for a vertical guide"
        onPointerDown={beginDrag('top')}
        onPointerMove={moveDrag}
        onPointerUp={endDrag('top')}
        onPointerCancel={() => {
          dragRef.current = null
          setPreview(null)
        }}
      />
      <canvas
        ref={leftRef}
        className="ruler ruler-left"
        title="Drag right for a vertical guide · click for a horizontal guide"
        onPointerDown={beginDrag('left')}
        onPointerMove={moveDrag}
        onPointerUp={endDrag('left')}
        onPointerCancel={() => {
          dragRef.current = null
          setPreview(null)
        }}
      />
      {preview ? (
        <div
          className={`ruler-guide-preview ruler-guide-preview-${preview.axis}`}
          style={preview.axis === 'h' ? { top: preview.offset } : { left: preview.offset }}
        />
      ) : null}
    </div>
  )
}
