import { walkthroughCopy, type WalkthroughStep } from '../lib/onboardingWalkthrough'

export function OnboardingCoach({
  step,
  onSkip,
}: {
  step: WalkthroughStep
  onSkip: () => void
}) {
  const copy = walkthroughCopy(step)

  return (
    <aside className="onboarding-coach glass-panel" role="region" aria-label="Wreck this poster" aria-live="polite">
      <p className="onboarding-coach-kicker">
        Play {copy.index} / {copy.total}
      </p>
      <h2>{copy.title}</h2>
      <p>{copy.body}</p>
      <div className="onboarding-coach-row">
        <p className="onboarding-coach-hint">{copy.hint}</p>
        <button type="button" onClick={onSkip}>
          Skip intro
        </button>
      </div>
    </aside>
  )
}
