import { describe, expect, it } from 'vitest'
import {
  advanceWalkthrough,
  isWalkthroughStep,
  walkthroughCopy,
  WALKTHROUGH_STEPS,
} from './onboardingWalkthrough'

describe('onboardingWalkthrough', () => {
  it('names four play steps in scatter → xerox → reroll → undo order', () => {
    expect(WALKTHROUGH_STEPS).toEqual(['scatter', 'xerox', 'reroll', 'undo'])
  })

  it('advances only on the matching action', () => {
    expect(advanceWalkthrough('scatter', 'xerox')).toBe('scatter')
    expect(advanceWalkthrough('scatter', 'reroll')).toBe('scatter')
    expect(advanceWalkthrough('scatter', 'undo')).toBe('scatter')
    expect(advanceWalkthrough('scatter', 'scatter')).toBe('xerox')
  })

  it('walks the full lesson then finishes', () => {
    const xerox = advanceWalkthrough('scatter', 'scatter')
    expect(xerox).toBe('xerox')
    const reroll = advanceWalkthrough('xerox', 'xerox')
    expect(reroll).toBe('reroll')
    const undo = advanceWalkthrough('reroll', 'reroll')
    expect(undo).toBe('undo')
    expect(advanceWalkthrough('undo', 'undo')).toBe('done')
  })

  it('skip finishes from any step', () => {
    expect(advanceWalkthrough('scatter', 'skip')).toBe('done')
    expect(advanceWalkthrough('xerox', 'skip')).toBe('done')
    expect(advanceWalkthrough('reroll', 'skip')).toBe('done')
    expect(advanceWalkthrough('undo', 'skip')).toBe('done')
  })

  it('narrows stored step ids', () => {
    expect(isWalkthroughStep('scatter')).toBe(true)
    expect(isWalkthroughStep('done')).toBe(false)
    expect(isWalkthroughStep(null)).toBe(false)
  })

  it('exposes numbered copy for the coach', () => {
    const scatter = walkthroughCopy('scatter')
    expect(scatter.index).toBe(1)
    expect(scatter.total).toBe(4)
    expect(scatter.title).toMatch(/scatter/i)
    expect(walkthroughCopy('undo').index).toBe(4)
    expect(walkthroughCopy('reroll').hint).toMatch(/R/)
  })
})
