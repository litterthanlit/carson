import { describe, expect, it } from 'vitest'
import { HANDLE_SCREEN_PX, selectionChrome } from './selectionChrome'

describe('selectionChrome', () => {
  it('keeps handle size screen-constant as zoom changes', () => {
    expect(selectionChrome(1).cornerSize).toBe(HANDLE_SCREEN_PX)
    expect(selectionChrome(0.25).cornerSize).toBe(HANDLE_SCREEN_PX / 0.25)
    expect(selectionChrome(4).cornerSize).toBe(HANDLE_SCREEN_PX / 4)
  })

  it('uses filled white squares with accent stroke', () => {
    const chrome = selectionChrome(1)
    expect(chrome.transparentCorners).toBe(false)
    expect(chrome.cornerColor).toBe('#ffffff')
    expect(chrome.cornerStrokeColor).toBe('#1473e6')
    expect(chrome.cornerStyle).toBe('rect')
  })
})
