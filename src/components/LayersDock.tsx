import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

const STORAGE_KEY = 'carson.layersDock'
const MIN_HEIGHT = 140
const DEFAULT_HEIGHT = 300
/** The tab panel above the dock always keeps at least this much room. */
const MIN_ABOVE = 180
const KEY_STEP = 24

type DockState = { height: number; collapsed: boolean }

function readDockState(): DockState {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<DockState> | null
    return {
      height: typeof raw?.height === 'number' ? raw.height : DEFAULT_HEIGHT,
      collapsed: raw?.collapsed === true,
    }
  } catch {
    return { height: DEFAULT_HEIGHT, collapsed: false }
  }
}

function writeDockState(state: DockState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* private mode: the dock still works, it just forgets */
  }
}

/**
 * Layers stay on screen under whichever inspector tab is open, so a layer's settings and the
 * layer list are visible together. Drag or arrow-key the handle to resize; the header folds it.
 */
export function LayersDock({ count, children }: { count: number; children: ReactNode }) {
  const [state, setState] = useState(readDockState)
  const [maxHeight, setMaxHeight] = useState(640)
  const dockRef = useRef<HTMLElement>(null)
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null)

  useEffect(() => {
    writeDockState(state)
  }, [state])

  // The dock may not grow past the room its column leaves under the tabs.
  useEffect(() => {
    const column = dockRef.current?.parentElement
    if (!column) return
    const measure = () => setMaxHeight(Math.max(MIN_HEIGHT, column.clientHeight - MIN_ABOVE))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(column)
    return () => observer.disconnect()
  }, [])

  const height = Math.min(Math.max(state.height, MIN_HEIGHT), maxHeight)
  const setHeight = (next: number) => setState((current) => ({ ...current, height: Math.min(Math.max(next, MIN_HEIGHT), maxHeight) }))

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (state.collapsed) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { startY: event.clientY, startHeight: height }
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    // Dragging the handle up grows the dock.
    setHeight(drag.startHeight + (drag.startY - event.clientY))
  }
  const onPointerUp = () => {
    dragRef.current = null
  }
  const onHandleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? KEY_STEP * 4 : KEY_STEP
    if (event.key === 'ArrowUp') setHeight(height + step)
    else if (event.key === 'ArrowDown') setHeight(height - step)
    else if (event.key === 'Home') setHeight(maxHeight)
    else if (event.key === 'End') setHeight(MIN_HEIGHT)
    else return
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <section
      ref={dockRef}
      className={state.collapsed ? 'layers-dock is-collapsed' : 'layers-dock'}
      style={state.collapsed ? undefined : { height }}
      aria-labelledby="layers-dock-title"
    >
      {state.collapsed ? null : (
        <div
          className="layers-dock-handle"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize layers"
          aria-valuemin={MIN_HEIGHT}
          aria-valuemax={maxHeight}
          aria-valuenow={Math.round(height)}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onHandleKey}
        />
      )}
      <div className="layers-header">
        <h2 id="layers-dock-title" className="layers-dock-heading">
          <button
            type="button"
            className="layers-dock-toggle"
            aria-expanded={!state.collapsed}
            aria-controls="layers-dock-body"
            onClick={() => setState((current) => ({ ...current, collapsed: !current.collapsed }))}
          >
            {state.collapsed ? <ChevronRight size={12} aria-hidden /> : <ChevronDown size={12} aria-hidden />}
            Layers
          </button>
        </h2>
        <span className="layers-count" aria-label={`${count} layers`}>
          {count}
        </span>
      </div>
      <div className="layers-dock-body" id="layers-dock-body" hidden={state.collapsed}>
        {children}
      </div>
    </section>
  )
}
