/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FabricObject } from 'fabric'
import type { FilterPreset } from '../lib/filterGallery'
import { clearGalleryMemory, missingTextureIds } from '../lib/galleryMemory'
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
  clearGalleryMemory()
  missingTextureIds.clear()
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

describe('Gallery dialog accessibility', () => {
  it('returns focus to the control that opened it', () => {
    const { rerender } = render(<button type="button">Open textures</button>)
    const opener = screen.getByRole('button', { name: 'Open textures' })
    opener.focus()
    rerender(
      <>
        <button type="button">Open textures</button>
        <TextureGalleryModal open onPlace={vi.fn()} onClose={vi.fn()} />
      </>,
    )
    expect(document.activeElement).toBe(screen.getByRole('dialog', { name: 'Texture Gallery' }))
    rerender(<button type="button">Open textures</button>)
    expect(document.activeElement).toBe(opener)
  })

  it('closes on a backdrop click but not on clicks inside the panel', () => {
    const onClose = vi.fn()
    render(<TextureGalleryModal open onPlace={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByRole('heading', { name: 'Texture Gallery' }))
    expect(onClose).not.toHaveBeenCalled()
    // ::backdrop clicks target the dialog element itself, outside its box.
    fireEvent.click(screen.getByRole('dialog', { name: 'Texture Gallery' }), { clientX: -40, clientY: -40 })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('moves through the texture grid with arrow keys, Home and End, one Tab stop', async () => {
    const user = userEvent.setup()
    render(<TextureGalleryModal open onPlace={vi.fn()} onClose={vi.fn()} />)
    const grid = screen.getByRole('listbox', { name: 'Print textures' })
    const options = within(grid).getAllByRole('option')
    expect(options.length).toBeGreaterThan(3)
    expect(options.filter((option) => option.tabIndex === 0)).toHaveLength(1)

    options[0]!.focus()
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(options[1])
    expect(options[1]!.getAttribute('aria-selected')).toBe('true')
    expect(options[1]!.tabIndex).toBe(0)
    expect(options[0]!.tabIndex).toBe(-1)
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(options[1]!.textContent)

    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(options[3])
    await user.keyboard('{End}')
    expect(document.activeElement).toBe(options[options.length - 1])
    await user.keyboard('{Home}')
    expect(document.activeElement).toBe(options[0])
  })

  it('labels categories by their visible names and marks the active one', async () => {
    const user = userEvent.setup()
    const source = { id: 'layer-3' } as unknown as FabricObject
    render(<FilterGalleryModal open source={source} selectedIsImage onApply={vi.fn()} onClose={vi.fn()} />)
    const adjust = screen.getByRole('button', { name: 'Adjust' })
    expect(adjust.getAttribute('aria-pressed')).toBe('false')
    await user.click(adjust)
    expect(adjust.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('listbox', { name: 'Adjust filters' })).toBeTruthy()
  })

  it('keeps image-only filters reachable and explains why they cannot apply', async () => {
    const user = userEvent.setup()
    const source = { id: 'layer-4' } as unknown as FabricObject
    render(<FilterGalleryModal open source={source} selectedIsImage={false} onApply={vi.fn()} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Wash' }))
    const coldWash = screen.getByRole('option', { name: 'Cold wash' })
    expect(coldWash.getAttribute('aria-disabled')).toBe('true')
    expect(coldWash.hasAttribute('disabled')).toBe(false)
    expect(coldWash.getAttribute('aria-describedby')).toBe('filter-gallery-needs-image')

    await user.click(coldWash)
    expect(coldWash.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText(/Select a photo or placed image/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Apply filter' })).toHaveProperty('disabled', true)
  })
})

describe('Gallery memory', () => {
  it('reopens the Filter Gallery on the last category and filter', async () => {
    const user = userEvent.setup()
    const source = { id: 'layer-5' } as unknown as FabricObject
    const first = render(<FilterGalleryModal open source={source} selectedIsImage onApply={vi.fn()} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Stylize' }))
    await user.click(screen.getByRole('option', { name: 'Posterize' }))
    first.unmount()

    render(<FilterGalleryModal open source={source} selectedIsImage onApply={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Stylize' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('option', { name: 'Posterize' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Posterize')
  })

  it('reopens the Texture Gallery on the last texture with its blend', async () => {
    const user = userEvent.setup()
    const first = render(<TextureGalleryModal open onPlace={vi.fn()} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Ink' }))
    const picked = within(screen.getByRole('listbox', { name: 'Ink textures' })).getAllByRole('option')[2]!
    await user.click(picked)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Blend' }), 'screen')
    const pickedName = picked.textContent
    first.unmount()

    render(<TextureGalleryModal open onPlace={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Ink' }).getAttribute('aria-pressed')).toBe('true')
    const selected = within(screen.getByRole('listbox', { name: 'Ink textures' })).getByRole('option', { selected: true })
    expect(selected.textContent).toBe(pickedName)
    expect((screen.getByRole('combobox', { name: 'Blend' }) as HTMLSelectElement).value).toBe('screen')
  })

  it('still switches to a texture’s own defaults when you pick a different one', async () => {
    const user = userEvent.setup()
    render(<TextureGalleryModal open onPlace={vi.fn()} onClose={vi.fn()} />)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Blend' }), 'lighten')
    const options = within(screen.getByRole('listbox')).getAllByRole('option')
    await user.click(options[1]!)
    expect((screen.getByRole('combobox', { name: 'Blend' }) as HTMLSelectElement).value).not.toBe('lighten')
  })
})

