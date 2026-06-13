import type { DocumentVariant } from '../lib/document'

export function VariantCompareModal({
  open,
  variant,
  currentThumbnail,
  onRestore,
  onClose,
}: {
  open: boolean
  variant: DocumentVariant | null
  currentThumbnail: string | null
  onRestore: () => void
  onClose: () => void
}) {
  if (!open || !variant) return null

  return (
    <div className="command-backdrop" role="presentation" onClick={onClose}>
      <div
        className="variant-compare-modal glass-panel"
        role="dialog"
        aria-labelledby="variant-compare-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="variant-compare-title">Compare variations</h2>
        <p className="hint">Restore replaces the canvas. Use <kbd>Cmd+Z</kbd> to walk back.</p>
        <div className="variant-compare-grid">
          <figure>
            <figcaption>Current</figcaption>
            {currentThumbnail ? (
              <img src={currentThumbnail} alt="Current poster preview" />
            ) : (
              <div className="variant-thumb-placeholder">No preview</div>
            )}
          </figure>
          <figure>
            <figcaption>{variant.name}</figcaption>
            {variant.thumbnail ? (
              <img src={variant.thumbnail} alt={`${variant.name} preview`} />
            ) : (
              <div className="variant-thumb-placeholder">No preview</div>
            )}
          </figure>
        </div>
        <div className="button-row">
          <button type="button" className="primary-button" onClick={onRestore}>
            Restore {variant.name}
          </button>
          <button type="button" onClick={onClose}>
            Keep editing
          </button>
        </div>
      </div>
    </div>
  )
}
