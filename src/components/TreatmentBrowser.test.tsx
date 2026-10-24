/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TreatmentBrowser, type TreatmentBrowserProps } from './TreatmentBrowser'

afterEach(() => cleanup())
beforeEach(() => localStorage.clear())

function setup(overrides: Partial<TreatmentBrowserProps> = {}) {
  const props: TreatmentBrowserProps = {
    context: { hasSelection: true, selectionIsText: true, selectionIsImage: false, layerCount: 12 },
    settings: { typeLegibility: 'medium', typeIntensity: 60, xeroxGeneration: 5, decayAmount: 55, accidentIntensity: 60 },
    onSettingChange: vi.fn(),
    onSettingCommit: vi.fn(),
    pressCheckActive: false,
    trialId: null,
    runningId: null,
    onTry: vi.fn(),
    onOpenFilter: vi.fn(),
    appliedCount: 0,
    onShowApplied: vi.fn(),
    recording: false,
    performanceLabel: 'Record a chain of plays',
    canSavePerformance: false,
    onToggleRecording: vi.fn(),
    onSavePerformance: vi.fn(),
    onClearPerformance: vi.fn(),
    savedInstruments: [],
    savedGestures: [],
    onApplySavedInstrument: vi.fn(),
    onApplySavedGesture: vi.fn(),
    ...overrides,
  }
  render(<TreatmentBrowser {...props} />)
  return props
}

const browser = () => screen.getByRole('complementary', { name: 'Treatments browser' })

describe('TreatmentBrowser', () => {
  it('tries a treatment when its tile is clicked', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.click(within(browser()).getByRole('button', { name: 'Scatter' }))
    expect(props.onTry).toHaveBeenCalledWith('scatter')
  })

  it('shows each tile on the sample poster, and says which ones change the whole poster', () => {
    setup()
    const scatter = within(browser()).getByRole('button', { name: 'Scatter' })
    expect(scatter.querySelector('img')?.getAttribute('src')).toBe('treatment-samples/scatter.webp')
    expect(within(browser()).getByRole('button', { name: 'Scramble, whole poster' })).toBeTruthy()
  })

  it('disables tiles that need a selection, with the reason in the tooltip', () => {
    setup({ context: { hasSelection: false, selectionIsText: false, selectionIsImage: false, layerCount: 12 } })
    const tear = within(browser()).getByRole('button', { name: 'Tear collage' }) as HTMLButtonElement
    expect(tear.disabled).toBe(true)
    expect(tear.title).toMatch(/Select a layer first/)
    expect((within(browser()).getByRole('button', { name: 'Scramble, whole poster' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('filters tiles as you search, and finds filter-gallery filters too', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.type(screen.getByRole('searchbox', { name: 'Search treatments' }), 'blur')
    const filters = screen.getByRole('region', { name: 'Filters' })
    const motion = within(filters).getAllByRole('button').find((button) => button.textContent?.includes('Motion blur'))
    expect(motion).toBeTruthy()
    await user.click(motion!)
    expect(props.onOpenFilter).toHaveBeenCalledWith(expect.stringMatching(/blur/))
    expect(within(browser()).queryByRole('button', { name: 'Scatter' })).toBeNull()
  })

  it('says when nothing matches, and Escape clears the search', async () => {
    const user = userEvent.setup()
    setup()
    const search = screen.getByRole('searchbox', { name: 'Search treatments' })
    await user.type(search, 'zzzz')
    expect(screen.getByText('No treatments match “zzzz”.')).toBeTruthy()
    await user.keyboard('{Escape}')
    expect((search as HTMLInputElement).value).toBe('')
  })

  it('folds a category and remembers it', async () => {
    const user = userEvent.setup()
    setup()
    const toggle = screen.getByRole('button', { name: 'Decay' })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    await user.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(within(browser()).queryByRole('button', { name: 'Ink loss' })).toBeNull()
    cleanup()
    setup()
    expect(screen.getByRole('button', { name: 'Decay' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('marks the treatment on trial', () => {
    setup({ trialId: 'ink-loss' })
    expect(within(browser()).getByRole('button', { name: 'Ink loss' }).getAttribute('aria-current')).toBe('true')
  })

  it('names its sliders apart', () => {
    setup()
    expect(screen.getByRole('slider', { name: 'Type intensity' })).toBeTruthy()
    expect(screen.getByRole('slider', { name: 'Accident intensity' })).toBeTruthy()
  })

  it('links to the treatments already on the layer', async () => {
    const user = userEvent.setup()
    const props = setup({ appliedCount: 2 })
    await user.click(screen.getByRole('button', { name: '2 applied to this layer · Edit' }))
    expect(props.onShowApplied).toHaveBeenCalled()
  })
})
