import { unsavedWorkCopy, type ReplaceReason } from '../lib/newPoster'

type UnsavedWorkDialogProps = {
  open: boolean
  reason: ReplaceReason
  onCancel: () => void
  onDiscard: () => void
  onSave: () => void
}

export function UnsavedWorkDialog({ open, reason, onCancel, onDiscard, onSave }: UnsavedWorkDialogProps) {
  if (!open) return null
  const copy = unsavedWorkCopy(reason)

  return (
    <div className="command-backdrop unsaved-backdrop" role="presentation">
      <div className="file-dialog glass-panel" role="dialog" aria-labelledby="unsaved-work-title">
        <h2 id="unsaved-work-title">{copy.title}</h2>
        <p>{copy.body}</p>
        <div className="button-row">
          <button type="button" className="primary-button" onClick={onSave}>
            Save
          </button>
          <button type="button" onClick={onDiscard}>
            Don&apos;t save
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
