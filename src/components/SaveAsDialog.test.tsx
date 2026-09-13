/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SaveAsDialog } from './SaveAsDialog'

afterEach(() => cleanup())

describe('SaveAsDialog', () => {
  it('saves a named copy instead of overwriting', async () => {
    const user = userEvent.setup()
    const onSaveAs = vi.fn()
    render(
      <SaveAsDialog
        open
        suggestedName="Night bus copy"
        existingNames={['Night bus']}
        onSaveAs={onSaveAs}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Save as' })).toBeTruthy()
    const field = screen.getByRole('textbox', { name: 'Save as name' })
    await user.clear(field)
    await user.type(field, 'Night bus evening')
    await user.click(screen.getByRole('button', { name: 'Save copy' }))
    expect(onSaveAs).toHaveBeenCalledWith('Night bus evening')
  })

  it('blocks a colliding name without a confirm overwrite', async () => {
    const user = userEvent.setup()
    const onSaveAs = vi.fn()
    render(
      <SaveAsDialog
        open
        suggestedName="Night bus copy"
        existingNames={['Night bus']}
        onSaveAs={onSaveAs}
        onClose={vi.fn()}
      />,
    )

    const field = screen.getByRole('textbox', { name: 'Save as name' })
    await user.clear(field)
    await user.type(field, 'Night bus')
    expect(screen.getByRole('alert').textContent).toMatch(/already exists/i)
    expect(screen.getByRole('button', { name: 'Save copy' })).toHaveProperty('disabled', true)
    await user.click(screen.getByRole('button', { name: 'Save copy' }))
    expect(onSaveAs).not.toHaveBeenCalled()
  })

  it('asks for a name when the field is empty', async () => {
    const user = userEvent.setup()
    render(
      <SaveAsDialog open suggestedName="Night bus copy" existingNames={[]} onSaveAs={vi.fn()} onClose={vi.fn()} />,
    )

    await user.clear(screen.getByRole('textbox', { name: 'Save as name' }))
    expect(screen.getByRole('alert').textContent).toMatch(/name this copy/i)
    expect(screen.getByRole('button', { name: 'Save copy' })).toHaveProperty('disabled', true)
  })
})
