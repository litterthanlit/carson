import { Eraser, Paintbrush } from 'lucide-react'
import { DEFAULT_BRUSH, type BrushSettings } from '../lib/brush'
import { Slider } from './Slider'

type BrushBarProps = {
  brush: BrushSettings
  maxSize: number
  targetName: string | null
  onChange: (patch: Partial<BrushSettings>) => void
}

const pct = (value: number) => `${Math.round(value)}%`
const noCommit = () => undefined

/**
 * Brush sliders work in whole percents (0–100) so typed values read naturally;
 * BrushSettings stores 0–1 fractions.
 */
function BrushSlider({
  label,
  value,
  min,
  max,
  onChange,
  format = pct,
  defaultValue,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  format?: (value: number) => string
  defaultValue?: number
}) {
  return (
    <div className="brush-field">
      <Slider
        size="sm"
        label={label}
        value={value}
        min={min}
        max={max}
        format={format}
        defaultValue={defaultValue}
        releaseFocusOnPointerUp
        onChange={onChange}
        onCommit={noCommit}
      />
    </div>
  )
}

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
      <BrushSlider label="Size" value={brush.size} min={1} max={maxSize} defaultValue={Math.min(DEFAULT_BRUSH.size, maxSize)} format={(value) => `${Math.round(value)}`} onChange={(size) => onChange({ size })} />
      <BrushSlider label="Hardness" value={Math.round(brush.hardness * 100)} min={0} max={100} defaultValue={Math.round(DEFAULT_BRUSH.hardness * 100)} onChange={(value) => onChange({ hardness: value / 100 })} />
      <BrushSlider label="Opacity" value={Math.round(brush.opacity * 100)} min={1} max={100} defaultValue={Math.round(DEFAULT_BRUSH.opacity * 100)} onChange={(value) => onChange({ opacity: value / 100 })} />
      <BrushSlider label="Flow" value={Math.round(brush.flow * 100)} min={1} max={100} defaultValue={Math.round(DEFAULT_BRUSH.flow * 100)} onChange={(value) => onChange({ flow: value / 100 })} />
      <BrushSlider label="Smoothing" value={Math.round(brush.smoothing * 100)} min={0} max={90} defaultValue={Math.round(DEFAULT_BRUSH.smoothing * 100)} onChange={(value) => onChange({ smoothing: value / 100 })} />
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
