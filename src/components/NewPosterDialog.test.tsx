/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NewPosterDialog } from './NewPosterDialog'

afterEach(() => cleanup())

describe('NewPosterDialog', () => {
  it('creates a new file at the chosen size instead of resizing the open canvas', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    render(<NewPosterDialog open onCreate={onCreate} onClose={vi.fn()} />)

    expect(screen.getByRole('dialog', { name: 'New poster' })).toBeTruthy()
    await user.click(screen.getByRole('option', { name: /Instagram portrait/ }))
    await user.click(screen.getByRole('button', { name: 'Create poster' }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ id: 'instagram', width: 1080, height: 1350 }))
  })

  it('accepts a custom size', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    render(<NewPosterDialog open onCreate={onCreate} onClose={vi.fn()} />)

    await user.click(screen.getByRole('option', { name: /Custom/ }))
    await user.clear(screen.getByRole('spinbutton', { name: 'Custom width' }))
    await user.type(screen.getByRole('spinbutton', { name: 'Custom width' }), '900')
    await user.clear(screen.getByRole('spinbutton', { name: 'Custom height' }))
    await user.type(screen.getByRole('spinbutton', { name: 'Custom height' }), '1100')
    await user.click(screen.getByRole('button', { name: 'Create poster' }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ id: 'custom', width: 900, height: 1100 }))
  })
})
