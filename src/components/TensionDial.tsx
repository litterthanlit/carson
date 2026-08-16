import { useRef } from 'react'

type TensionDialProps = {
  value: number
  onChange: (value: number) => void
  onCommit: () => void
}

const START_DEG = 135
const SWEEP_DEG = 270

function clampTension(value: number) {
  return Math.min(100, Math.max(0, value))
}

function pointToValue(clientX: number, clientY: number, rect: DOMRect) {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  let deg = (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI
  deg = (deg + 360) % 360
  let fromStart = deg - START_DEG
  if (fromStart < 0) fromStart += 360
  if (fromStart > SWEEP_DEG) {
    return fromStart < START_DEG ? 0 : 100
  }
  return clampTension(Math.round((fromStart / SWEEP_DEG) * 100))
}

export function TensionDial({ value, onChange, onCommit }: TensionDialProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef(false)
  const angle = START_DEG + (clampTension(value) / 100) * SWEEP_DEG
  const label = value < 34 ? 'Composed' : value < 67 ? 'Restless' : 'Wild'

  const applyFromPointer = (event: PointerEvent | React.PointerEvent) => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return
    onChange(pointToValue(event.clientX, event.clientY, rect))
  }

  return (
    <div className="tension-dial" title="Tension — scales instrument intensity across the poster">
      <div
        ref={rootRef}
        className="tension-knob"
        role="slider"
        aria-label="Tension"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
        aria-valuetext={`${label} ${Math.round(value)}`}
        tabIndex={0}
        onPointerDown={(event) => {
          draggingRef.current = true
          event.currentTarget.setPointerCapture(event.pointerId)
          applyFromPointer(event)
        }}
        onPointerMove={(event) => {
          if (!draggingRef.current) return
          applyFromPointer(event)
        }}
        onPointerUp={() => {
          if (!draggingRef.current) return
          draggingRef.current = false
          onCommit()
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            event.preventDefault()
            onChange(clampTension(value - 5))
            onCommit()
          } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            event.preventDefault()
            onChange(clampTension(value + 5))
            onCommit()
          }
        }}
      >
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="18" cy="18" r="14" className="tension-track" />
          <circle
            cx="18"
            cy="18"
            r="14"
            className="tension-fill"
            strokeDasharray={`${(clampTension(value) / 100) * 88} 88`}
            transform={`rotate(${START_DEG} 18 18)`}
          />
          <line
            x1="18"
            y1="18"
            x2={18 + Math.cos((angle * Math.PI) / 180) * 10}
            y2={18 + Math.sin((angle * Math.PI) / 180) * 10}
            className="tension-needle"
          />
        </svg>
      </div>
      <div className="tension-copy">
        <span className="tension-name">Tension</span>
        <span className="tension-label">{label}</span>
      </div>
    </div>
  )
}
