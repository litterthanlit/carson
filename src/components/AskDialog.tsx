import { useState } from 'react'
import type { AskAnswer, AskRequest } from '../hooks/useAsk'
import { Dialog } from './Dialog'

/** Answers the question from useAsk: a name to type, or a yes/no before something irreversible. */
export function AskDialog({ request, onAnswer }: { request: AskRequest | null; onAnswer: (answer: AskAnswer) => void }) {
  if (!request) return null
  if (request.kind === 'text') {
    return (
      <TextAsk
        key={request.id}
        title={request.title}
        label={request.label}
        defaultValue={request.defaultValue ?? ''}
        submitLabel={request.submitLabel ?? 'Save'}
        onAnswer={onAnswer}
      />
    )
  }
  return (
    <Dialog key={request.id} labelledBy="ask-title" className="file-dialog ask-dialog" onClose={() => onAnswer(false)}>
      <h2 id="ask-title">{request.title}</h2>
      <p>{request.body}</p>
      <div className="button-row">
        <button
          type="button"
          className={request.destructive ? 'primary-button danger-button' : 'primary-button'}
          data-autofocus={request.destructive ? undefined : true}
          onClick={() => onAnswer(true)}
        >
          {request.confirmLabel}
        </button>
        <button type="button" data-autofocus={request.destructive ? true : undefined} onClick={() => onAnswer(false)}>
          {request.cancelLabel ?? 'Cancel'}
        </button>
      </div>
    </Dialog>
  )
}

function TextAsk({
  title,
  label,
  defaultValue,
  submitLabel,
  onAnswer,
}: {
  title: string
  label: string
  defaultValue: string
  submitLabel: string
  onAnswer: (answer: AskAnswer) => void
}) {
  const [value, setValue] = useState(defaultValue)
  const trimmed = value.trim()

  return (
    <Dialog labelledBy="ask-title" className="file-dialog ask-dialog" onClose={() => onAnswer(null)}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (trimmed) onAnswer(trimmed)
        }}
      >
        <h2 id="ask-title">{title}</h2>
        <label className="save-as-name">
          <span>{label}</span>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            aria-invalid={!trimmed}
            data-autofocus
          />
        </label>
        <div className="button-row">
          <button type="submit" className="primary-button" disabled={!trimmed}>
            {submitLabel}
          </button>
          <button type="button" onClick={() => onAnswer(null)}>
            Cancel
          </button>
        </div>
      </form>
    </Dialog>
  )
}
