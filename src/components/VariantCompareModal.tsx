import type { DocumentVariant } from '../lib/document'
import { shortcutKeys } from '../lib/shortcuts'
import { Dialog } from './Dialog'

export function VariantCompareModal({
  open,
  variant,
  currentThumbnail,
  onRestore,
  onMerge,
  onClose,
}: {
  open: boolean
  variant: DocumentVariant | null
  currentThumbnail: string | null
  onRestore: () => void
  onMerge: () => void
  onClose: () => void
}) {
  if (!open || !variant) return null

  return (
    <Dialog labelledBy="variant-compare-title" className="variant-compare-modal" onClose={onClose}>
      <h2 id="variant-compare-title">Compare variations</h2>
      <p className="hint">Restore replaces the canvas. Use <kbd>{shortcutKeys('undo')}</kbd> to walk back.</p>
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
        <button type="button" onClick={onMerge}>
          Merge into current
        </button>
        <button type="button" onClick={onClose}>
          Keep editing
        </button>
      </div>
    </Dialog>
  )
}
