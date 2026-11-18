import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export type ContextMenuItem =
  | { separator: true }
  | { label: string; shortcut?: string; disabled?: boolean; run: () => void }

type CanvasContextMenuProps = {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function CanvasContextMenu({ x, y, items, onClose }: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState({ left: x, top: y })

  // Keep the menu inside the viewport once its size is known.
  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const rect = menu.getBoundingClientRect()
    setPosition({
      left: Math.max(4, Math.min(x, window.innerWidth - rect.width - 4)),
      top: Math.max(4, Math.min(y, window.innerHeight - rect.height - 4)),
    })
  }, [x, y, items.length])

  const enabledButtons = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)') ?? [])

  useEffect(() => {
    enabledButtons()[0]?.focus()
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('blur', onClose)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('blur', onClose)
      window.removeEventListener('resize', onClose)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onKeyDown = (event: React.KeyboardEvent) => {
    // The menu owns the keyboard: nothing leaks to the editor's single-key shortcuts.
    event.stopPropagation()
    const buttons = enabledButtons()
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      buttons[(index + 1) % buttons.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      buttons[(index - 1 + buttons.length) % buttons.length]?.focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      buttons[0]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      buttons[buttons.length - 1]?.focus()
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <div
      ref={menuRef}
      className="canvas-context-menu"
      role="menu"
      aria-label="Canvas actions"
      style={position}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item, index) =>
        'separator' in item ? (
          <div key={`sep-${index}`} className="canvas-context-separator" role="separator" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onClose()
              item.run()
            }}
          >
            <span>{item.label}</span>
            {item.shortcut ? <kbd aria-hidden>{item.shortcut}</kbd> : null}
          </button>
        )
      )}
    </div>
  )
}
