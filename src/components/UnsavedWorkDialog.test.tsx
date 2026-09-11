/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UnsavedWorkDialog } from './UnsavedWorkDialog'

afterEach(() => cleanup())

describe('UnsavedWorkDialog', () => {
  it('asks before replacing a dirty file', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onDiscard = vi.fn()
    const onSave = vi.fn()
    render(
      <UnsavedWorkDialog open reason="open" onCancel={onCancel} onDiscard={onDiscard} onSave={onSave} />,
    )

    expect(screen.getByRole('dialog', { name: 'Unsaved changes' })).toBeTruthy()
    expect(screen.getByText(/Opening another poster will replace/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: "Don't save" }))
    expect(onDiscard).toHaveBeenCalled()
  })
})
