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
  /** `field` drops the bar: a scrubbable label plus numeric field, for dense toolbars. */
  variant?: 'track' | 'field'
  disabled?: boolean
  /** Neutral value. When set, double-clicking the bar (or label) resets to it. */
  defaultValue?: number
}

// Pixels of horizontal drag that sweep the full range when scrubbing a field label.
const SCRUB_SPAN_PX = 240
// Shift-drag moves the value at a tenth of the normal rate.
const FINE_FACTOR = 0.1

type Drag = { lastX: number; raw: number; startValue: number; moved: boolean }

/**
 * Rectangle slider: the whole bar is the control. A solid block fills to the
 * value and the label + readout sit inside it, flipping colour where the fill
 * passes underneath.
 * - Press anywhere to jump, drag to set; hold Shift for fine, relative control.
 * - Click the readout (or press Enter while focused) to type a value; arrows nudge, Shift ×10.
 * - Double-click the bar to reset to `defaultValue`.
 * - Ranges that straddle zero fill outward from the zero point.
 */
export function Slider({
  label,
  value,
  min,
  max,
  onChange,
  onCommit,
  format,
  step = 1,
  variant = 'track',
  disabled = false,
  defaultValue,
}: SliderProps) {
  const display = format ? format(value) : String(Math.round(value))
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [dragging, setDragging] = useState(false)
  const skipCommitRef = useRef(false)
  const barRef = useRef<HTMLDivElement | null>(null)
  const rangeRef = useRef<HTMLInputElement | null>(null)
  const valueInputRef = useRef<HTMLInputElement | null>(null)
  const dragRef = useRef<Drag | null>(null)
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

  const canReset = defaultValue !== undefined && !disabled
  const isModified = defaultValue !== undefined && Math.abs(value - defaultValue) > step / 2
  const resetToDefault = () => {
    if (!canReset || !isModified) return
    onChange(clamp(defaultValue))
    onCommit()
  }

  // ── Bar dragging ────────────────────────────────────────────────────────
  const valueAtClientX = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return value
    return min + ((clientX - rect.left) / rect.width) * span
  }

  const onBarPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || disabled) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    rangeRef.current?.focus({ preventScroll: true })
    // Shift starts a fine, relative drag from the current value; otherwise jump to the pointer.
    // The second press of a double-click leaves the value alone so the reset lands cleanly.
    const jump = !event.shiftKey && event.detail < 2
    const raw = jump ? valueAtClientX(event.clientX) : value
    dragRef.current = { lastX: event.clientX, raw, startValue: value, moved: false }
    if (jump) onChange(snap(raw))
    setDragging(true)
  }

  const onBarPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = event.clientX - drag.lastX
    if (dx === 0) return
    drag.lastX = event.clientX
    drag.moved = true
    const width = barRef.current?.getBoundingClientRect().width || 1
    drag.raw = event.shiftKey ? drag.raw + (dx / width) * span * FINE_FACTOR : valueAtClientX(event.clientX)
    drag.raw = clamp(drag.raw)
    onChange(snap(drag.raw))
  }

  const onBarPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (drag.moved || snap(drag.raw) !== drag.startValue) onCommit()
  }

  // ── Field-variant label scrubbing ──────────────────────────────────────
  const onScrubStart = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0 || disabled) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    scrubRef.current = { startX: event.clientX, startValue: value, moved: false }
    setDragging(true)
  }

  const onScrubMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const scrub = scrubRef.current
    if (!scrub) return
    const dx = event.clientX - scrub.startX
    if (!scrub.moved && Math.abs(dx) < 2) return
    scrub.moved = true
    const perPx = (span / SCRUB_SPAN_PX) * (event.shiftKey ? FINE_FACTOR : 1)
    onChange(snap(scrub.startValue + dx * perPx))
  }

  const onScrubEnd = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const scrub = scrubRef.current
    if (!scrub) return
    scrubRef.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (scrub.moved) onCommit()
  }

  const valueInput = (
    <input
      ref={valueInputRef}
      className="dial-value-input"
      type="text"
      inputMode="decimal"
      disabled={disabled}
      tabIndex={variant === 'track' ? -1 : undefined}
      aria-label={variant === 'field' ? label : `${label} value`}
      value={editing ? editText : display}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
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
          if (variant === 'track') rangeRef.current?.focus({ preventScroll: true })
          else event.currentTarget.blur()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          skipCommitRef.current = true
          setEditText(String(value))
          setEditing(false)
          if (variant === 'track') rangeRef.current?.focus({ preventScroll: true })
          else event.currentTarget.blur()
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
  )

  const className = [
    'dial',
    variant === 'field' ? 'dial-field' : 'dial-bar-slider',
    dragging ? 'scrubbing' : '',
    editing ? 'editing' : '',
    disabled ? 'disabled' : '',
    isModified ? 'modified' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (variant === 'field') {
    return (
      <div className={className}>
        <div className="dial-head">
          <span
            className="dial-label"
            title={`Drag to adjust ${label.toLowerCase()} · Shift for fine${canReset ? ' · double-click to reset' : ''}`}
            onDoubleClick={resetToDefault}
            onPointerDown={onScrubStart}
            onPointerMove={onScrubMove}
            onPointerUp={onScrubEnd}
            onPointerCancel={onScrubEnd}
          >
            {label}
          </span>
          {valueInput}
        </div>
      </div>
    )
  }

  const text = (
    <>
      <span className="dial-label">{label}</span>
      <span className="dial-readout">{display}</span>
    </>
  )

  return (
    <div
      className={className}
      style={
        {
          '--dial-p': progress,
          '--dial-from': fillStart,
          '--dial-to': fillEnd,
        } as CSSProperties
      }
    >
      <div
        ref={barRef}
        className="dial-bar"
        title={`Drag to set · Shift for fine · click the number to type${canReset ? ' · double-click to reset' : ''}`}
        onPointerDown={onBarPointerDown}
        onPointerMove={onBarPointerMove}
        onPointerUp={onBarPointerEnd}
        onPointerCancel={onBarPointerEnd}
        onDoubleClick={resetToDefault}
      >
        <span className="dial-ticks" aria-hidden="true" />
        <span className="dial-fill" aria-hidden="true" />
        {origin > 0 ? <span className="dial-origin" aria-hidden="true" /> : null}
        <span className="dial-text" aria-hidden="true">
          {text}
        </span>
        <span className="dial-text dial-text-inverse" aria-hidden="true">
          {text}
        </span>
        <input
          ref={rangeRef}
          className="dial-input"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={label}
          aria-valuetext={display}
          aria-keyshortcuts="Enter"
          onChange={(event) => onChange(Number(event.target.value))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              valueInputRef.current?.focus()
            }
          }}
          onKeyUp={(event) => {
            if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End' || event.key.startsWith('Page')) onCommit()
          }}
        />
        {valueInput}
      </div>
    </div>
  )
}
