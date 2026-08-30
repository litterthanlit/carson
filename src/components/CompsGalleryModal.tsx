import type { DocumentVariant } from '../lib/document'

export function CompsGalleryModal({
  open,
  variants,
  onRestore,
  onCompare,
  onMerge,
  onRename,
  onFork,
  onClose,
}: {
  open: boolean
  variants: DocumentVariant[]
  onRestore: (variantId: string) => void
  onCompare: (variantId: string) => void
  onMerge: (variantId: string) => void
  onRename: (variantId: string) => void
  onFork: () => void
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="command-backdrop" role="presentation" onClick={onClose}>
      <div
        className="comps-gallery-modal glass-panel"
        role="dialog"
        aria-labelledby="comps-gallery-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="comps-gallery-header">
          <div>
            <h2 id="comps-gallery-title">Comps</h2>
            <p className="hint">Named looks from Fork. Restore, compare, or merge into the canvas.</p>
          </div>
          <div className="button-row">
            <button type="button" className="primary-button" onClick={onFork}>
              Fork current
            </button>
            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        {variants.length === 0 ? (
          <p className="comps-gallery-empty">No comps yet. Fork with Cmd+B to keep this look.</p>
        ) : (
          <ul className="comps-gallery-grid">
            {variants.map((variant) => (
              <li key={variant.id} className="comps-gallery-card">
                {variant.thumbnail ? (
                  <img src={variant.thumbnail} alt="" />
                ) : (
                  <div className="variant-thumb-placeholder" aria-hidden />
                )}
                <strong>{variant.name}</strong>
                <small>{new Date(variant.savedAt).toLocaleString()}</small>
                <div className="variant-actions">
                  <button type="button" onClick={() => onRestore(variant.id)}>
                    Restore
                  </button>
                  <button type="button" onClick={() => onCompare(variant.id)}>
                    Compare
                  </button>
                  <button type="button" onClick={() => onMerge(variant.id)}>
                    Merge
                  </button>
                  <button type="button" onClick={() => onRename(variant.id)}>
                    Rename
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
