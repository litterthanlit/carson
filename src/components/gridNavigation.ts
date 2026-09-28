import type { KeyboardEvent } from 'react'

/** Index the focus should move to for a grid key, or null when the key isn't a grid move. */
export function nextGridIndex(key: string, index: number, count: number, columns: number): number | null {
  if (count <= 0) return null
  const cols = Math.max(1, columns)
  switch (key) {
    case 'ArrowRight':
      return Math.min(count - 1, index + 1)
    case 'ArrowLeft':
      return Math.max(0, index - 1)
    case 'ArrowDown':
      return index + cols < count ? index + cols : index
    case 'ArrowUp':
      return index - cols >= 0 ? index - cols : index
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

/** Rendered column count of a CSS grid; falls back when layout isn't available (tests). */
export function gridColumnCount(grid: HTMLElement, fallback = 2): number {
  const tracks = getComputedStyle(grid).gridTemplateColumns
  const count = tracks && tracks !== 'none' ? tracks.trim().split(/\s+/).length : 0
  return count > 0 ? count : fallback
}

/**
 * Roving-focus keyboard model for a `role="listbox"` grid of `role="option"` tiles:
 * arrows, Home and End move focus and selection together. Only the selected tile is a Tab stop.
 */
export function handleGridKeyDown(event: KeyboardEvent<HTMLElement>, onSelectIndex: (index: number) => void) {
  const grid = event.currentTarget
  const options = Array.from(grid.querySelectorAll<HTMLElement>('[role="option"]'))
  const index = options.indexOf(document.activeElement as HTMLElement)
  if (index < 0) return
  const next = nextGridIndex(event.key, index, options.length, gridColumnCount(grid))
  if (next === null) return
  event.preventDefault()
  if (next === index) return
  options[next]?.focus()
  onSelectIndex(next)
}
