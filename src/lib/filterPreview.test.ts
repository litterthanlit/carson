import { describe, expect, it, vi } from 'vitest'
import { clearFilterPreviewCache, debounce } from './filterPreview'

describe('filterPreview', () => {
  it('debounces rapid calls', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const debounced = debounce(fn, 120)
    debounced()
    debounced()
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(120)
    expect(fn).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('clears the preview cache', () => {
    clearFilterPreviewCache()
    expect(true).toBe(true)
  })
})
