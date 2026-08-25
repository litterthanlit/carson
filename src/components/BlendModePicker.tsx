import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { BLEND_MODES } from '../lib/editorConstants'
import { blendModeLabel } from '../lib/color'

type BlendModePickerProps = {
  value: string
  onChange: (mode: string) => void
  onPreview: (mode: string | null) => void
}

export function BlendModePicker({ value, onChange, onPreview }: BlendModePickerProps) {
  const [open, setOpen] = useState(false)
  const [activeMode, setActiveMode] = useState(value)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const onPreviewRef = useRef(onPreview)
  const listId = useId()
  onPreviewRef.current = onPreview

  useEffect(() => {
    if (!open) setActiveMode(value)
  }, [open, value])

  useEffect(() => {
    if (!open) return
    menuRef.current?.focus()
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) onPreviewRef.current(null)
  }, [open])

  useEffect(() => {
    return () => onPreviewRef.current(null)
  }, [])

  const selectMode = (mode: string) => {
    onPreview(null)
    onChange(mode)
    setOpen(false)
  }

  const moveActive = (delta: number) => {
    const currentIndex = Math.max(
      0,
      BLEND_MODES.findIndex((mode) => mode.value === activeMode),
    )
    const next = BLEND_MODES[(currentIndex + delta + BLEND_MODES.length) % BLEND_MODES.length]
    if (!next) return
    setActiveMode(next.value)
    onPreview(next.value)
  }

  return (
    <div className="blend-picker" ref={rootRef}>
      <button
        type="button"
        className="font-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        title="Hover a blend mode to preview it on the canvas, then click to apply"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <span className="font-picker-current">{blendModeLabel(value)}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <div
          className="font-picker-menu blend-picker-menu"
          ref={menuRef}
          role="listbox"
          id={listId}
          aria-label="Blend modes"
          aria-activedescendant={`${listId}-${activeMode}`}
          tabIndex={-1}
          onMouseLeave={() => onPreview(null)}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              moveActive(1)
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              moveActive(-1)
            } else if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              selectMode(activeMode)
            } else if (event.key === 'Escape') {
              event.preventDefault()
              setOpen(false)
            }
          }}
        >
          {BLEND_MODES.map((mode) => {
            const selected = mode.value === value
            const active = mode.value === activeMode
            return (
              <button
                key={mode.value}
                type="button"
                id={`${listId}-${mode.value}`}
                role="option"
                aria-selected={selected}
                className={
                  selected ? 'font-picker-option active' : active ? 'font-picker-option previewing' : 'font-picker-option'
                }
                title={`Preview ${mode.label} on the selected layer`}
                onMouseEnter={() => {
                  setActiveMode(mode.value)
                  onPreview(mode.value)
                }}
                onClick={() => selectMode(mode.value)}
              >
                {mode.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
