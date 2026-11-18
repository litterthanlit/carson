import type { Keymap } from './commands'

/**
 * Which keys run which command. Data only: a different preset is another
 * object of this shape. Ids are command ids from the registry in App.tsx.
 *
 * Shortcuts that work in text fields and text layers are marked `whileTyping`;
 * the three that also work on the home screen are marked `anyScreen`.
 */
export const DEFAULT_KEYMAP: Keymap = {
  // File
  'new-poster': [{ key: 'n', mod: true, whileTyping: true, anyScreen: true }],
  'open-poster': [{ key: 'o', mod: true, whileTyping: true, anyScreen: true }],
  save: [{ key: 's', mod: true, whileTyping: true }],
  'save-as': [{ key: 's', mod: true, shift: true, whileTyping: true }],
  export: [{ key: 'e', mod: true, whileTyping: true }],
  'command-palette': [{ key: 'k', mod: true, whileTyping: true, anyScreen: true }],

  // Edit
  undo: [{ key: 'z', mod: true, whileTyping: true }],
  redo: [
    { key: 'z', mod: true, shift: true, whileTyping: true },
    { key: 'y', mod: true, whileTyping: true },
  ],
  'copy-layer': [{ key: 'c', mod: true }],
  'cut-layer': [{ key: 'x', mod: true }],
  'paste-layer': [{ key: 'v', mod: true, displayOnly: true }],
  'select-all': [{ key: 'a', mod: true }],
  'selection-via-copy': [{ key: 'j', mod: true, whileTyping: true }],
  'selection-via-cut': [{ key: 'j', mod: true, shift: true, whileTyping: true }],
  'selection-invert': [{ key: 'i', mod: true, shift: true, whileTyping: true }],
  'selection-mask-out': [{ key: 'Delete' }, { key: 'Backspace' }],
  'selection-clear': [{ key: 'Escape' }],
  'duplicate-layer': [
    { key: 'j', mod: true },
    { key: 'd', mod: true },
  ],
  'delete-layer': [{ key: 'Delete' }, { key: 'Backspace' }],
  deselect: [{ key: 'Escape' }],

  // Layer
  'bring-forward': [{ code: 'BracketRight', mod: true }],
  'send-backward': [{ code: 'BracketLeft', mod: true }],
  'bring-front': [{ code: 'BracketRight', mod: true, shift: true }],
  'send-back': [{ code: 'BracketLeft', mod: true, shift: true }],
  'group-layers': [{ key: 'g', mod: true }],
  'ungroup-layers': [{ key: 'g', mod: true, shift: true }],
  'crop-image': [{ key: 'c' }],

  // Tools
  'move-tool': [{ key: 'v' }],
  'text-tool': [{ key: 't' }],
  'shape-tool': [{ key: 's' }],
  'frame-tool': [{ key: 'f' }],
  'select-tool': [{ key: 'l' }],
  'brush-tool': [{ key: 'b' }],
  'eraser-tool': [{ key: 'e' }],
  'mask-tool': [{ key: 'm' }],
  'pen-tool': [{ key: 'p' }],
  'effects-palette': [{ key: 'i' }],
  'mask-brush-smaller': [{ key: '[' }],
  'mask-brush-larger': [{ key: ']' }],
  'brush-smaller': [{ key: '[' }],
  'brush-larger': [{ key: ']' }],

  // Play
  reroll: [{ key: 'r' }],
  scramble: [{ key: 'r', shift: true }],
  fork: [{ key: 'b', mod: true, whileTyping: true }],
  'comps-gallery': [{ key: 'b', mod: true, shift: true, whileTyping: true }],
  'filter-gallery': [{ key: 'f', mod: true, whileTyping: true }],

  // View
  grid: [{ key: 'g' }],
  'zoom-fit': [{ key: '0', mod: true, whileTyping: true }],
  'zoom-100': [{ key: '1', mod: true, whileTyping: true }],
  'zoom-in': [
    { key: '=', mod: true, whileTyping: true },
    { key: '+', mod: true, shift: 'any', whileTyping: true },
  ],
  'zoom-out': [{ key: '-', mod: true, whileTyping: true }],
}

/** Sections of the shortcut sheet, in reading order. Unbound ids are skipped. */
export const SHORTCUT_SECTIONS: { title: string; ids: string[] }[] = [
  {
    title: 'Tools',
    ids: ['move-tool', 'text-tool', 'shape-tool', 'frame-tool', 'select-tool', 'brush-tool', 'eraser-tool', 'mask-tool', 'pen-tool', 'effects-palette'],
  },
  {
    title: 'Edit',
    ids: ['undo', 'redo', 'copy-layer', 'cut-layer', 'paste-layer', 'duplicate-layer', 'delete-layer', 'select-all'],
  },
  {
    title: 'Layer',
    ids: ['bring-forward', 'send-backward', 'bring-front', 'send-back', 'group-layers', 'ungroup-layers', 'crop-image'],
  },
  {
    title: 'Play',
    ids: ['reroll', 'scramble', 'fork', 'comps-gallery', 'filter-gallery'],
  },
  {
    title: 'View',
    ids: ['grid', 'zoom-fit', 'zoom-100', 'zoom-in', 'zoom-out', 'command-palette'],
  },
  {
    title: 'File',
    ids: ['new-poster', 'open-poster', 'save', 'save-as', 'export'],
  },
]
