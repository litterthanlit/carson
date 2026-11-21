/** @vitest-environment jsdom */
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup as unmount, fireEvent, render, screen } from '@testing-library/react'
import { ToolRail } from './ToolRail'

afterEach(unmount)

const noop = () => {}

function renderRail(overrides: Partial<Parameters<typeof ToolRail>[0]> = {}) {
  return render(
    <ToolRail
      tool="move"
      penMode={false}
      penKind="bezier"
      fileInputRef={createRef()}
      onToolChange={noop}
      onAddShape={noop}
      onAddEllipse={noop}
      onAddLine={noop}
      onAddStar={noop}
      onTogglePenMode={noop}
      onTogglePencilMode={noop}
      onImageInputChange={noop}
      onClipToShape={noop}
      onWeave={noop}
      onTearEdges={noop}
      onBrushMask={noop}
      onWhiteScrapes={noop}
      selectMode="rect"
      onSelectModeChange={noop}
      brushErase={false}
      onBrushModeChange={noop}
      {...overrides}
    />,
  )
}

describe('ToolRail', () => {
  it('marks submenu tools with corner disclosure carets and keeps direct tools clean', () => {
    renderRail()
    for (const label of ['Shape tool', 'Select tool', 'Brush tool', 'Mask tool']) {
      const btn = screen.getByRole('button', { name: label })
      expect(btn.classList.contains('has-flyout')).toBe(true)
      expect(btn.querySelector('.tool-flyout-caret')).toBeTruthy()
    }
    for (const label of ['Move tool', 'Text tool', 'Frame tool', 'Image tool', 'Effects']) {
      const btn = screen.getByRole('button', { name: label })
      expect(btn.classList.contains('has-flyout')).toBe(false)
      expect(btn.querySelector('.tool-flyout-caret')).toBeNull()
    }
  })

  it('opens the Brush flyout and selects Brush or Eraser', () => {
    const onBrushModeChange = vi.fn()
    const onToolChange = vi.fn()
    renderRail({ onBrushModeChange, onToolChange })

    fireEvent.click(screen.getByRole('button', { name: 'Brush tool' }))
    expect(screen.getByRole('menu', { name: 'Brush tools' })).toBeTruthy()

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Eraser' }))
    expect(onBrushModeChange).toHaveBeenCalledWith(true)
    expect(onToolChange).toHaveBeenCalledWith('brush')
    expect(screen.queryByRole('menu', { name: 'Brush tools' })).toBeNull()
  })
})
