/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup as unmount, fireEvent, render, screen } from '@testing-library/react'
import { CanvasContextMenu, type ContextMenuItem } from './CanvasContextMenu'

function setup(items?: ContextMenuItem[]) {
  const onClose = vi.fn()
  const run = vi.fn()
  const onWindowKey = vi.fn()
  window.addEventListener('keydown', onWindowKey)
  render(
    <CanvasContextMenu
      x={10}
      y={10}
      onClose={onClose}
      items={
        items ?? [
          { label: 'Copy', shortcut: 'Ctrl+C', run },
          { label: 'Paste', disabled: true, run: vi.fn() },
          { separator: true },
          { label: 'Delete', run: vi.fn() },
        ]
      }
    />,
  )
  return { onClose, run, onWindowKey, cleanup: () => window.removeEventListener('keydown', onWindowKey) }
}

afterEach(unmount)

describe('CanvasContextMenu', () => {
  it('exposes menu semantics and focuses the first enabled item', () => {
    const { cleanup } = setup()
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.getAllByRole('menuitem')).toHaveLength(3)
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Copy/ }))
    cleanup()
  })

  it('moves with the arrow keys, skipping disabled items, without leaking keys to the editor', () => {
    const { onWindowKey, cleanup } = setup()
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Delete/ }))
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Copy/ }))
    expect(onWindowKey).not.toHaveBeenCalled()
    cleanup()
  })

  it('closes on Escape and on outside press, and runs an item after closing', () => {
    const { onClose, run, cleanup } = setup()
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.pointerDown(document.body)
    expect(onClose).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('menuitem', { name: /Copy/ }))
    expect(onClose).toHaveBeenCalledTimes(3)
    expect(run).toHaveBeenCalledTimes(1)
    cleanup()
  })
})
