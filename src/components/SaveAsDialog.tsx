import { useEffect, useState } from 'react'
import { saveAsDialogCopy, saveAsNameError } from '../lib/fileIdentity'
import { Dialog } from './Dialog'

type SaveAsDialogProps = {
  open: boolean
  suggestedName: string
  existingNames: readonly string[]
  onSaveAs: (name: string) => void
  onClose: () => void
}

export function SaveAsDialog({ open, suggestedName, existingNames, onSaveAs, onClose }: SaveAsDialogProps) {
  const [name, setName] = useState(suggestedName)
  const copy = saveAsDialogCopy()

  useEffect(() => {
    if (open) setName(suggestedName)
  }, [open, suggestedName])

  if (!open) return null

  const error = saveAsNameError(name, existingNames)

  return (
    <Dialog labelledBy="save-as-title" className="file-dialog" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (error) return
          onSaveAs(name.trim())
        }}
      >
        <h2 id="save-as-title">{copy.title}</h2>
        <p className="hint">{copy.body}</p>
        <label className="save-as-name">
          <span>Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Save as name"
            aria-invalid={Boolean(error)}
            data-autofocus
          />
        </label>
        {error ? (
          <p className="hint" role="alert">
            {error}
          </p>
        ) : null}
        <div className="button-row">
          <button type="submit" className="primary-button" disabled={Boolean(error)}>
            {copy.submit}
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Dialog>
  )
}
