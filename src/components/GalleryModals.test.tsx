/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FilterGalleryModal } from './FilterGalleryModal'
import { TextureGalleryModal } from './TextureGalleryModal'

// Stand-in for the editor's global shortcut handler (App.tsx listens on window).
const editorKeydown = vi.fn()

beforeEach(() => {
  editorKeydown.mockReset()
  window.addEventListener('keydown', editorKeydown)
})

afterEach(() => {
  window.removeEventListener('keydown', editorKeydown)
  cleanup()
})

describe('FilterGalleryModal keyboard', () => {
  it('closes on Escape without the key reaching editor shortcuts', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<FilterGalleryModal open source={null} selectedIsImage={false} onApply={vi.fn()} onClose={onClose} />)

    const dialog = screen.getByRole('dialog', { name: 'Filter Gallery' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(dialog)

    await user.keyboard('{Backspace}{ArrowRight}t')
    expect(editorKeydown).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(editorKeydown).not.toHaveBeenCalled()
  })
})

describe('TextureGalleryModal', () => {
  it('keeps editor shortcuts inert and closes on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<TextureGalleryModal open onPlace={vi.fn()} onClose={onClose} />)

    expect(screen.getByRole('dialog', { name: 'Texture Gallery' }).getAttribute('aria-modal')).toBe('true')
    await user.keyboard('{Backspace}{Delete}')
    expect(editorKeydown).not.toHaveBeenCalled()

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(editorKeydown).not.toHaveBeenCalled()
  })

  it('closes only after the texture is placed', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onPlace = vi.fn().mockResolvedValue(undefined)
    render(<TextureGalleryModal open onPlace={onPlace} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Place texture' }))
    expect(onPlace).toHaveBeenCalledTimes(1)
    expect(onPlace.mock.calls[0]?.[0]).toMatchObject({ blend: expect.any(String), fit: 'cover' })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('stays open and explains when the texture file fails to load', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onPlace = vi.fn().mockRejectedValue(new Error('fabric: Error loading'))
    render(<TextureGalleryModal open onPlace={onPlace} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Place texture' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Couldn’t load'))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Texture Gallery' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Place texture' })).toHaveProperty('disabled', true)
    expect(screen.getByText(/Full-resolution file isn’t installed/)).toBeTruthy()
  })

  it('disables placing when the full-resolution preview is missing', () => {
    render(<TextureGalleryModal open onPlace={vi.fn()} onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog', { name: 'Texture Gallery' })
    const preview = dialog.querySelector('.texture-gallery-preview img')
    expect(preview).not.toBeNull()
    fireEvent.error(preview!)

    expect(screen.getByText(/Full-resolution file isn’t installed/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Place texture' })).toHaveProperty('disabled', true)
  })
})
