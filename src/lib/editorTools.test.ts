import { describe, expect, it } from 'vitest'
import { cursorForTool, hoverCursorForTool } from './editorTools'

describe('editorTools', () => {
  it('uses grab while panning and crosshair while drawing', () => {
    expect(cursorForTool('move', { pan: true })).toBe('grab')
    expect(cursorForTool('move', { pen: true })).toBe('crosshair')
  })

  it('maps placement tools to text or crosshair', () => {
    expect(cursorForTool('text')).toBe('text')
    expect(cursorForTool('shape')).toBe('crosshair')
    expect(cursorForTool('mask')).toBe('crosshair')
    expect(cursorForTool('move')).toBe('default')
  })

  it('uses move hover on the select tool', () => {
    expect(hoverCursorForTool('move')).toBe('move')
    expect(hoverCursorForTool('text')).toBe('text')
  })
})
