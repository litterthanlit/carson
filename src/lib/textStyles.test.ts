import { describe, expect, it } from 'vitest'
import type { FabricObject } from 'fabric'
import {
  captureCharacterStyleFromText,
  captureParagraphStyleFromText,
  createCharacterStyleFromText,
  createParagraphStyleFromText,
  hasTextSelection,
} from './textStyles'

function mockTextbox(overrides: Record<string, unknown> = {}) {
  const base = {
    type: 'textbox',
    fontFamily: 'Impact',
    fontSize: 80,
    fontWeight: 900,
    fill: '#111111',
    charSpacing: 20,
    lineHeight: 0.9,
    textAlign: 'left',
    fontStyle: 'normal',
    underline: false,
    isEditing: false,
    selectionStart: 0,
    selectionEnd: 0,
    getSelectionStyles: () => [],
    setSelectionStyles: () => undefined,
    set: () => undefined,
    initDimensions: () => undefined,
    setCoords: () => undefined,
    ...overrides,
  }
  return base as unknown as FabricObject
}

describe('textStyles', () => {
  it('captures paragraph style props from a textbox', () => {
    const text = mockTextbox()
    const props = captureParagraphStyleFromText(text)
    expect(props.fontFamily).toBe('Impact')
    expect(props.fontSize).toBe(80)
    expect(props.lineHeight).toBe(0.9)
  })

  it('creates named paragraph and character style definitions', () => {
    const text = mockTextbox({ fontFamily: 'Georgia', fontSize: 64 })
    const paragraph = createParagraphStyleFromText('Body', text)
    const character = createCharacterStyleFromText('Accent', text)

    expect(paragraph.name).toBe('Body')
    expect(paragraph.props.fontFamily).toBe('Georgia')
    expect(character.name).toBe('Accent')
    expect(character.props.fontSize).toBe(64)
  })

  it('detects active character selections', () => {
    expect(hasTextSelection(null)).toBe(false)
    expect(hasTextSelection({ start: 0, end: 0 })).toBe(false)
    expect(hasTextSelection({ start: 1, end: 4 })).toBe(true)
  })

  it('captures character style props from a mocked selection', () => {
    const text = mockTextbox({
      isEditing: true,
      selectionStart: 0,
      selectionEnd: 3,
      getSelectionStyles: () => [{ fill: '#e11d48', fontWeight: 900, fontFamily: 'Impact', fontSize: 80 }],
    })

    const props = captureCharacterStyleFromText(text, { start: 0, end: 3 })
    expect(props.fill).toBe('#e11d48')
    expect(props.fontWeight).toBe(900)
  })
})
