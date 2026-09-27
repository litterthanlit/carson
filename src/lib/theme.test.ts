// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, currentTheme, resolveInitialTheme, THEME_CHANGE_EVENT, THEME_KEY } from './theme'

afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  vi.unstubAllGlobals()
})

describe('theme', () => {
  it('prefers the saved choice', () => {
    localStorage.setItem(THEME_KEY, 'light')
    expect(resolveInitialTheme()).toBe('light')
  })

  it('falls back to the OS preference, then dark', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('light') }))
    expect(resolveInitialTheme()).toBe('light')
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    expect(resolveInitialTheme()).toBe('dark')
  })

  it('ignores junk in storage', () => {
    localStorage.setItem(THEME_KEY, 'sepia')
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    expect(resolveInitialTheme()).toBe('dark')
  })

  it('applies to the root, persists on request and announces the change', () => {
    const seen: string[] = []
    const listener = (event: Event) => seen.push(String((event as CustomEvent).detail))
    window.addEventListener(THEME_CHANGE_EVENT, listener)
    applyTheme('light')
    expect(currentTheme()).toBe('light')
    expect(localStorage.getItem(THEME_KEY)).toBeNull()
    applyTheme('dark', { persist: true })
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
    expect(seen).toEqual(['light', 'dark'])
    window.removeEventListener(THEME_CHANGE_EVENT, listener)
  })
})
