/** @vitest-environment jsdom */
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { useAsk } from '../hooks/useAsk'
import { AskDialog } from './AskDialog'

afterEach(() => cleanup())

function harness() {
  let ask!: ReturnType<typeof useAsk>
  function Host() {
    ask = useAsk()
    return <AskDialog request={ask.request} onAnswer={ask.answer} />
  }
  render(<Host />)
  return () => ask
}

describe('AskDialog', () => {
  it('asks for a name and returns it trimmed', async () => {
    const user = userEvent.setup()
    const ask = harness()
    let result: Promise<string | null> = Promise.resolve(null)
    act(() => {
      result = ask().askText({ title: 'Save as gesture', label: 'Gesture name', defaultValue: 'Scatter', submitLabel: 'Save gesture' })
    })
    const field = screen.getByRole('textbox', { name: 'Gesture name' })
    expect(document.activeElement).toBe(field)
    await user.clear(field)
    await user.type(field, '  Late night  {Enter}')
    await expect(result).resolves.toBe('Late night')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('will not submit an empty name, and Escape cancels', async () => {
    const user = userEvent.setup()
    const ask = harness()
    let result: Promise<string | null> = Promise.resolve('unset')
    act(() => {
      result = ask().askText({ title: 'Rename comp', label: 'Name', defaultValue: 'Comp 1', submitLabel: 'Rename' })
    })
    await user.clear(screen.getByRole('textbox', { name: 'Name' }))
    expect((screen.getByRole('button', { name: 'Rename' }) as HTMLButtonElement).disabled).toBe(true)
    await user.keyboard('{Escape}')
    await expect(result).resolves.toBeNull()
  })

  it('starts a destructive question on Cancel', async () => {
    const user = userEvent.setup()
    const ask = harness()
    let result: Promise<boolean> = Promise.resolve(true)
    act(() => {
      result = ask().askConfirm({ title: 'Delete saved poster?', body: 'Gone for good.', confirmLabel: 'Delete', destructive: true })
    })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
    await user.keyboard('{Enter}')
    await expect(result).resolves.toBe(false)
  })

  it('confirms when the person picks the action', async () => {
    const user = userEvent.setup()
    const ask = harness()
    let result: Promise<boolean> = Promise.resolve(false)
    act(() => {
      result = ask().askConfirm({ title: 'Replace saved poster?', body: 'Saving replaces it.', confirmLabel: 'Replace', destructive: true })
    })
    await user.click(screen.getByRole('button', { name: 'Replace' }))
    await expect(result).resolves.toBe(true)
  })

  it('settles an unanswered question as cancelled when a new one replaces it', async () => {
    const ask = harness()
    let first: Promise<string | null> = Promise.resolve('unset')
    act(() => {
      first = ask().askText({ title: 'First', label: 'Name' })
    })
    act(() => {
      void ask().askText({ title: 'Second', label: 'Name' })
    })
    await expect(first).resolves.toBeNull()
    expect(screen.getByRole('dialog', { name: 'Second' })).toBeTruthy()
  })
})
