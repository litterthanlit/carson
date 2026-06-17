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

  return (
    <div className="dial">
      <div className="dial-header">
        <span className="dial-label">{label}</span>
        <span className="dial-value">{display}</span>
      </div>
      <input
        className="dial-input"
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
        onKeyUp={(event) => {
          if (event.key.startsWith('Arrow')) onCommit()
        }}
      />
    </div>
  )
}
