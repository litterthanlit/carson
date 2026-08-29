export const WALKTHROUGH_STEPS = ['scatter', 'xerox', 'reroll', 'undo'] as const

export type WalkthroughStep = (typeof WALKTHROUGH_STEPS)[number]
export type WalkthroughEvent = WalkthroughStep | 'skip'
export type WalkthroughAdvance = WalkthroughStep | 'done'

export type WalkthroughCopy = {
  index: number
  total: number
  title: string
  body: string
  hint: string
  status: string
}

const COPY: Record<WalkthroughStep, Omit<WalkthroughCopy, 'index' | 'total'>> = {
  scatter: {
    title: 'Scatter the headline',
    body: 'Instruments is open. Hit Scatter and watch the type jump — the seed is the leash.',
    hint: 'Scatter in Instruments',
    status: 'Scatter the headline',
  },
  xerox: {
    title: 'Xerox it',
    body: 'Copy selected. The photocopy warps the look. The type underneath stays type.',
    hint: 'Copy selected in Print',
    status: 'Xerox the selection — Copy selected',
  },
  reroll: {
    title: 'Re-roll the accident',
    body: 'Same move, new seed. Press R, or the dice in the stage bar.',
    hint: 'R or Re-roll',
    status: 'Press R to re-roll',
  },
  undo: {
    title: 'Walk it back',
    body: 'Every accident reverses. Cmd+Z, or Undo in the header.',
    hint: 'Cmd+Z or Undo',
    status: 'Undo it — Cmd+Z',
  },
}

export function isWalkthroughStep(value: string | null | undefined): value is WalkthroughStep {
  return WALKTHROUGH_STEPS.includes(value as WalkthroughStep)
}

export function walkthroughCopy(step: WalkthroughStep): WalkthroughCopy {
  const index = WALKTHROUGH_STEPS.indexOf(step)
  return {
    index: index + 1,
    total: WALKTHROUGH_STEPS.length,
    ...COPY[step],
  }
}

export function advanceWalkthrough(current: WalkthroughStep, event: WalkthroughEvent): WalkthroughAdvance {
  if (event === 'skip') return 'done'
  if (event !== current) return current
  const nextIndex = WALKTHROUGH_STEPS.indexOf(current) + 1
  return WALKTHROUGH_STEPS[nextIndex] ?? 'done'
}
