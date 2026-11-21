import { describe, expect, it, vi } from 'vitest'
import {
  buildShortcutSheet,
  filterCommands,
  formatShortcut,
  matchesShortcut,
  resolveKeyCommand,
  type CommandAction,
  type Keymap,
} from './commands'
import { DEFAULT_KEYMAP, SHORTCUT_SECTIONS } from './keymap'

const press = (key: string, mods: Partial<Pick<KeyboardEvent, 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'code'>> = {}) => ({
  key,
  code: '',
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
})

const command = (id: string, extra: Partial<CommandAction> = {}): CommandAction => ({
  id,
  label: id,
  keywords: [],
  run: vi.fn(),
  ...extra,
})

const editor = { typing: false, screen: 'editor' as const }

describe('matchesShortcut', () => {
  it('needs the modifier to match exactly, in both directions', () => {
    expect(matchesShortcut(press('v'), { key: 'v' })).toBe(true)
    expect(matchesShortcut(press('v', { metaKey: true }), { key: 'v' })).toBe(false)
    expect(matchesShortcut(press('z'), { key: 'z', mod: true })).toBe(false)
    expect(matchesShortcut(press('z', { ctrlKey: true }), { key: 'z', mod: true })).toBe(true)
  })

  it('tells Shift apart unless the binding says it does not matter', () => {
    expect(matchesShortcut(press('Z', { metaKey: true, shiftKey: true }), { key: 'z', mod: true })).toBe(false)
    expect(matchesShortcut(press('Z', { metaKey: true, shiftKey: true }), { key: 'z', mod: true, shift: true })).toBe(true)
    expect(matchesShortcut(press('+', { metaKey: true, shiftKey: true }), { key: '+', mod: true, shift: 'any' })).toBe(true)
  })

  it('ignores case, so Caps Lock does not break single keys', () => {
    expect(matchesShortcut(press('V'), { key: 'v' })).toBe(true)
  })

  it('matches by physical key when a code is given', () => {
    expect(matchesShortcut(press('}', { metaKey: true, shiftKey: true, code: 'BracketRight' }), { code: 'BracketRight', mod: true, shift: true })).toBe(true)
  })

  it('never fires with Alt held', () => {
    expect(matchesShortcut(press('v', { altKey: true }), { key: 'v' })).toBe(false)
  })
})

describe('resolveKeyCommand', () => {
  const keymap: Keymap = {
    narrow: [{ key: 'Delete' }],
    general: [{ key: 'Delete' }],
    save: [{ key: 's', mod: true, whileTyping: true }],
    open: [{ key: 'o', mod: true, anyScreen: true }],
    paste: [{ key: 'v', mod: true, displayOnly: true }],
  }

  it('takes the first command whose `when` passes', () => {
    let narrowOn = true
    const commands = [command('narrow', { when: () => narrowOn }), command('general')]
    expect(resolveKeyCommand(commands, keymap, press('Delete'), editor)?.id).toBe('narrow')
    narrowOn = false
    expect(resolveKeyCommand(commands, keymap, press('Delete'), editor)?.id).toBe('general')
  })

  it('keeps single keys out of text fields but lets marked shortcuts through', () => {
    const commands = [command('general'), command('save')]
    const typing = { typing: true, screen: 'editor' as const }
    expect(resolveKeyCommand(commands, keymap, press('Delete'), typing)).toBeUndefined()
    expect(resolveKeyCommand(commands, keymap, press('s', { metaKey: true }), typing)?.id).toBe('save')
  })

  it('only runs any-screen shortcuts on the home screen', () => {
    const commands = [command('save'), command('open')]
    const home = { typing: false, screen: 'home' as const }
    expect(resolveKeyCommand(commands, keymap, press('s', { metaKey: true }), home)).toBeUndefined()
    expect(resolveKeyCommand(commands, keymap, press('o', { metaKey: true }), home)?.id).toBe('open')
  })

  it('leaves display-only bindings to whoever handles them', () => {
    expect(resolveKeyCommand([command('paste')], keymap, press('v', { metaKey: true }), editor)).toBeUndefined()
  })

  it('runs a command the palette shows as disabled: commands guard themselves', () => {
    expect(resolveKeyCommand([command('general', { disabled: true })], keymap, press('Delete'), editor)?.id).toBe('general')
  })
})

describe('formatShortcut', () => {
  it('uses symbols on macOS and words elsewhere', () => {
    expect(formatShortcut({ key: 'k', mod: true, shift: true }, true)).toBe('⇧⌘K')
    expect(formatShortcut({ key: 'k', mod: true, shift: true }, false)).toBe('Ctrl+Shift+K')
    expect(formatShortcut({ code: 'BracketRight', mod: true }, false)).toBe('Ctrl+]')
    expect(formatShortcut({ code: 'Backslash', mod: true }, true)).toBe('⌘\\')
    expect(formatShortcut({ code: 'Backslash', mod: true }, false)).toBe('Ctrl+\\')
    expect(formatShortcut({ key: 'Delete' }, true)).toBe('Del')
    expect(formatShortcut({ key: 'v' }, false)).toBe('V')
  })
})

describe('filterCommands', () => {
  it('hides key-only commands from the palette', () => {
    const commands = [command('undo'), command('deselect', { hidden: true })]
    expect(filterCommands(commands, '').map((item) => item.id)).toEqual(['undo'])
    expect(filterCommands(commands, 'deselect')).toEqual([])
  })
})

describe('the default keymap', () => {
  it('lists every sheet entry in the keymap', () => {
    for (const section of SHORTCUT_SECTIONS) {
      for (const id of section.ids) expect(DEFAULT_KEYMAP[id], id).toBeDefined()
    }
  })

  it('gives every binding a key or a code', () => {
    for (const [id, shortcuts] of Object.entries(DEFAULT_KEYMAP)) {
      expect(shortcuts.length, id).toBeGreaterThan(0)
      for (const shortcut of shortcuts) expect(shortcut.key ?? shortcut.code, id).toBeTruthy()
    }
  })

  it('builds the sheet from command labels and skips unknown commands', () => {
    const sheet = buildShortcutSheet([command('undo', { label: 'Undo' })], DEFAULT_KEYMAP, SHORTCUT_SECTIONS, false)
    expect(sheet).toEqual([{ title: 'Edit', items: [{ label: 'Undo', keys: ['Ctrl+Z'] }] }])
  })
})
