import { FontPicker } from './FontPicker'
import type { HudBounds } from '../lib/hudBounds'
import type { SelectedState } from '../types/editor'

type SelectionHudProps = {
  selected: SelectedState
  bounds: HudBounds
  displayScale: number
  customFonts: string[]
  onLoadGoogleFont: (family: string) => Promise<void>
  onUpdateActive: (values: Partial<SelectedState>) => void
  onFinalizeActive: (message: string) => void
}

export function SelectionHud({
  selected,
  bounds,
  displayScale,
  customFonts,
  onLoadGoogleFont,
  onUpdateActive,
  onFinalizeActive,
}: SelectionHudProps) {
  const isText = selected.kind === 'text'
  const isShape = selected.kind === 'shape'
  const left = bounds.left * displayScale
  const top = (bounds.top + bounds.height) * displayScale + 8

  return (
    <div
      className="selection-hud"
      style={{ left, top }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {isText ? (
        <>
          <FontPicker
            value={selected.fontFamily ?? 'Archivo Black'}
            customFonts={customFonts}
            onChange={(family) => {
              onUpdateActive({ fontFamily: family })
              onFinalizeActive('Changed typeface')
            }}
            onLoadGoogleFont={onLoadGoogleFont}
          />
          <label className="hud-field">
            Size
            <input
              type="number"
              min={12}
              max={360}
              value={Math.round(selected.fontSize ?? 80)}
              onChange={(event) => onUpdateActive({ fontSize: Number(event.target.value) })}
              onBlur={() => onFinalizeActive('Changed type size')}
            />
          </label>
        </>
      ) : null}
      {isShape ? (
        <>
          <label className="hud-field">
            Fill
            <input
              type="color"
              value={typeof selected.fill === 'string' && selected.fill.startsWith('#') ? selected.fill : '#111111'}
              onChange={(event) => onUpdateActive({ fill: event.target.value })}
              onBlur={() => onFinalizeActive('Changed fill')}
            />
          </label>
          <label className="hud-field">
            Stroke
            <input
              type="number"
              min={0}
              max={80}
              value={Math.round(selected.strokeWidth ?? 0)}
              onChange={(event) => onUpdateActive({ strokeWidth: Number(event.target.value) })}
              onBlur={() => onFinalizeActive('Changed stroke')}
            />
          </label>
        </>
      ) : null}
      <label className="hud-field">
        Opacity
        <input
          type="number"
          min={0}
          max={100}
          value={Math.round(selected.opacity * 100)}
          onChange={(event) => onUpdateActive({ opacity: Number(event.target.value) / 100 })}
          onBlur={() => onFinalizeActive('Changed opacity')}
        />
      </label>
    </div>
  )
}
