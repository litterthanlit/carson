import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'

type SliderProps = {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  onCommit: () => void
  format?: (value: number) => string
  step?: number
  /** `field` drops the track: a scrubbable label plus numeric field, for dense toolbars. */
  variant?: 'track' | 'field'
  disabled?: boolean
}

// Pixels of horizontal drag that sweep the full range when scrubbing the label.
const SCRUB_SPAN_PX = 240

/**
 * Photoshop-style slider: label and numeric field on one line, a thin track below.
 * - Drag the label to scrub the value (hold Shift for fine control).
 * - Arrow keys in the field nudge by one step, Shift+Arrow by ten.
 * - Ranges that straddle zero fill outward from the zero point.
 */
export function Slider({ label, value, min, max, onChange, onCommit, format, step = 1, variant = 'track', disabled = false }: SliderProps) {
  const display = format ? format(value) : String(Math.round(value))
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [scrubbing, setScrubbing] = useState(false)
  const skipCommitRef = useRef(false)
  const scrubRef = useRef<{ startX: number; startValue: number; moved: boolean } | null>(null)
  const span = max - min
  const ratio = (num: number) => (span <= 0 ? 0 : Math.min(1, Math.max(0, (num - min) / span)))
  const progress = ratio(value)
  // Bipolar ranges (e.g. -120…260) fill from zero, so the neutral value reads as "empty".
  const origin = min < 0 && max > 0 ? ratio(0) : 0
  const fillStart = Math.min(origin, progress)
  const fillEnd = Math.max(origin, progress)

  useEffect(() => {
    if (!editing) {
      setEditText(String(value))
    }
  }, [value, editing])

  const clamp = (num: number) => Math.min(max, Math.max(min, num))
  const snap = (num: number) => clamp(Math.round(num / step) * step)

  const commitEdit = () => {
    const num = Number(editText)
    if (Number.isFinite(num)) {
      onChange(clamp(num))
    }
    onCommit()
    setEditing(false)
  }

  const onScrubStart = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0 || disabled) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    scrubRef.current = { startX: event.clientX, startValue: value, moved: false }
    setScrubbing(true)
  }

  const onScrubMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const scrub = scrubRef.current
    if (!scrub) return
    const dx = event.clientX - scrub.startX
    if (!scrub.moved && Math.abs(dx) < 2) return
    scrub.moved = true
    const perPx = (span / SCRUB_SPAN_PX) * (event.shiftKey ? 0.1 : 1)
    onChange(snap(scrub.startValue + dx * perPx))
  }

  const onScrubEnd = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const scrub = scrubRef.current
    if (!scrub) return
    scrubRef.current = null
    setScrubbing(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (scrub.moved) onCommit()
  }

  return (
    <div
      className={['dial', variant === 'field' ? 'dial-field' : '', scrubbing ? 'scrubbing' : '', disabled ? 'disabled' : '']
        .filter(Boolean)
        .join(' ')}
      style={
        {
          '--dial-p': progress,
          '--dial-from': fillStart,
          '--dial-to': fillEnd,
        } as CSSProperties
      }
    >
      <div className="dial-head">
        <span
          className="dial-label"
          title={`Drag to adjust ${label.toLowerCase()} · Shift for fine`}
          onPointerDown={onScrubStart}
          onPointerMove={onScrubMove}
          onPointerUp={onScrubEnd}
          onPointerCancel={onScrubEnd}
        >
          {label}
        </span>
        <input
          className="dial-value-input"
          type="text"
          inputMode="decimal"
          disabled={disabled}
          aria-label={variant === 'field' ? label : `${label} value`}
          value={editing ? editText : display}
          onFocus={(event) => {
            setEditing(true)
            setEditText(String(value))
            event.currentTarget.select()
          }}
          onChange={(event) => {
            setEditText(event.target.value)
            const num = Number(event.target.value)
            if (Number.isFinite(num)) {
              onChange(clamp(num))
            }
          }}
          onBlur={() => {
            if (skipCommitRef.current) {
              skipCommitRef.current = false
              setEditing(false)
              return
            }
            if (editing) commitEdit()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitEdit()
              event.currentTarget.blur()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              skipCommitRef.current = true
              setEditText(String(value))
              setEditing(false)
              event.currentTarget.blur()
            } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault()
              const base = Number(editText)
              const current = Number.isFinite(base) ? base : value
              const delta = (event.key === 'ArrowUp' ? 1 : -1) * step * (event.shiftKey ? 10 : 1)
              const next = snap(current + delta)
              setEditText(String(next))
              onChange(next)
            }
          }}
          onKeyUp={(event) => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') onCommit()
          }}
        />
      </div>
      {variant === 'track' ? (
      <div className="dial-track">
        <span className="dial-rail" aria-hidden="true" />
        <span className="dial-fill" aria-hidden="true" />
        {origin > 0 ? <span className="dial-origin" aria-hidden="true" /> : null}
        <span className="dial-thumb" aria-hidden="true" />
        <input
          className="dial-input"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={label}
          aria-valuetext={display}
          onChange={(event) => onChange(Number(event.target.value))}
          onPointerUp={onCommit}
          onKeyUp={(event) => {
            if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End' || event.key.startsWith('Page')) onCommit()
          }}
        />
      </div>
      ) : null}
    </div>
  )
}
