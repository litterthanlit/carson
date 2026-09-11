import { describe, expect, it } from 'vitest'
import {
  blankPosterCanvas,
  hasUnsavedWork,
  newPosterChoices,
  presetForNewPoster,
  unsavedWorkCopy,
} from './newPoster'

describe('new poster', () => {
  it('treats a dirty editor as unsaved work', () => {
    expect(hasUnsavedWork(true)).toBe(false)
    expect(hasUnsavedWork(false)).toBe(true)
  })

  it('starts a blank canvas instead of the seed poster', () => {
    const canvas = blankPosterCanvas()
    expect(canvas.objects).toEqual([])
    expect(canvas.background).toBe('#f6f1e6')
  })

  it('maps size choices to print or screen intent without mutating an open canvas', () => {
    const choices = newPosterChoices()
    expect(choices.map((choice) => choice.id)).toEqual(['a3', 'a2', 'instagram', 'square', 'custom'])
    expect(presetForNewPoster('instagram')).toMatchObject({ id: 'instagram', width: 1080, height: 1350 })
    expect(presetForNewPoster('custom', { width: 800, height: 900 })).toMatchObject({
      id: 'custom',
      width: 800,
      height: 900,
    })
  })

  it('explains why load, new, and restore replace the open file', () => {
    expect(unsavedWorkCopy('new').body).toMatch(/new poster will replace/i)
    expect(unsavedWorkCopy('open').body).toMatch(/opening another poster will replace/i)
    expect(unsavedWorkCopy('restore').body).toMatch(/restoring the recovered session will replace/i)
  })
})
