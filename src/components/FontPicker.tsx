import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { GOOGLE_FONTS } from '../lib/fonts'
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
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listId = useId()

  const groups: FontGroup[] = [
    { label: 'System', fonts: FONT_STACKS },
    { label: 'Google Fonts', fonts: GOOGLE_FONTS.map((font) => font.family) },
  ]
  if (customFonts.length > 0) {
    groups.push({ label: 'Uploaded', fonts: customFonts })
  }

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const selectFont = (family: string) => {
    void onLoadGoogleFont(family).finally(() => {
      onChange(family)
      setOpen(false)
    })
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
        <div className="font-picker-menu" role="listbox" id={listId} aria-label="Fonts">
          {groups.map((group) => (
            <div key={group.label} className="font-picker-group">
              <p className="font-picker-group-label">{group.label}</p>
              {group.fonts.map((font) => (
                <button
                  key={`${group.label}-${font}`}
                  type="button"
                  role="option"
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
