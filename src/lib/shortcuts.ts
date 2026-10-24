/**
 * Keyboard shortcut registry — the one table every shortcut lives in.
 *
 * The editor's key handler dispatches from it, and every place that shows a
 * shortcut (tooltips, the File menu, the command palette, the shortcut sheet)
 * formats it from here, so a label can never drift from the key that runs.
 */

import type { EditorTool } from '../types/editor'

export type ShortcutGroup = 'File' | 'Edit' | 'Selection' | 'View' | 'Tools' | 'Play'

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = ['File', 'Edit', 'Selection', 'View', 'Tools', 'Play']

/** Where keyboard focus is when the key goes down. */
export type TypingContext = 'field' | 'canvas-text' | null

export type ShortcutContext = {
  screen: 'home' | 'editor'
  /** Focus is in a text field, or canvas text is being edited in place. */
  typing: TypingContext
  /** Focus is in any form control or picker (sliders, selects, listboxes). Single-key shortcuts stand down. */
  inControl: boolean
  canvasFocused: boolean
  hasPixelSelection: boolean
  tool: EditorTool
}

export type ShortcutDef = {
  id: string
  label: string
  group: ShortcutGroup
  /** Key chords, e.g. 'Mod+Shift+Z'. Mod is ⌘ on Apple platforms and Ctrl elsewhere. The first chord is the one shown. */
  keys: readonly string[]
  /** Chords shown instead of `keys` where the real list is long (the four arrows). */
  display?: readonly string[]
  /** 'app' works on Home too; the default works only in the editor. */
  scope?: 'app' | 'editor'
  /**
   * Whether the shortcut fires while the user is typing.
   * 'allow' — always (save, export, zoom); 'canvas-text' — only while editing canvas text,
   * never in a form field, so ⌘Z in a text box undoes the text; 'block' (default) — never.
   */
  whileTyping?: 'allow' | 'canvas-text' | 'block'
  when?: (context: ShortcutContext) => boolean
  /** Condition shown beside the shortcut in the sheet. */
  hint?: string
  /** A pointer gesture listed in the sheet but handled by the canvas, not the key handler. */
  gesture?: boolean
  /** Leave the browser's default in place (Escape exits fullscreen, for example). */
  preventDefault?: false
}

const brushTool = (context: ShortcutContext) => context.tool === 'brush' || context.tool === 'mask'

export const SHORTCUTS = [
  // File
  { id: 'newPoster', label: 'New poster', group: 'File', keys: ['Mod+N'], scope: 'app', whileTyping: 'allow' },
  { id: 'openPoster', label: 'Open poster', group: 'File', keys: ['Mod+O'], scope: 'app', whileTyping: 'allow' },
  { id: 'save', label: 'Save', group: 'File', keys: ['Mod+S'], whileTyping: 'allow' },
  { id: 'saveAs', label: 'Save as', group: 'File', keys: ['Mod+Shift+S'], whileTyping: 'allow' },
  { id: 'export', label: 'Export', group: 'File', keys: ['Mod+E'], whileTyping: 'allow' },
  { id: 'commandPalette', label: 'Search every action', group: 'File', keys: ['Mod+K'], scope: 'app', whileTyping: 'allow' },
  { id: 'shortcutSheet', label: 'Keyboard shortcuts', group: 'File', keys: ['?'], scope: 'app' },

  // Edit
  { id: 'undo', label: 'Undo', group: 'Edit', keys: ['Mod+Z'], whileTyping: 'canvas-text' },
  { id: 'redo', label: 'Redo', group: 'Edit', keys: ['Mod+Shift+Z', 'Mod+Y'], whileTyping: 'canvas-text' },
  { id: 'duplicate', label: 'Duplicate layer', group: 'Edit', keys: ['Mod+D'] },
  { id: 'delete', label: 'Delete layer', group: 'Edit', keys: ['Delete', 'Backspace'], hint: 'masks out a pixel selection instead' },
  { id: 'group', label: 'Group layers', group: 'Edit', keys: ['Mod+G'] },
  { id: 'ungroup', label: 'Ungroup', group: 'Edit', keys: ['Mod+Shift+G'] },
  { id: 'cancel', label: 'Cancel or deselect', group: 'Edit', keys: ['Escape'], preventDefault: false },
  { id: 'confirm', label: 'Finish pen path or warp', group: 'Edit', keys: ['Enter'] },
  { id: 'nudge', label: 'Nudge 1 px', group: 'Edit', keys: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'], display: ['Arrows'] },
  {
    id: 'nudgeFar',
    label: 'Nudge 10 px',
    group: 'Edit',
    keys: ['Shift+ArrowLeft', 'Shift+ArrowRight', 'Shift+ArrowUp', 'Shift+ArrowDown'],
    display: ['Shift+Arrows'],
  },
  { id: 'cycleLayers', label: 'Next layer', group: 'Edit', keys: ['Tab'], hint: 'canvas focused', when: (context) => context.canvasFocused },
  { id: 'cycleLayersBack', label: 'Previous layer', group: 'Edit', keys: ['Shift+Tab'], hint: 'canvas focused', when: (context) => context.canvasFocused },
  { id: 'noSnap', label: 'Move without snapping', group: 'Edit', keys: ['Mod+Drag'], gesture: true },
  { id: 'constrain', label: 'Constrain move, scale or rotate', group: 'Edit', keys: ['Shift+Drag'], gesture: true },

  // Selection (pixel marquee and lasso)
  {
    id: 'selectionViaCopy',
    label: 'Layer via copy',
    group: 'Selection',
    keys: ['Mod+J'],
    hint: 'with a pixel selection',
    when: (context) => context.hasPixelSelection,
  },
  {
    id: 'selectionViaCut',
    label: 'Layer via cut',
    group: 'Selection',
    keys: ['Mod+Shift+J'],
    hint: 'with a pixel selection',
    when: (context) => context.hasPixelSelection,
  },
  {
    id: 'selectionInvert',
    label: 'Invert selection',
    group: 'Selection',
    keys: ['Mod+Shift+I'],
    hint: 'with a pixel selection',
    when: (context) => context.hasPixelSelection,
  },

  // View
  { id: 'zoomFit', label: 'Fit poster to view', group: 'View', keys: ['Mod+0'], whileTyping: 'allow' },
  { id: 'zoom100', label: 'Zoom to 100%', group: 'View', keys: ['Mod+1'], whileTyping: 'allow' },
  { id: 'zoomIn', label: 'Zoom in', group: 'View', keys: ['Mod+=', 'Mod++'], whileTyping: 'allow' },
  { id: 'zoomOut', label: 'Zoom out', group: 'View', keys: ['Mod+-'], whileTyping: 'allow' },
  { id: 'toggleLayoutGrid', label: 'Layout grid', group: 'View', keys: ['G'] },
  { id: 'pan', label: 'Pan', group: 'View', keys: ['Space+Drag'], gesture: true },
  { id: 'zoomWheel', label: 'Zoom at the pointer', group: 'View', keys: ['Mod+Scroll'], gesture: true },

  // Tools
  { id: 'moveTool', label: 'Move', group: 'Tools', keys: ['V'] },
  { id: 'textTool', label: 'Text', group: 'Tools', keys: ['T'] },
  { id: 'shapeTool', label: 'Shape', group: 'Tools', keys: ['S'] },
  { id: 'penTool', label: 'Bezier pen', group: 'Tools', keys: ['P'], hint: 'canvas focused', when: (context) => context.canvasFocused },
  { id: 'frameTool', label: 'Frame', group: 'Tools', keys: ['F'] },
  { id: 'selectTool', label: 'Select', group: 'Tools', keys: ['L'] },
  { id: 'brushTool', label: 'Brush', group: 'Tools', keys: ['B'] },
  { id: 'eraserTool', label: 'Eraser', group: 'Tools', keys: ['E'] },
  { id: 'maskTool', label: 'Mask', group: 'Tools', keys: ['M'] },
  { id: 'instrumentsTool', label: 'Instruments', group: 'Tools', keys: ['I'] },
  { id: 'brushSmaller', label: 'Smaller brush', group: 'Tools', keys: ['['], hint: 'brush or mask', when: brushTool },
  { id: 'brushLarger', label: 'Larger brush', group: 'Tools', keys: [']'], hint: 'brush or mask', when: brushTool },
  { id: 'maskReveal', label: 'Reveal instead of conceal', group: 'Tools', keys: ['Alt+Drag'], hint: 'mask tool', gesture: true },

  // Play
  { id: 'reroll', label: 'Re-roll the last accident', group: 'Play', keys: ['R'] },
  { id: 'scramble', label: 'Scramble the layout', group: 'Play', keys: ['Shift+R'] },
  { id: 'forkVariant', label: 'Fork a variant', group: 'Play', keys: ['Mod+B'] },
  { id: 'openCompsGallery', label: 'Comps gallery', group: 'Play', keys: ['Mod+Shift+B'] },
  { id: 'filterGallery', label: 'Filter gallery', group: 'Play', keys: ['Mod+F'] },
] as const satisfies readonly ShortcutDef[]

export type ShortcutId = (typeof SHORTCUTS)[number]['id']

type Gestures = Extract<(typeof SHORTCUTS)[number], { gesture: true }>
/** Shortcuts the key handler runs (gestures are listed for reference only). */
export type KeyShortcutId = Exclude<ShortcutId, Gestures['id']>

const BY_ID = new Map<string, ShortcutDef>(SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]))

export function getShortcut(id: ShortcutId): ShortcutDef {
  const shortcut = BY_ID.get(id)
  if (!shortcut) throw new Error(`Unknown shortcut: ${id}`)
  return shortcut
}

// ---------------------------------------------------------------------------
// Parsing and matching

export type Chord = { mod: boolean; shift: boolean; alt: boolean; key: string }

export function parseChord(chord: string): Chord {
  // Split on '+' separators, keeping a literal '+' key ('Mod++').
  const parts = chord.endsWith('++') ? [...chord.slice(0, -2).split('+'), '+'] : chord.split('+')
  const key = parts[parts.length - 1]
  const modifiers = new Set(parts.slice(0, -1))
  return { mod: modifiers.has('Mod'), shift: modifiers.has('Shift'), alt: modifiers.has('Alt'), key }
}

export type KeyLike = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>

/** Punctuation keys whose character already encodes Shift ('?', '+'), so Shift is not compared. */
function shiftIsInTheCharacter(key: string) {
  return key.length === 1 && !/[a-z0-9]/i.test(key)
}

export function chordMatches(chord: Chord, event: KeyLike) {
  const mod = event.metaKey || event.ctrlKey
  if (chord.mod !== mod || chord.alt !== event.altKey) return false
  if (!shiftIsInTheCharacter(chord.key) && chord.shift !== event.shiftKey) return false
  return event.key.length === 1 ? event.key.toLowerCase() === chord.key.toLowerCase() : event.key === chord.key
}

const PARSED = new Map<string, Chord[]>(SHORTCUTS.map((shortcut) => [shortcut.id, shortcut.keys.map(parseChord)]))

function typingAllows(shortcut: ShortcutDef, chord: Chord, context: ShortcutContext) {
  if (!chord.mod) return !context.typing && !context.inControl
  if (!context.typing) return true
  const rule = shortcut.whileTyping ?? 'block'
  return rule === 'allow' || (rule === 'canvas-text' && context.typing === 'canvas-text')
}

/** The shortcut a key press runs in this context, or null when the key belongs to the page. */
export function matchShortcut(event: KeyLike, context: ShortcutContext, table: readonly ShortcutDef[] = SHORTCUTS): ShortcutDef | null {
  for (const shortcut of table) {
    if (shortcut.gesture) continue
    if (context.screen === 'home' && shortcut.scope !== 'app') continue
    const chords = table === SHORTCUTS ? PARSED.get(shortcut.id) ?? [] : shortcut.keys.map(parseChord)
    const chord = chords.find((candidate) => chordMatches(candidate, event))
    if (!chord) continue
    if (!typingAllows(shortcut, chord, context)) continue
    if (shortcut.when && !shortcut.when(context)) continue
    return shortcut
  }
  return null
}

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number', ''])

/** Is this element a place where keys type characters? */
export function isTextEntry(element: Element | null) {
  if (!element) return false
  const field = element.closest('input, textarea, [contenteditable]:not([contenteditable="false"])')
  if (!field) return false
  if (field instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(field.type)
  return true
}

/** Is this element any form control or picker that owns plain keys (arrows, letters)? */
export function isInControl(element: Element | null) {
  return Boolean(
    element?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="listbox"], .blend-picker, .font-picker'),
  )
}

// ---------------------------------------------------------------------------
// Display

export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent
  return /mac|iphone|ipad|ipod/i.test(platform)
}

const APPLE_MODIFIERS: Record<string, string> = { Alt: '⌥', Shift: '⇧', Mod: '⌘' }
const KEY_NAMES: Record<string, [apple: string, other: string]> = {
  ArrowLeft: ['←', '←'],
  ArrowRight: ['→', '→'],
  ArrowUp: ['↑', '↑'],
  ArrowDown: ['↓', '↓'],
  Escape: ['Esc', 'Esc'],
  Enter: ['↩', 'Enter'],
  Delete: ['⌫', 'Delete'],
  Backspace: ['⌫', 'Backspace'],
  Tab: ['Tab', 'Tab'],
}

/** A chord as people read it: '⇧⌘Z' on a Mac, 'Ctrl+Shift+Z' elsewhere. */
export function formatChord(chord: string, apple = isApplePlatform()): string {
  const parts = chord.endsWith('++') ? [...chord.slice(0, -2).split('+'), '+'] : chord.split('+')
  const key = parts[parts.length - 1]
  const modifiers = parts.slice(0, -1)
  const keyName = KEY_NAMES[key]?.[apple ? 0 : 1] ?? (key.length === 1 ? key.toUpperCase() : key)
  if (apple) {
    // Apple's order is ⌥⇧⌘; words like Space or Drag keep a '+' so they stay readable.
    const order = ['Alt', 'Shift', 'Mod']
    const symbols = order.filter((name) => modifiers.includes(name)).map((name) => APPLE_MODIFIERS[name])
    const words = modifiers.filter((name) => !order.includes(name))
    const prefix = symbols.join('') + words.map((word) => `${word}+`).join('')
    // A word key after a symbol reads better spaced: '⌘ Drag', '⇧ Tab'.
    const gap = keyName.length > 1 && symbols.length > 0 && words.length === 0 ? ' ' : ''
    return `${prefix}${gap}${keyName}`
  }
  const names = modifiers.map((name) => (name === 'Mod' ? 'Ctrl' : name))
  return [...names, keyName].join('+')
}

/** The primary chord for a shortcut, formatted for this platform. */
export function shortcutKeys(id: ShortcutId, apple = isApplePlatform()): string {
  const shortcut = getShortcut(id)
  return formatChord((shortcut.display ?? shortcut.keys)[0], apple)
}

/** 'Undo (⌘Z)' — for title attributes. */
export function withShortcut(text: string, id: ShortcutId, apple = isApplePlatform()): string {
  return `${text} (${shortcutKeys(id, apple)})`
}

/** The aria-keyshortcuts value, e.g. 'Meta+Shift+Z' or 'Control+Shift+Z'. */
export function ariaKeyShortcuts(id: ShortcutId, apple = isApplePlatform()): string | undefined {
  const shortcut = getShortcut(id)
  if (shortcut.gesture) return undefined
  return shortcut.keys
    .filter((chord) => !chord.endsWith('++'))
    .map((chord) =>
      chord
        .split('+')
        .map((part) => (part === 'Mod' ? (apple ? 'Meta' : 'Control') : part))
        .join('+'),
    )
    .join(' ')
}

export type ShortcutSheetRow = { id: string; label: string; keys: string[]; hint?: string }

/** Every shortcut grouped for the reference sheet, formatted for this platform. */
export function shortcutSheet(apple = isApplePlatform()): { group: ShortcutGroup; rows: ShortcutSheetRow[] }[] {
  return SHORTCUT_GROUPS.map((group) => ({
    group,
    rows: (SHORTCUTS as readonly ShortcutDef[])
      .filter((shortcut) => shortcut.group === group)
      .map((shortcut) => ({
        id: shortcut.id,
        label: shortcut.label,
        keys: (shortcut.display ?? shortcut.keys).filter((chord) => !chord.endsWith('++')).map((chord) => formatChord(chord, apple)),
        hint: shortcut.hint,
      })),
  })).filter((section) => section.rows.length > 0)
}
