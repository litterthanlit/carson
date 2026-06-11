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
    <div className="command-backdrop" role="presentation">
      <div className="onboarding-modal glass-panel" role="dialog" aria-labelledby="onboarding-title">
        <h2 id="onboarding-title">Wreck this poster</h2>
        <p>
          Carson teaches by play. You&apos;ll get a finished boring poster — then scatter it, xerox it, re-roll the
          accident, and undo it. Precision and play are the same gesture.
        </p>
        <ol className="onboarding-steps">
          <li>Scatter the headline — watch the seed number</li>
          <li>Hit Xerox on the selection — text stays editable underneath</li>
          <li>Press <kbd>R</kbd> to re-roll, <kbd>Cmd+Z</kbd> to walk it back</li>
        </ol>
        <div className="button-row">
          <button type="button" className="primary-button" onClick={onStart}>
            Let&apos;s wreck it
          </button>
          <button type="button" onClick={onSkip}>
            Skip intro
          </button>
        </div>
      </div>
    </div>
  )
}
