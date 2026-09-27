import { Slider } from './Slider'
import { ADJUSTMENT_LABELS, type Adjustment } from '../lib/adjustments'

type AdjustmentPanelProps = {
  adjustment: Adjustment
  opacity: number
  onChange: (adjustment: Adjustment) => void
  onOpacityChange: (opacity: number) => void
  onCommit: (label: string) => void
}

export function AdjustmentPanel({ adjustment, opacity, onChange, onOpacityChange, onCommit }: AdjustmentPanelProps) {
  const label = ADJUSTMENT_LABELS[adjustment.type]
  const commit = () => onCommit(`Adjusted ${label.toLowerCase()}`)

  return (
    <div className="property-card adjustment-panel">
      <h3 className="property-kicker">{label}</h3>
      <p className="hint">Affects every layer below. Hide or delete it to undo the look.</p>
      {adjustment.type === 'levels' ? (
        <>
          <div className="levels-ramp" aria-hidden="true">
            <span style={{ left: `${(adjustment.black / 255) * 100}%` }} />
            <span style={{ left: `${(adjustment.white / 255) * 100}%` }} />
          </div>
          <Slider label="Black" defaultValue={0} value={adjustment.black} min={0} max={254} onChange={(black) => onChange({ ...adjustment, black: Math.min(black, adjustment.white - 1) })} onCommit={commit} />
          <Slider
            label="Midtones"
            defaultValue={100}
            value={Math.round(adjustment.gamma * 100)}
            min={10}
            max={300}
            format={(value) => (value / 100).toFixed(2)}
            onChange={(value) => onChange({ ...adjustment, gamma: value / 100 })}
            onCommit={commit}
          />
          <Slider label="White" defaultValue={255} value={adjustment.white} min={1} max={255} onChange={(white) => onChange({ ...adjustment, white: Math.max(white, adjustment.black + 1) })} onCommit={commit} />
        </>
      ) : null}
      {adjustment.type === 'hueSat' ? (
        <>
          <Slider label="Hue" defaultValue={0} value={adjustment.hue} min={-180} max={180} format={(value) => `${Math.round(value)}°`} onChange={(hue) => onChange({ ...adjustment, hue })} onCommit={commit} />
          <Slider label="Saturation" defaultValue={0} value={adjustment.saturation} min={-100} max={100} onChange={(saturation) => onChange({ ...adjustment, saturation })} onCommit={commit} />
          <Slider label="Lightness" defaultValue={0} value={adjustment.lightness} min={-100} max={100} onChange={(lightness) => onChange({ ...adjustment, lightness })} onCommit={commit} />
        </>
      ) : null}
      {adjustment.type === 'brightnessContrast' ? (
        <>
          <Slider label="Brightness" defaultValue={0} value={adjustment.brightness} min={-100} max={100} onChange={(brightness) => onChange({ ...adjustment, brightness })} onCommit={commit} />
          <Slider label="Contrast" defaultValue={0} value={adjustment.contrast} min={-100} max={100} onChange={(contrast) => onChange({ ...adjustment, contrast })} onCommit={commit} />
        </>
      ) : null}
      {adjustment.type === 'gradientMap' ? (
        <div className="gradient-map-fields">
          <span className="gradient-map-preview" style={{ background: `linear-gradient(90deg, ${adjustment.shadow}, ${adjustment.highlight})` }} aria-hidden="true" />
          <label className="layer-style-color">
            <span>Shadows</span>
            <input type="color" aria-label="Shadow color" value={adjustment.shadow} onChange={(event) => onChange({ ...adjustment, shadow: event.target.value })} onBlur={commit} />
            <code>{adjustment.shadow.toUpperCase()}</code>
          </label>
          <label className="layer-style-color">
            <span>Highlights</span>
            <input type="color" aria-label="Highlight color" value={adjustment.highlight} onChange={(event) => onChange({ ...adjustment, highlight: event.target.value })} onBlur={commit} />
            <code>{adjustment.highlight.toUpperCase()}</code>
          </label>
          <button type="button" onClick={() => {
            onChange({ ...adjustment, shadow: adjustment.highlight, highlight: adjustment.shadow })
            onCommit('Reversed gradient map')
          }}>
            Reverse
          </button>
        </div>
      ) : null}
      {adjustment.type === 'threshold' ? (
        <Slider label="Level" defaultValue={128} value={adjustment.level} min={0} max={255} onChange={(level) => onChange({ ...adjustment, level })} onCommit={commit} />
      ) : null}
      {adjustment.type === 'posterize' ? (
        <Slider label="Levels" value={adjustment.levels} min={2} max={16} onChange={(levels) => onChange({ ...adjustment, levels: Math.round(levels) })} onCommit={commit} />
      ) : null}
      <Slider
        label="Opacity"
        defaultValue={100}
        value={Math.round(opacity * 100)}
        min={0}
        max={100}
        format={(value) => `${Math.round(value)}%`}
        onChange={(value) => onOpacityChange(value / 100)}
        onCommit={() => onCommit('Changed adjustment opacity')}
      />
    </div>
  )
}
