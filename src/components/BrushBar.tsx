import { Eraser, Paintbrush } from 'lucide-react'
import type { BrushSettings } from '../lib/brush'

type BrushBarProps = {
  brush: BrushSettings
  maxSize: number
  targetName: string | null
  onChange: (patch: Partial<BrushSettings>) => void
}

function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format: (value: number) => string
  onChange: (value: number) => void
}) {
  return (
    <label className="brush-field">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        // After a pointer drag, hand focus back so single-key shortcuts (B, E, [ ]) work;
        // keyboard users keep focus on the slider.
        onPointerUp={(event) => event.currentTarget.blur()}
      />
      <output>{format(value)}</output>
    </label>
  )
}

const pct = (value: number) => `${Math.round(value * 100)}%`

/** Floating options for the brush tool, pinned to the top of the viewport. */
export function BrushBar({ brush, maxSize, targetName, onChange }: BrushBarProps) {
  return (
    <div className="brush-bar" role="toolbar" aria-label="Brush options">
      <div className="brush-mode" role="radiogroup" aria-label="Brush mode">
        <button type="button" role="radio" aria-checked={!brush.erase} title="Brush (B)" onClick={() => onChange({ erase: false })}>
          <Paintbrush size={14} aria-hidden />
          Brush
        </button>
        <button type="button" role="radio" aria-checked={brush.erase} title="Eraser (E) — erases paint; masks other layers" onClick={() => onChange({ erase: true })}>
          <Eraser size={14} aria-hidden />
          Eraser
        </button>
      </div>
      {!brush.erase ? (
        <label className="brush-color" title="Brush color">
          <input type="color" aria-label="Brush color" value={brush.color} onChange={(event) => onChange({ color: event.target.value })} />
        </label>
      ) : null}
      <RangeField label="Size" value={brush.size} min={1} max={maxSize} format={(value) => `${Math.round(value)}`} onChange={(size) => onChange({ size })} />
      <RangeField label="Hardness" value={brush.hardness} min={0} max={1} step={0.01} format={pct} onChange={(hardness) => onChange({ hardness })} />
      <RangeField label="Opacity" value={brush.opacity} min={0.01} max={1} step={0.01} format={pct} onChange={(opacity) => onChange({ opacity })} />
      <RangeField label="Flow" value={brush.flow} min={0.01} max={1} step={0.01} format={pct} onChange={(flow) => onChange({ flow })} />
      <RangeField label="Smoothing" value={brush.smoothing} min={0} max={0.9} step={0.01} format={pct} onChange={(smoothing) => onChange({ smoothing })} />
      <span className="brush-pressure" role="group" aria-label="Pen pressure controls">
        <span>Pressure</span>
        <button type="button" aria-pressed={brush.pressureSize} onClick={() => onChange({ pressureSize: !brush.pressureSize })}>
          Size
        </button>
        <button type="button" aria-pressed={brush.pressureOpacity} onClick={() => onChange({ pressureOpacity: !brush.pressureOpacity })}>
          Opacity
        </button>
      </span>
      <span className="brush-target" title="Where the next stroke lands">
        {brush.erase ? (targetName ? `Erasing ${targetName}` : 'Pick a layer to erase') : targetName ? `Painting on ${targetName}` : 'New paint layer'}
      </span>
    </div>
  )
}
