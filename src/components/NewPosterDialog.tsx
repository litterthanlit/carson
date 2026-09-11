import { useState } from 'react'
import { POSTER_PRESET_OPTIONS } from '../lib/editorConstants'
import { type PosterPreset, type PosterPresetId } from '../lib/editorModel'
import { newPosterChoices, presetForNewPoster } from '../lib/newPoster'

type NewPosterDialogProps = {
  open: boolean
  onCreate: (preset: PosterPreset) => void
  onClose: () => void
}

export function NewPosterDialog({ open, onCreate, onClose }: NewPosterDialogProps) {
  const [presetId, setPresetId] = useState<PosterPresetId>('a3')
  const [customSize, setCustomSize] = useState({ width: 1200, height: 1600 })

  if (!open) return null

  const choices = newPosterChoices()
  const selected = choices.find((choice) => choice.id === presetId) ?? choices[0]
  const preset = presetForNewPoster(presetId, customSize)

  return (
    <div className="command-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="file-dialog glass-panel"
        role="dialog"
        aria-labelledby="new-poster-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="new-poster-title">New poster</h2>
        <p className="hint">Pick a size, then Carson starts a new file. This does not change the poster you already have open until you create.</p>
        <div className="new-poster-choices" role="listbox" aria-label="Poster size">
          {choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              role="option"
              aria-selected={choice.id === presetId}
              className={choice.id === presetId ? 'active' : undefined}
              onClick={() => setPresetId(choice.id)}
            >
              <strong>{choice.label}</strong>
              <small>
                {choice.intent} · {choice.detail}
              </small>
            </button>
          ))}
        </div>
        {presetId === 'custom' ? (
          <div className="new-poster-custom">
            <label>
              Width
              <input
                type="number"
                min={320}
                max={10000}
                aria-label="Custom width"
                value={customSize.width}
                onChange={(event) =>
                  setCustomSize((current) => ({ ...current, width: Number(event.target.value) }))
                }
              />
            </label>
            <label>
              Height
              <input
                type="number"
                min={320}
                max={10000}
                aria-label="Custom height"
                value={customSize.height}
                onChange={(event) =>
                  setCustomSize((current) => ({ ...current, height: Number(event.target.value) }))
                }
              />
            </label>
          </div>
        ) : (
          <p className="hint">
            {POSTER_PRESET_OPTIONS.find((option) => option.id === presetId)?.label ?? selected?.label}: {preset.width} ×{' '}
            {preset.height}px
            {preset.dpi ? ` @ ${preset.dpi}dpi` : ''}
          </p>
        )}
        <div className="button-row">
          <button type="button" className="primary-button" onClick={() => onCreate(preset)}>
            Create poster
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
