import { shortcutKeys } from '../lib/shortcuts'
import { Dialog } from './Dialog'

export function OnboardingModal({
  open,
  onStart,
  onSkip,
}: {
  open: boolean
  onStart: () => void
  onSkip: () => void
}) {
  if (!open) return null

  return (
    <Dialog labelledBy="onboarding-title" className="onboarding-modal" onClose={onSkip} closeOnBackdrop={false}>
      <h2 id="onboarding-title">Wreck this poster</h2>
      <p>
        Carson teaches by play. You&apos;ll get a finished boring poster — then scramble the structure, scatter it,
        xerox it, re-roll the accident, and undo it. Precision and play are the same gesture.
      </p>
      <ol className="onboarding-steps">
        <li>Scatter the headline — watch the seed number</li>
        <li>Hit Xerox on the selection — text stays editable underneath</li>
        <li>Press <kbd>{shortcutKeys('reroll')}</kbd> to re-roll, <kbd>{shortcutKeys('undo')}</kbd> to walk it back</li>
      </ol>
      <div className="button-row">
        <button type="button" className="primary-button" data-autofocus onClick={onStart}>
          Let&apos;s wreck it
        </button>
        <button type="button" onClick={onSkip}>
          Skip intro
        </button>
      </div>
    </Dialog>
  )
}
