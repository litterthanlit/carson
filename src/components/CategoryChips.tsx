import { useCallback, useEffect, useRef, useState } from 'react'

type CategoryChipsProps<Id extends string> = {
  items: readonly { id: Id; label: string }[]
  active: Id
  ariaLabel: string
  onSelect: (id: Id) => void
}

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Single-row category bar shared by both galleries. It scrolls sideways however many categories
 * exist, fades the edges that have more chips beyond them, and keeps the active chip in view.
 * Chips are ordinary buttons in Tab order.
 */
export function CategoryChips<Id extends string>({ items, active, ariaLabel, onSelect }: CategoryChipsProps<Id>) {
  const barRef = useRef<HTMLElement | null>(null)
  const activeRef = useRef<HTMLButtonElement | null>(null)
  const scrolledRef = useRef(false)
  const [edges, setEdges] = useState({ start: false, end: false })

  const updateEdges = useCallback(() => {
    const bar = barRef.current
    if (!bar) return
    const start = bar.scrollLeft > 1
    const end = bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 1
    setEdges((current) => (current.start === start && current.end === end ? current : { start, end }))
  }, [])

  // A remembered category can sit off-screen: jump there on open, glide on later changes.
  // A passive effect, so it runs after GalleryDialog's showModal() has given the bar a layout.
  useEffect(() => {
    const bar = barRef.current
    const chip = activeRef.current
    if (!bar || !chip) return
    // Center the chip; offsetLeft is relative to the bar, which is position: relative.
    const left = Math.max(0, chip.offsetLeft - (bar.clientWidth - chip.offsetWidth) / 2)
    const smooth = scrolledRef.current && !prefersReducedMotion()
    scrolledRef.current = true
    if (smooth && typeof bar.scrollTo === 'function') bar.scrollTo({ left, behavior: 'smooth' })
    else bar.scrollLeft = left
    updateEdges()
  }, [active, updateEdges])

  useEffect(() => {
    const bar = barRef.current
    if (!bar || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(updateEdges)
    observer.observe(bar)
    return () => observer.disconnect()
  }, [updateEdges])

  return (
    <nav
      ref={barRef}
      className={`filter-gallery-categories${edges.start ? ' fade-start' : ''}${edges.end ? ' fade-end' : ''}`}
      aria-label={ariaLabel}
      onScroll={updateEdges}
    >
      {items.map((item) => (
        <button
          key={item.id}
          ref={active === item.id ? activeRef : undefined}
          type="button"
          className={active === item.id ? 'active' : undefined}
          aria-pressed={active === item.id}
          onClick={() => onSelect(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}
