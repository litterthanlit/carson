import { useCallback, useEffect, useState } from 'react'
import { applyTheme, currentTheme, THEME_CHANGE_EVENT, type Theme } from '../lib/theme'

/** Current UI theme plus a toggle that persists the choice. Stays in sync across components. */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(currentTheme)

  useEffect(() => {
    const sync = () => setTheme(currentTheme())
    window.addEventListener(THEME_CHANGE_EVENT, sync)
    return () => window.removeEventListener(THEME_CHANGE_EVENT, sync)
  }, [])

  const toggleTheme = useCallback(() => {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', { persist: true })
  }, [])

  return { theme, toggleTheme }
}
