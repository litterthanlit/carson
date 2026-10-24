import { unsavedWorkCopy, type ReplaceReason } from '../lib/newPoster'
import { Dialog } from './Dialog'

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
    <Dialog labelledBy="unsaved-work-title" className="file-dialog" onClose={onCancel} closeOnBackdrop={false}>
      <h2 id="unsaved-work-title">{copy.title}</h2>
      <p>{copy.body}</p>
      <div className="button-row">
        <button type="button" className="primary-button" data-autofocus onClick={onSave}>
          Save
        </button>
        <button type="button" onClick={onDiscard}>
          Don&apos;t save
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </Dialog>
  )
}
