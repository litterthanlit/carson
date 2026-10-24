/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialog'
import { OnboardingModal } from './OnboardingModal'
import { UnsavedWorkDialog } from './UnsavedWorkDialog'
import { CompsGalleryModal } from './CompsGalleryModal'

afterEach(() => cleanup())

describe('Dialog', () => {
  it('is a labelled modal that starts focus on the marked control', () => {
    render(
      <Dialog labelledBy="t" onClose={vi.fn()}>
        <h2 id="t">Rename</h2>
        <input aria-label="Name" />
        <button type="button" data-autofocus>
          Done
        </button>
      </Dialog>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Rename' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Done' }))
  })

  it('closes on Escape and keeps keys away from editor shortcuts', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const windowKeys = vi.fn()
    window.addEventListener('keydown', windowKeys)
    render(
      <Dialog label="Test" onClose={onClose}>
        <input aria-label="Name" data-autofocus />
      </Dialog>,
    )
    await user.keyboard('{Backspace}v')
    expect(windowKeys).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    window.removeEventListener('keydown', windowKeys)
  })

  it('lets a field handle Escape itself without closing twice', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Dialog label="Search" onClose={onClose}>
        <input
          aria-label="Query"
          data-autofocus
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              onClose()
            }
          }}
        />
      </Dialog>,
    )
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('returns focus to whatever opened it', () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const { unmount } = render(
      <Dialog label="Test" onClose={vi.fn()}>
        <button type="button">Inside</button>
      </Dialog>,
    )
    expect(document.activeElement).not.toBe(opener)
    unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
})

describe('dialogs built on Dialog', () => {
  it('Escape on the unsaved-work question cancels rather than discarding', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onDiscard = vi.fn()
    render(<UnsavedWorkDialog open reason="new" onCancel={onCancel} onDiscard={onDiscard} onSave={vi.fn()} />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Save' }))
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalled()
    expect(onDiscard).not.toHaveBeenCalled()
  })

  it('Escape skips the intro', async () => {
    const user = userEvent.setup()
    const onSkip = vi.fn()
    render(<OnboardingModal open onStart={vi.fn()} onSkip={onSkip} />)
    expect(screen.getByRole('dialog', { name: 'Wreck this poster' }).getAttribute('aria-modal')).toBe('true')
    await user.keyboard('{Escape}')
    expect(onSkip).toHaveBeenCalled()
  })

  it('the comps gallery is modal and closes on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <CompsGalleryModal
        open
        variants={[]}
        onRestore={vi.fn()}
        onCompare={vi.fn()}
        onMerge={vi.fn()}
        onRename={vi.fn()}
        onFork={vi.fn()}
        onClose={onClose}
      />,
    )
    expect(screen.getByRole('dialog', { name: 'Comps' }).getAttribute('aria-modal')).toBe('true')
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
