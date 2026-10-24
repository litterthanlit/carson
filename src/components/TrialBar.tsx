import { Check, Dices, X } from 'lucide-react'
import { ariaKeyShortcuts, shortcutKeys, withShortcut } from '../lib/shortcuts'

/**
 * Shown while a treatment is being tried on the poster: keep it, roll a new variation,
 * or cancel back to how the poster was.
 */
export function TrialBar({
  name,
  detail,
  onKeep,
  onReroll,
  onCancel,
}: {
  name: string
  detail?: string
  onKeep: () => void
  onReroll: () => void
  onCancel: () => void
}) {
  return (
    <div className="trial-bar glass-panel" role="toolbar" aria-label={`Trying ${name}`}>
      <span className="trial-bar-label" role="status">
        Trying <strong>{name}</strong>
        {detail ? <small>{detail}</small> : null}
      </span>
      <button type="button" title={withShortcut('Roll a new variation', 'reroll')} aria-keyshortcuts={ariaKeyShortcuts('reroll')} onClick={onReroll}>
        <Dices size={14} aria-hidden /> Re-roll
      </button>
      <button type="button" title={withShortcut('Put the poster back', 'cancel')} aria-keyshortcuts={ariaKeyShortcuts('cancel')} onClick={onCancel}>
        <X size={14} aria-hidden /> Cancel
      </button>
      <button
        type="button"
        className="primary-button"
        title={withShortcut('Keep this treatment', 'confirm')}
        aria-keyshortcuts={ariaKeyShortcuts('confirm')}
        onClick={onKeep}
      >
        <Check size={14} aria-hidden /> Keep <kbd aria-hidden>{shortcutKeys('confirm')}</kbd>
      </button>
    </div>
  )
}
