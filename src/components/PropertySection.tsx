import { useId, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

const STORAGE_KEY = 'carson.inspector.sections.v1'

function readStoredState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

function writeStoredState(id: string, open: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readStoredState(), [id]: open }))
  } catch {
    // Private mode or blocked storage: the section still works, it just won't remember.
  }
}

type PropertySectionProps = {
  /** Stable key used to remember the open/closed state between sessions. */
  id: string
  title: string
  defaultOpen?: boolean
  /** Short status shown on the right of the header, e.g. "2 on". */
  summary?: ReactNode
  children: ReactNode
}

/**
 * Collapsible inspector group (Transform, Appearance, Effects…), like the
 * property panels in Photoshop / Figma. Open state persists per section id.
 */
export function PropertySection({ id, title, defaultOpen = true, summary, children }: PropertySectionProps) {
  const [open, setOpen] = useState(() => readStoredState()[id] ?? defaultOpen)
  const bodyId = useId()

  const toggle = () => {
    const next = !open
    setOpen(next)
    writeStoredState(id, next)
  }

  return (
    <section className={open ? 'property-section open' : 'property-section'} aria-label={title}>
      <h3 className="property-section-heading">
        <button type="button" className="property-section-toggle" aria-expanded={open} aria-controls={bodyId} onClick={toggle}>
          <ChevronRight size={12} className="property-section-caret" aria-hidden="true" />
          <span className="property-section-title">{title}</span>
          {summary ? <span className="property-section-summary">{summary}</span> : null}
        </button>
      </h3>
      <div id={bodyId} className="property-section-body" hidden={!open}>
        {children}
      </div>
    </section>
  )
}
