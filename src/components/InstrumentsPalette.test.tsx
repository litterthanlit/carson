/** @vitest-environment jsdom */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup as unmount, fireEvent, render, screen, within } from '@testing-library/react'
import { InstrumentsPalette, type InstrumentsPaletteProps } from './InstrumentsPalette'

const noop = () => {}

function baseProps(overrides: Partial<InstrumentsPaletteProps> = {}): Omit<InstrumentsPaletteProps, 'openGroups' | 'onToggleGroup'> {
  return {
    selected: true,
    selectedIsImage: true,
    selectedIsText: true,
    typeLegibility: 'high',
    recording: false,
    performanceLabel: 'Record a chain of plays',
    canSavePerformance: false,
    savedInstruments: [],
    savedGestures: [],
    onToggleRecording: noop,
    onSavePerformance: noop,
    onClearPerformance: noop,
    onApplySavedInstrument: noop,
    onApplySavedGesture: noop,
    typeIntensity: 50,
    xeroxGeneration: 3,
    accidentIntensity: 50,
    decayAmount: 50,
    layerCount: 3,
    onSliceHorizontal: noop,
    onSliceVertical: noop,
    onScatter: noop,
    onScramble: noop,
    onApplyPosterStyle: noop,
    onTypeLegibilityChange: noop,
    onTypeIntensityChange: noop,
    onTypeIntensityCommit: noop,
    onXeroxGenerationChange: noop,
    onXeroxGenerationCommit: noop,
    onAccidentIntensityChange: noop,
    onAccidentIntensityCommit: noop,
    onDecayAmountChange: noop,
    onDecayAmountCommit: noop,
    onAddTypeStrip: noop,
    onDistressSelected: noop,
    onAddPhotocopyNoise: noop,
    onTearCollage: noop,
    onAddCropMarks: noop,
    onBreakSelectedType: noop,
    onLetterBreak: noop,
    onCloneTypeAsTexture: noop,
    onApplyXerox: noop,
    onApplyCopyMachine: noop,
    onApplyInkBleed: noop,
    onApplyCopyMachineToPoster: noop,
    onApplyCopyScatterCopyGesture: noop,
    onAddMisprintDuplicate: noop,
    onAddPrintScanSurface: noop,
    onApplyLayerDecay: noop,
    onAddLayerDecayMarks: noop,
    onAddLayerDecayOffset: noop,
    onDuplicateDriftAccident: noop,
    onBadCropAccident: noop,
    onFlipMistakeAccident: noop,
    onCollideSelectionAccident: noop,
    onNudgeLayoutAccident: noop,
    onApplyColdWashImage: noop,
    onAddDiagonalTexture: noop,
    onAddWhiteScrapes: noop,
    pressCheckActive: false,
    onTogglePressCheck: noop,
    onAddRedEchoType: noop,
    onAggressiveCrop: noop,
    onCropToPosterEdge: noop,
    onOpenFilterGallery: noop,
    onOpenTextureGallery: noop,
    ...overrides,
  }
}

function Harness(props: Partial<InstrumentsPaletteProps>) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set())
  return (
    <InstrumentsPalette
      {...baseProps(props)}
      openGroups={open}
      onToggleGroup={(id) =>
        setOpen((current) => {
          const next = new Set(current)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
        })
      }
    />
  )
}

afterEach(unmount)

describe('InstrumentsPalette', () => {
  it('leads with a labelled search and a Start here set of six', () => {
    render(<Harness />)
    expect(screen.getByRole('searchbox', { name: 'Search effects' })).toBeTruthy()
    const start = screen.getByText('Start here').parentElement as HTMLElement
    const names = within(start)
      .getAllByRole('button')
      .map((button) => button.querySelector('.effect-name')?.textContent)
    expect(names).toEqual(['Scatter', 'Shuffle layout', 'Copy machine', 'Letter break', 'Strips', 'Filters'])
  })

  it('starters call the same handlers as the group buttons', () => {
    const onScatter = vi.fn()
    render(<Harness onScatter={onScatter} />)
    fireEvent.click(screen.getByRole('button', { name: 'Scatter' }))
    expect(onScatter).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: /^Play/ }))
    expect(screen.getAllByRole('button', { name: 'Scatter' })).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('button', { name: 'Scatter' })[1])
    expect(onScatter).toHaveBeenCalledTimes(2)
  })

  it('keeps every section as a collapsed group that shows its count and expands on click', () => {
    render(<Harness />)
    const print = screen.getByRole('button', { name: /^Print/ })
    expect(print.getAttribute('aria-expanded')).toBe('false')
    expect(print.textContent).toContain('9')
    expect(screen.queryByRole('button', { name: 'Ink bleed' })).toBeNull()
    expect(screen.queryByText('Generation')).toBeNull()

    fireEvent.click(print)
    expect(print.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: 'Ink bleed' })).toBeTruthy()
    expect(screen.getAllByText('Generation').length).toBeGreaterThan(0)

    fireEvent.click(print)
    expect(screen.queryByRole('button', { name: 'Ink bleed' })).toBeNull()
  })

  it('keeps Performance below the effect groups, collapsed', () => {
    render(<Harness />)
    const toggles = screen.getAllByRole('button', { expanded: false })
    expect(toggles.at(-1)?.textContent).toContain('Performance')
    expect(screen.queryByRole('button', { name: 'Record gesture' })).toBeNull()
    fireEvent.click(toggles.at(-1) as HTMLElement)
    expect(screen.getByRole('button', { name: 'Record gesture' })).toBeTruthy()
  })

  it('filters every section by name, section or keyword and shows the section as context', () => {
    render(<Harness />)
    const search = screen.getByRole('searchbox', { name: 'Search effects' })
    fireEvent.change(search, { target: { value: 'copy' } })
    const names = screen
      .getAllByRole('button')
      .map((button) => button.querySelector('.effect-name')?.textContent)
      .filter(Boolean)
    expect(names).toEqual(expect.arrayContaining(['Copy machine', 'Run through copier', 'Copy → Scatter → Copy', 'Copy selected']))
    expect(screen.queryByRole('button', { name: 'Scatter' })).toBeNull()
    expect(screen.queryByText('Start here')).toBeNull()
    expect(screen.getAllByText('Print').length).toBeGreaterThan(0)

    fireEvent.change(search, { target: { value: 'scramble' } })
    expect(screen.getByRole('button', { name: 'Shuffle layout' })).toBeTruthy()
  })

  it('shows a clear empty state and Escape clears the search before closing', () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    const search = screen.getByRole('searchbox', { name: 'Search effects' }) as HTMLInputElement
    fireEvent.change(search, { target: { value: 'zzzz' } })
    expect(screen.getByRole('status').textContent).toContain('No effects match “zzzz”')
    fireEvent.keyDown(search, { key: 'Escape' })
    expect(search.value).toBe('')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('Start here')).toBeTruthy()
    fireEvent.keyDown(search, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('explains the SEL and ALL badges and leaves unselected effects disabled', () => {
    render(<Harness selected={false} />)
    expect(screen.getByRole('button', { name: 'Scatter' }).getAttribute('title')).toContain('Applies to the selected layer')
    expect(screen.getByRole('button', { name: 'Shuffle layout' }).getAttribute('title')).toContain('Applies to the whole poster')
    expect((screen.getByRole('button', { name: 'Scatter' }) as HTMLButtonElement).disabled).toBe(true)
    expect(document.querySelector('.scope-badge')?.getAttribute('title')).toBeTruthy()
  })

  it('reaches all 44 effects between the groups', () => {
    render(<Harness />)
    for (const toggle of screen.getAllByRole('button', { expanded: false })) fireEvent.click(toggle)
    const groups = document.querySelectorAll('.effects-group[data-group]:not([data-group="performance"]) .effect-button')
    expect(groups).toHaveLength(44)
  })
})
