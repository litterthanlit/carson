import { useEffect, useRef, useState } from 'react'

type SliderProps = {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  onCommit: () => void
  format?: (value: number) => string
}

export function Slider({ label, value, min, max, onChange, onCommit, format }: SliderProps) {
  const display = format ? format(value) : String(Math.round(value))
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const skipCommitRef = useRef(false)

  useEffect(() => {
    if (!editing) {
      setEditText(String(value))
    }
  }, [value, editing])

  const clamp = (num: number) => Math.min(max, Math.max(min, num))

  const commitEdit = () => {
    const num = Number(editText)
    if (Number.isFinite(num)) {
      onChange(clamp(num))
    }
    onCommit()
    setEditing(false)
  }

  return (
    <div className="dial">
      <div className="dial-header">
        <span className="dial-label">{label}</span>
        <input
          className="dial-value-input"
          type="text"
          inputMode="decimal"
          aria-label={`${label} value`}
          value={editing ? editText : display}
          onFocus={() => {
            setEditing(true)
            setEditText(String(value))
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
            }
          }}
        />
      </div>
      <input
        className="dial-input"
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        aria-valuetext={display}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={onCommit}
        onKeyUp={(event) => {
          if (event.key.startsWith('Arrow')) onCommit()
        }}
      />
    </div>
  )
}
