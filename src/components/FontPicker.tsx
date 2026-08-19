import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { FONT_CATEGORIES, fontsForCategory, isLibraryFont } from '../lib/fonts'
import { FONT_STACKS } from '../lib/editorConstants'

type FontPickerProps = {
  value: string
  customFonts: string[]
  onChange: (family: string) => void
  onLoadGoogleFont: (family: string) => Promise<void>
}

type FontGroup = {
  label: string
  fonts: string[]
}

export function FontPicker({ value, customFonts, onChange, onLoadGoogleFont }: FontPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const listId = useId()

  const groups: FontGroup[] = useMemo(() => {
    const next: FontGroup[] = [
      ...FONT_CATEGORIES.map((category) => ({
        label: category.label,
        fonts: fontsForCategory(category.id).map((font) => font.family),
      })),
      { label: 'System', fonts: FONT_STACKS },
    ]
    if (customFonts.length > 0) {
      next.push({ label: 'Uploaded', fonts: customFonts })
    }
    const needle = query.trim().toLowerCase()
    if (!needle) return next
    return next
      .map((group) => ({
        ...group,
        fonts: group.fonts.filter((font) => font.toLowerCase().includes(needle)),
      }))
      .filter((group) => group.fonts.length > 0)
  }, [customFonts, query])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    const menu = menuRef.current
    if (!menu) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const family = (entry.target as HTMLElement).dataset.family
          if (family && isLibraryFont(family)) void onLoadGoogleFont(family)
        }
      },
      { root: menu, rootMargin: '48px' },
    )
    menu.querySelectorAll<HTMLElement>('[data-family]').forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [open, groups, onLoadGoogleFont])

  const selectFont = (family: string) => {
    const apply = () => {
      onChange(family)
      setOpen(false)
    }
    if (isLibraryFont(family)) {
      void onLoadGoogleFont(family).finally(apply)
      return
    }
    apply()
  }

  return (
    <div className="font-picker" ref={rootRef}>
      <button
        type="button"
        className="font-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        title="Choose a typeface — each name renders in its own font"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="font-picker-current" style={{ fontFamily: value }}>
          {value}
        </span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <div className="font-picker-menu" ref={menuRef} role="listbox" id={listId} aria-label="Fonts">
          <label className="font-picker-search">
            <span className="visually-hidden">Search fonts</span>
            <input
              type="search"
              value={query}
              placeholder="Search fonts"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
            />
          </label>
          {groups.length === 0 ? <p className="font-picker-empty">No matching fonts</p> : null}
          {groups.map((group) => (
            <div key={group.label} className="font-picker-group">
              <p className="font-picker-group-label">{group.label}</p>
              {group.fonts.map((font) => (
                <button
                  key={`${group.label}-${font}`}
                  type="button"
                  role="option"
                  data-family={font}
                  aria-selected={font === value}
                  className={font === value ? 'font-picker-option active' : 'font-picker-option'}
                  style={{ fontFamily: font }}
                  title={font}
                  onClick={() => selectFont(font)}
                >
                  {font}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
