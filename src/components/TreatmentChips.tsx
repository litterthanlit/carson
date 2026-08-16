import { ChevronDown, ChevronUp, Dices, Eye, EyeOff, Trash2 } from 'lucide-react'
import type { FabricObject } from 'fabric'
import { posterTreatmentLabel } from '../lib/posterTreatments'
import { treatmentLabel, type Treatment } from '../lib/treatments'

type TreatmentChipsProps = {
  posterTreatments: Treatment[]
  selectedTreatments: Treatment[]
  selectedObject: FabricObject | null
  compact?: boolean
  onReorderPosterTreatment: (id: string, direction: 'up' | 'down') => void
  onRerollPosterTreatment: (id: string) => void
  onTogglePosterTreatment: (id: string) => void
  onRemovePosterTreatment: (id: string) => void
  onReorderLayerTreatment: (id: string, direction: 'up' | 'down') => void
  onRerollLayerTreatment: (id: string) => void
  onToggleLayerTreatment: (id: string) => void
  onRemoveLayerTreatment: (object: FabricObject, id: string) => void
}

function Chip({
  label,
  seed,
  enabled,
  index,
  total,
  onUp,
  onDown,
  onReroll,
  onToggle,
  onRemove,
}: {
  label: string
  seed: number
  enabled: boolean
  index: number
  total: number
  onUp: () => void
  onDown: () => void
  onReroll: () => void
  onToggle: () => void
  onRemove: () => void
}) {
  return (
    <li className={enabled ? 'treatment-chip' : 'treatment-chip bypassed'}>
      <span className="treatment-chip-label">{label}</span>
      <small>#{seed}</small>
      <span className="treatment-actions">
        <button type="button" title="Move earlier in the stack" disabled={index === 0} onClick={onUp}>
          <ChevronUp size={12} />
        </button>
        <button type="button" title="Move later in the stack" disabled={index === total - 1} onClick={onDown}>
          <ChevronDown size={12} />
        </button>
        <button type="button" title="Re-roll seed" onClick={onReroll}>
          <Dices size={12} />
        </button>
        <button type="button" title={enabled ? 'Bypass' : 'Enable'} onClick={onToggle}>
          {enabled ? <Eye size={12} /> : <EyeOff size={12} />}
        </button>
        <button type="button" title="Remove" onClick={onRemove}>
          <Trash2 size={12} />
        </button>
      </span>
    </li>
  )
}

export function TreatmentChips({
  posterTreatments,
  selectedTreatments,
  selectedObject,
  compact = false,
  onReorderPosterTreatment,
  onRerollPosterTreatment,
  onTogglePosterTreatment,
  onRemovePosterTreatment,
  onReorderLayerTreatment,
  onRerollLayerTreatment,
  onToggleLayerTreatment,
  onRemoveLayerTreatment,
}: TreatmentChipsProps) {
  if (posterTreatments.length === 0 && selectedTreatments.length === 0) return null

  return (
    <div className={compact ? 'treatment-chips compact' : 'treatment-chips'} aria-label="Treatment stack">
      {posterTreatments.length > 0 ? (
        <ul className="treatment-chip-row">
          {posterTreatments.map((treatment, index) => (
            <Chip
              key={treatment.id}
              label={posterTreatmentLabel(treatment)}
              seed={treatment.seed}
              enabled={treatment.enabled}
              index={index}
              total={posterTreatments.length}
              onUp={() => onReorderPosterTreatment(treatment.id, 'up')}
              onDown={() => onReorderPosterTreatment(treatment.id, 'down')}
              onReroll={() => onRerollPosterTreatment(treatment.id)}
              onToggle={() => onTogglePosterTreatment(treatment.id)}
              onRemove={() => onRemovePosterTreatment(treatment.id)}
            />
          ))}
        </ul>
      ) : null}
      {selectedTreatments.length > 0 ? (
        <ul className="treatment-chip-row">
          {selectedTreatments.map((treatment, index) => (
            <Chip
              key={treatment.id}
              label={treatmentLabel(treatment)}
              seed={treatment.seed}
              enabled={treatment.enabled}
              index={index}
              total={selectedTreatments.length}
              onUp={() => onReorderLayerTreatment(treatment.id, 'up')}
              onDown={() => onReorderLayerTreatment(treatment.id, 'down')}
              onReroll={() => onRerollLayerTreatment(treatment.id)}
              onToggle={() => onToggleLayerTreatment(treatment.id)}
              onRemove={() => {
                if (!selectedObject) return
                onRemoveLayerTreatment(selectedObject, treatment.id)
              }}
            />
          ))}
        </ul>
      ) : null}
    </div>
  )
}
