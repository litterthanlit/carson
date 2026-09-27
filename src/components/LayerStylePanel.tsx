import { Slider } from './Slider'
import { scaledLayerStyleDefaults, type LayerStyle, type LayerStyleKind } from '../lib/layerStyles'

type LayerStylePanelProps = {
  style: LayerStyle | null
  /** Live update while dragging a control. */
  onChange: (style: LayerStyle) => void
  /** Commit one undo step. */
  onCommit: (label: string) => void
  /** Poster-size factor from `layerStyleScale`; sizes defaults and slider ranges. */
  scale?: number
}

const EFFECTS: { kind: LayerStyleKind; label: string; hint: string }[] = [
  { kind: 'dropShadow', label: 'Drop shadow', hint: 'Soft shadow cast by the layer' },
  { kind: 'outerGlow', label: 'Outer glow', hint: 'Colored halo around the layer' },
  { kind: 'outline', label: 'Outline', hint: 'Solid line hugging the layer’s edge' },
]

export function LayerStylePanel({ style, onChange, onCommit, scale = 1 }: LayerStylePanelProps) {
  const current: LayerStyle = style ?? {}
  const LAYER_STYLE_DEFAULTS = scaledLayerStyleDefaults(scale)
  const range = (max: number) => Math.round(max * Math.max(1, scale))

  const patch = <K extends LayerStyleKind>(kind: K, values: Partial<NonNullable<LayerStyle[K]>>) => {
    const base = (current[kind] ?? LAYER_STYLE_DEFAULTS[kind]) as NonNullable<LayerStyle[K]>
    onChange({ ...current, [kind]: { ...base, ...values } })
  }

  const toggle = (kind: LayerStyleKind, label: string, enabled: boolean) => {
    if (enabled) {
      onChange({ ...current, [kind]: { ...(current[kind] ?? LAYER_STYLE_DEFAULTS[kind]), enabled: true } })
      onCommit(`Added ${label.toLowerCase()}`)
    } else {
      const next = { ...current }
      delete next[kind]
      onChange(next)
      onCommit(`Removed ${label.toLowerCase()}`)
    }
  }

  return (
    <div className="layer-style-panel">
      {EFFECTS.map(({ kind, label, hint }) => {
        const active = Boolean(current[kind])
        return (
          <div key={kind} className={active ? 'layer-style-row active' : 'layer-style-row'}>
            <label className="toggle-row" title={hint}>
              <input type="checkbox" checked={active} onChange={(event) => toggle(kind, label, event.target.checked)} />
              {label}
            </label>
            {kind === 'dropShadow' && current.dropShadow ? (
              <div className="layer-style-controls">
                <ColorField
                  label="Shadow color"
                  value={current.dropShadow.color}
                  onChange={(color) => patch('dropShadow', { color })}
                  onCommit={() => onCommit('Changed shadow color')}
                />
                <Slider
                  label="Opacity"
                  value={Math.round(current.dropShadow.opacity * 100)}
                  defaultValue={Math.round(LAYER_STYLE_DEFAULTS.dropShadow.opacity * 100)}
                  min={0}
                  max={100}
                  format={(value) => `${Math.round(value)}%`}
                  onChange={(value) => patch('dropShadow', { opacity: value / 100 })}
                  onCommit={() => onCommit('Changed shadow opacity')}
                />
                <Slider
                  label="Distance"
                  value={current.dropShadow.distance}
                  defaultValue={LAYER_STYLE_DEFAULTS.dropShadow.distance}
                  min={0}
                  max={range(400)}
                  onChange={(distance) => patch('dropShadow', { distance })}
                  onCommit={() => onCommit('Changed shadow distance')}
                />
                <Slider
                  label="Blur"
                  value={current.dropShadow.blur}
                  defaultValue={LAYER_STYLE_DEFAULTS.dropShadow.blur}
                  min={0}
                  max={range(300)}
                  onChange={(blur) => patch('dropShadow', { blur })}
                  onCommit={() => onCommit('Changed shadow blur')}
                />
                <Slider
                  label="Angle"
                  value={current.dropShadow.angle}
                  defaultValue={LAYER_STYLE_DEFAULTS.dropShadow.angle}
                  min={0}
                  max={360}
                  format={(value) => `${Math.round(value)}°`}
                  onChange={(angle) => patch('dropShadow', { angle })}
                  onCommit={() => onCommit('Changed shadow angle')}
                />
              </div>
            ) : null}
            {kind === 'outerGlow' && current.outerGlow ? (
              <div className="layer-style-controls">
                <ColorField
                  label="Glow color"
                  value={current.outerGlow.color}
                  onChange={(color) => patch('outerGlow', { color })}
                  onCommit={() => onCommit('Changed glow color')}
                />
                <Slider
                  label="Opacity"
                  value={Math.round(current.outerGlow.opacity * 100)}
                  defaultValue={Math.round(LAYER_STYLE_DEFAULTS.outerGlow.opacity * 100)}
                  min={0}
                  max={100}
                  format={(value) => `${Math.round(value)}%`}
                  onChange={(value) => patch('outerGlow', { opacity: value / 100 })}
                  onCommit={() => onCommit('Changed glow opacity')}
                />
                <Slider
                  label="Size"
                  value={current.outerGlow.size}
                  defaultValue={LAYER_STYLE_DEFAULTS.outerGlow.size}
                  min={0}
                  max={range(300)}
                  onChange={(size) => patch('outerGlow', { size })}
                  onCommit={() => onCommit('Changed glow size')}
                />
              </div>
            ) : null}
            {kind === 'outline' && current.outline ? (
              <div className="layer-style-controls">
                <ColorField
                  label="Outline color"
                  value={current.outline.color}
                  onChange={(color) => patch('outline', { color })}
                  onCommit={() => onCommit('Changed outline color')}
                />
                <Slider
                  label="Width"
                  value={current.outline.width}
                  defaultValue={LAYER_STYLE_DEFAULTS.outline.width}
                  min={0}
                  max={range(80)}
                  onChange={(width) => patch('outline', { width })}
                  onCommit={() => onCommit('Changed outline width')}
                />
                <Slider
                  label="Opacity"
                  value={Math.round(current.outline.opacity * 100)}
                  defaultValue={Math.round(LAYER_STYLE_DEFAULTS.outline.opacity * 100)}
                  min={0}
                  max={100}
                  format={(value) => `${Math.round(value)}%`}
                  onChange={(value) => patch('outline', { opacity: value / 100 })}
                  onCommit={() => onCommit('Changed outline opacity')}
                />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function ColorField({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string
  value: string
  onChange: (color: string) => void
  onCommit: () => void
}) {
  return (
    <label className="layer-style-color">
      <span>Color</span>
      <input type="color" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onCommit} />
      <code>{value.toUpperCase()}</code>
    </label>
  )
}
