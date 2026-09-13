import { useEffect, useState } from 'react'
import { saveAsDialogCopy, saveAsNameError } from '../lib/fileIdentity'

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
    <div className="command-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="file-dialog glass-panel"
        role="dialog"
        aria-labelledby="save-as-title"
        onMouseDown={(event) => event.stopPropagation()}
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
            autoFocus
          />
        </label>
        {error ? (
          <p className="hint" role="alert">
            {error}
          </p>
        ) : null}
        <div className="button-row">
          <button
            type="button"
            className="primary-button"
            disabled={Boolean(error)}
            onClick={() => {
              if (error) return
              onSaveAs(name.trim())
            }}
          >
            {copy.submit}
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
