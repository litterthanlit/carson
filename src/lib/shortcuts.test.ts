/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import {
  SHORTCUTS,
  ariaKeyShortcuts,
  formatChord,
  isInControl,
  isTextEntry,
  matchShortcut,
  parseChord,
  shortcutSheet,
  withShortcut,
  type KeyLike,
  type ShortcutContext,
  type ShortcutDef,
} from './shortcuts'

const editor: ShortcutContext = {
  screen: 'editor',
  typing: null,
  inControl: false,
  canvasFocused: false,
  hasPixelSelection: false,
  tool: 'move',
}

function key(keyName: string, modifiers: Partial<Omit<KeyLike, 'key'>> = {}): KeyLike {
  return { key: keyName, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...modifiers }
}

const mod = { metaKey: true }

describe('matchShortcut', () => {
  it('runs undo and redo on the poster', () => {
    expect(matchShortcut(key('z', mod), editor)?.id).toBe('undo')
    expect(matchShortcut(key('Z', { ...mod, shiftKey: true }), editor)?.id).toBe('redo')
    expect(matchShortcut(key('y', { ctrlKey: true }), editor)?.id).toBe('redo')
  })

  it('leaves ⌘Z to a text field so it undoes the typing, not the poster', () => {
    expect(matchShortcut(key('z', mod), { ...editor, typing: 'field' })).toBeNull()
    expect(matchShortcut(key('d', mod), { ...editor, typing: 'field' })).toBeNull()
    expect(matchShortcut(key('b', mod), { ...editor, typing: 'field' })).toBeNull()
  })

  it('keeps poster undo while editing canvas text in place', () => {
    expect(matchShortcut(key('z', mod), { ...editor, typing: 'canvas-text' })?.id).toBe('undo')
    expect(matchShortcut(key('g', mod), { ...editor, typing: 'canvas-text' })).toBeNull()
  })

  it('still saves, exports, zooms and opens commands from a text field', () => {
    const typing = { ...editor, typing: 'field' as const }
    expect(matchShortcut(key('s', mod), typing)?.id).toBe('save')
    expect(matchShortcut(key('e', mod), typing)?.id).toBe('export')
    expect(matchShortcut(key('0', mod), typing)?.id).toBe('zoomFit')
    expect(matchShortcut(key('k', mod), typing)?.id).toBe('commandPalette')
  })

  it('keeps single-key tools away from sliders, selects and text fields', () => {
    expect(matchShortcut(key('v'), editor)?.id).toBe('moveTool')
    expect(matchShortcut(key('v'), { ...editor, inControl: true })).toBeNull()
    expect(matchShortcut(key('v'), { ...editor, typing: 'field', inControl: true })).toBeNull()
    expect(matchShortcut(key('v'), { ...editor, typing: 'canvas-text' })).toBeNull()
  })

  it('binds B to the brush and Shift+R to scramble', () => {
    expect(matchShortcut(key('b'), editor)?.id).toBe('brushTool')
    expect(matchShortcut(key('r'), editor)?.id).toBe('reroll')
    expect(matchShortcut(key('R', { shiftKey: true }), editor)?.id).toBe('scramble')
    expect(matchShortcut(key('V', { shiftKey: true }), editor)).toBeNull()
  })

  it('matches punctuation whether or not Shift made the character', () => {
    expect(matchShortcut(key('=', mod), editor)?.id).toBe('zoomIn')
    expect(matchShortcut(key('+', { ...mod, shiftKey: true }), editor)?.id).toBe('zoomIn')
    expect(matchShortcut(key('-', mod), editor)?.id).toBe('zoomOut')
  })

  it('applies context conditions', () => {
    expect(matchShortcut(key('Tab'), editor)).toBeNull()
    expect(matchShortcut(key('Tab'), { ...editor, canvasFocused: true })?.id).toBe('cycleLayers')
    expect(matchShortcut(key('Tab', { shiftKey: true }), { ...editor, canvasFocused: true })?.id).toBe('cycleLayersBack')
    expect(matchShortcut(key('j', mod), editor)).toBeNull()
    expect(matchShortcut(key('j', mod), { ...editor, hasPixelSelection: true })?.id).toBe('selectionViaCopy')
    expect(matchShortcut(key('['), editor)).toBeNull()
    expect(matchShortcut(key('['), { ...editor, tool: 'mask' })?.id).toBe('brushSmaller')
    expect(matchShortcut(key(']'), { ...editor, tool: 'brush' })?.id).toBe('brushLarger')
  })

  it('separates arrow nudges from Shift nudges', () => {
    expect(matchShortcut(key('ArrowLeft'), editor)?.id).toBe('nudge')
    expect(matchShortcut(key('ArrowDown', { shiftKey: true }), editor)?.id).toBe('nudgeFar')
  })

  it('only runs app-wide shortcuts on Home', () => {
    const home = { ...editor, screen: 'home' as const }
    expect(matchShortcut(key('k', mod), home)?.id).toBe('commandPalette')
    expect(matchShortcut(key('n', mod), home)?.id).toBe('newPoster')
    expect(matchShortcut(key('z', mod), home)).toBeNull()
    expect(matchShortcut(key('v'), home)).toBeNull()
  })

  it('never fires on Alt combinations it does not declare', () => {
    expect(matchShortcut(key('r', { altKey: true }), editor)).toBeNull()
  })
})

describe('registry', () => {
  const table = SHORTCUTS as readonly ShortcutDef[]

  it('has unique ids', () => {
    expect(new Set(table.map((shortcut) => shortcut.id)).size).toBe(table.length)
  })

  it('never binds one chord to two unconditional shortcuts', () => {
    const seen = new Map<string, string>()
    for (const shortcut of table) {
      if (shortcut.gesture || shortcut.when) continue
      for (const chord of shortcut.keys) {
        const parsed = parseChord(chord)
        const scopes = shortcut.scope === 'app' ? ['home', 'editor'] : ['editor']
        for (const scope of scopes) {
          const signature = `${scope}:${parsed.mod}:${parsed.shift}:${parsed.alt}:${parsed.key.toLowerCase()}`
          expect(seen.get(signature), `${chord} is bound to ${seen.get(signature)} and ${shortcut.id}`).toBeUndefined()
          seen.set(signature, shortcut.id)
        }
      }
    }
  })

  it('every listed chord reaches its own shortcut', () => {
    const everything: ShortcutContext = { ...editor, canvasFocused: true, hasPixelSelection: true, tool: 'brush' }
    for (const shortcut of table) {
      if (shortcut.gesture) continue
      for (const chord of shortcut.keys) {
        const parsed = parseChord(chord)
        const event = key(parsed.key, { metaKey: parsed.mod, shiftKey: parsed.shift, altKey: parsed.alt })
        expect(matchShortcut(event, everything)?.id, chord).toBe(shortcut.id)
      }
    }
  })
})

describe('display', () => {
  it('formats for Apple platforms', () => {
    expect(formatChord('Mod+Shift+Z', true)).toBe('⇧⌘Z')
    expect(formatChord('Mod+K', true)).toBe('⌘K')
    expect(formatChord('Shift+R', true)).toBe('⇧R')
    expect(formatChord('Mod++', true)).toBe('⌘+')
    expect(formatChord('Escape', true)).toBe('Esc')
    expect(formatChord('Space+Drag', true)).toBe('Space+Drag')
    expect(formatChord('Mod+Drag', true)).toBe('⌘ Drag')
  })

  it('formats for everyone else', () => {
    expect(formatChord('Mod+Shift+Z', false)).toBe('Ctrl+Shift+Z')
    expect(formatChord('Mod+=', false)).toBe('Ctrl+=')
    expect(formatChord('Delete', false)).toBe('Delete')
    expect(formatChord('ArrowLeft', false)).toBe('←')
  })

  it('writes titles and aria-keyshortcuts from the registry', () => {
    expect(withShortcut('Undo', 'undo', true)).toBe('Undo (⌘Z)')
    expect(withShortcut('Undo', 'undo', false)).toBe('Undo (Ctrl+Z)')
    expect(ariaKeyShortcuts('redo', true)).toBe('Meta+Shift+Z Meta+Y')
    expect(ariaKeyShortcuts('zoomIn', false)).toBe('Control+=')
    expect(ariaKeyShortcuts('pan', true)).toBeUndefined()
  })

  it('builds a grouped sheet', () => {
    const sheet = shortcutSheet(true)
    const tools = sheet.find((section) => section.group === 'Tools')
    expect(tools?.rows.find((row) => row.id === 'brushTool')).toMatchObject({ label: 'Brush', keys: ['B'] })
    const edit = sheet.find((section) => section.group === 'Edit')
    expect(edit?.rows.find((row) => row.id === 'nudge')?.keys).toEqual(['Arrows'])
    expect(edit?.rows.find((row) => row.id === 'delete')?.keys).toEqual(['⌫', '⌫'])
  })
})

describe('focus classification', () => {
  it('tells typing apart from other controls', () => {
    document.body.innerHTML = `
      <input id="text" type="text" />
      <input id="range" type="range" />
      <textarea id="area"></textarea>
      <select id="select"><option>a</option></select>
      <div id="plain"></div>
    `
    const byId = (id: string) => document.getElementById(id)
    expect(isTextEntry(byId('text'))).toBe(true)
    expect(isTextEntry(byId('area'))).toBe(true)
    expect(isTextEntry(byId('range'))).toBe(false)
    expect(isTextEntry(byId('select'))).toBe(false)
    expect(isTextEntry(byId('plain'))).toBe(false)
    expect(isInControl(byId('range'))).toBe(true)
    expect(isInControl(byId('select'))).toBe(true)
    expect(isInControl(byId('plain'))).toBe(false)
  })
})
