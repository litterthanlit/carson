/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HomeScreen } from './HomeScreen'
import { applyPosterPreset } from '../lib/editorModel'
import type { StoredProject } from '../lib/storage'

function project(partial: Partial<StoredProject> & Pick<StoredProject, 'id' | 'name'>): StoredProject {
  return {
    savedAt: '2026-09-11T12:00:00.000Z',
    preset: applyPosterPreset('a3'),
    canvas: {},
    ...partial,
  }
}

afterEach(() => cleanup())

describe('HomeScreen', () => {
  it('shows an empty studio with a way into the editor', () => {
    const onStartPoster = vi.fn()
    render(
      <HomeScreen
        loading={false}
        storageError={false}
        projects={[]}
        recovered={undefined}
        onOpenProject={vi.fn()}
        onRecoverSession={vi.fn()}
        onStartPoster={onStartPoster}
      />,
    )

    expect(screen.getByRole('region', { name: 'Home' })).toBeTruthy()
    expect(screen.getByText('No saved posters yet.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Open / })).toBeNull()
  })

  it('renders saved posters as picture cards and opens one', async () => {
    const user = userEvent.setup()
    const onOpenProject = vi.fn()
    const saved = project({
      id: 'p1',
      name: 'Night bus',
      thumbnail: 'data:image/jpeg;base64,abc',
    })

    render(
      <HomeScreen
        loading={false}
        storageError={false}
        projects={[saved]}
        recovered={undefined}
        onOpenProject={onOpenProject}
        onRecoverSession={vi.fn()}
        onStartPoster={vi.fn()}
      />,
    )

    const card = screen.getByRole('button', { name: 'Open Night bus' })
    expect(card.querySelector('img')).toBeTruthy()
    expect(screen.queryByText('No saved posters yet.')).toBeNull()
    await user.click(card)
    expect(onOpenProject).toHaveBeenCalledWith(saved)
  })

  it('surfaces a storage error without hiding the empty start path', () => {
    render(
      <HomeScreen
        loading={false}
        storageError
        projects={[]}
        recovered={undefined}
        onOpenProject={vi.fn()}
        onRecoverSession={vi.fn()}
        onStartPoster={vi.fn()}
      />,
    )

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start a poster' })).toBeTruthy()
  })
})
