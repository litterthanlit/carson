import type { DocumentVariant } from '../lib/document'

type ExplorationTrailProps = {
  variants: DocumentVariant[]
  activeLabel: string
  onSelect: (variantId: string) => void
  onFork: () => void
}

export function ExplorationTrail({ variants, activeLabel, onSelect, onFork }: ExplorationTrailProps) {
  if (variants.length === 0) {
    return (
      <div className="exploration-trail glass-bar">
        <span className="trail-label">Exploration trail</span>
        <button type="button" className="trail-fork" onClick={onFork} title="Fork current state (Cmd+B)">
          Fork first variant
        </button>
      </div>
    )
  }

  return (
    <div className="exploration-trail glass-bar" aria-label="Exploration trail">
      <span className="trail-label">Trail</span>
      <div className="trail-filmstrip" role="list">
        <button type="button" className="trail-chip active" title={`Current — ${activeLabel}`}>
          <span className="trail-chip-label">Now</span>
        </button>
        {variants.map((variant) => (
          <button
            key={variant.id}
            type="button"
            className="trail-chip"
            role="listitem"
            title={`Restore ${variant.name}`}
            onClick={() => onSelect(variant.id)}
          >
            {variant.thumbnail ? <img src={variant.thumbnail} alt="" /> : <span className="trail-thumb-placeholder" />}
            <span className="trail-chip-label">{variant.name}</span>
          </button>
        ))}
      </div>
      <button type="button" className="trail-fork" onClick={onFork} title="Fork current state (Cmd+B)">
        + Fork
      </button>
    </div>
  )
}
