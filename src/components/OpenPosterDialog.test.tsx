/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyPosterPreset } from '../lib/editorModel'
import type { StoredProject } from '../lib/storage'
import { OpenPosterDialog } from './OpenPosterDialog'

function project(partial: Partial<StoredProject> & Pick<StoredProject, 'id' | 'name'>): StoredProject {
  return {
    savedAt: '2026-09-11T12:00:00.000Z',
    preset: applyPosterPreset('a3'),
    canvas: {},
    ...partial,
  }
}

afterEach(() => cleanup())

describe('OpenPosterDialog', () => {
  it('opens a saved poster from the Open action list', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const saved = project({ id: 'p1', name: 'Night bus', thumbnail: 'data:image/jpeg;base64,abc' })
    render(<OpenPosterDialog open projects={[saved]} onOpen={onOpen} onClose={vi.fn()} />)

    const card = screen.getByRole('button', { name: 'Open Night bus' })
    expect(card.querySelector('img')).toBeTruthy()
    await user.click(card)
    expect(onOpen).toHaveBeenCalledWith(saved)
  })

  it('shows an empty studio when there is nothing to open', () => {
    render(<OpenPosterDialog open projects={[]} onOpen={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('No saved posters yet.')).toBeTruthy()
  })

  it('surfaces a storage error', () => {
    render(<OpenPosterDialog open storageError projects={[]} onOpen={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('alert')).toBeTruthy()
  })
})
