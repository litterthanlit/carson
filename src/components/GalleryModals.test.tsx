/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FabricObject } from 'fabric'
import type { FilterPreset } from '../lib/filterGallery'
import { FilterGalleryModal } from './FilterGalleryModal'

type Deferred = { resolve: (url: string) => void; reject: (error: unknown) => void }
const pendingPreviews = new Map<string, Deferred>()

vi.mock('../lib/filterPreview', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/filterPreview')>()
  return {
    ...actual,
    // Thumbnails resolve at once; large previews wait until the test settles them.
    renderFilterPreview: vi.fn((_source: FabricObject, preset: FilterPreset, _params: unknown, size: number) =>
      size < 300
        ? Promise.resolve(`data:thumb/${preset.id}`)
        : new Promise<string>((resolve, reject) => pendingPreviews.set(preset.id, { resolve, reject })),
    ),
  }
})
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

describe('FilterGalleryModal previews', () => {
  it('ignores a slower, older preview that resolves after the current one', async () => {
    pendingPreviews.clear()
    const user = userEvent.setup()
    const source = { id: 'layer-1' } as unknown as FabricObject
    render(<FilterGalleryModal open source={source} selectedIsImage onApply={vi.fn()} onClose={vi.fn()} />)

    await waitFor(() => expect(pendingPreviews.has('gaussian-soft')).toBe(true))
    await user.click(screen.getByRole('option', { name: 'Heavy gaussian' }))
    await waitFor(() => expect(pendingPreviews.has('gaussian-heavy')).toBe(true))

    pendingPreviews.get('gaussian-heavy')!.resolve('data:preview/heavy')
    const preview = await screen.findByRole('img', { name: 'Heavy gaussian preview' })
    expect(preview.getAttribute('src')).toBe('data:preview/heavy')
    expect(screen.queryByText('Updating preview…')).toBeNull()

    // The stale Gaussian render finishes last and must not replace the selection's preview.
    pendingPreviews.get('gaussian-soft')!.resolve('data:preview/soft')
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.getByRole('img', { name: 'Heavy gaussian preview' }).getAttribute('src')).toBe('data:preview/heavy')
  })

  it('fills in thumbnails as each one renders', async () => {
    const source = { id: 'layer-2' } as unknown as FabricObject
    render(<FilterGalleryModal open source={source} selectedIsImage onApply={vi.fn()} onClose={vi.fn()} />)
    const option = screen.getByRole('option', { name: 'Motion blur' })
    await waitFor(() => expect(option.querySelector('img')?.getAttribute('src')).toBe('data:thumb/motion-blur'))
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
