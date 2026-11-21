import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

export function ThemeToggle({ className = 'icon-button theme-toggle' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      className={className}
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      onClick={toggleTheme}
    >
      {theme === 'dark' ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
    </button>
  )
}
