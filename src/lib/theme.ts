export type Theme = 'dark' | 'light'

export const THEME_KEY = 'carson.theme.v1'
/** Fired on window after the theme changes, for canvas-drawn UI (rulers) that must repaint. */
export const THEME_CHANGE_EVENT = 'carson:themechange'

export function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light'
}

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return isTheme(stored) ? stored : null
  } catch {
    return null
  }
}

/** Saved choice first, then the OS preference, then dark (the editor's original look). */
export function resolveInitialTheme(): Theme {
  const stored = readStoredTheme()
  if (stored) return stored
  try {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light'
  } catch {
    // matchMedia unavailable (tests, old engines): fall through.
  }
  return 'dark'
}

export function currentTheme(): Theme {
  const value = typeof document !== 'undefined' ? document.documentElement.dataset.theme : undefined
  return isTheme(value) ? value : 'dark'
}

export function applyTheme(theme: Theme, { persist = false }: { persist?: boolean } = {}) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // Storage blocked: the theme still applies for this session.
    }
  }
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: theme }))
}
