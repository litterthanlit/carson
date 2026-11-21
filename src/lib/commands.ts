/**
 * The command registry. One list of commands feeds the command palette, the
 * keyboard, the canvas context menu, the shortcut sheet and the agent bridge.
 * Which keys run which command is data, in `keymap.ts`.
 */

export type CommandAction = {
  id: string
  label: string
  keywords: string[]
  scope?: 'selection' | 'canvas' | 'any'
  disabled?: boolean
  /** Keyboard only: the command's keys do nothing unless this returns true. */
  when?: () => boolean
  /** Reachable by key but left out of the palette and the agent's command list. */
  hidden?: boolean
  /** Resolves when the action has landed, so an agent can wait for it; the palette doesn't. */
  run: () => void | Promise<unknown>
}

export type Shortcut = {
  /** `KeyboardEvent.key`, compared without case. */
  key?: string
  /** `KeyboardEvent.code`, for keys whose `key` changes with Shift (brackets). */
  code?: string
  /** Cmd on macOS, Ctrl elsewhere. */
  mod?: boolean
  /** Shift must be held (true), must not be (default), or doesn't matter ('any'). */
  shift?: boolean | 'any'
  /** Fires while a text field or a text layer has the cursor. */
  whileTyping?: boolean
  /** Fires on the home screen as well as in the editor. */
  anyScreen?: boolean
  /** Shown in menus and the shortcut sheet, but handled elsewhere (paste rides the paste event). */
  displayOnly?: boolean
}

export type Keymap = Record<string, Shortcut[]>

export type KeyContext = { typing: boolean; screen: 'home' | 'editor' }

type KeyEventLike = Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>

export function filterCommands(commands: CommandAction[], query: string): CommandAction[] {
  const visible = commands.filter((command) => !command.hidden)
  const q = query.trim().toLowerCase()
  if (!q) return visible
  return visible.filter((command) => {
    const haystack = [command.label, ...command.keywords].join(' ').toLowerCase()
    return q.split(/\s+/).every((token) => haystack.includes(token))
  })
}

export function matchesShortcut(event: KeyEventLike, shortcut: Shortcut): boolean {
  if (event.altKey) return false
  if (Boolean(shortcut.mod) !== (event.metaKey || event.ctrlKey)) return false
  if (shortcut.shift !== 'any' && Boolean(shortcut.shift) !== event.shiftKey) return false
  if (shortcut.code) return event.code === shortcut.code
  return shortcut.key !== undefined && event.key.toLowerCase() === shortcut.key.toLowerCase()
}

/**
 * The command a key press should run, or undefined. Commands are tried in list
 * order, so a command with a narrower `when` goes before the general one that
 * shares its keys (Delete masks a pixel selection before it deletes a layer).
 * `disabled` is a palette hint and is not consulted: commands guard themselves.
 */
export function resolveKeyCommand(
  commands: CommandAction[],
  keymap: Keymap,
  event: KeyEventLike,
  context: KeyContext,
): CommandAction | undefined {
  for (const command of commands) {
    const hit = keymap[command.id]?.find((shortcut) => !shortcut.displayOnly && matchesShortcut(event, shortcut))
    if (!hit) continue
    if (context.screen !== 'editor' && !hit.anyScreen) continue
    if (context.typing && !hit.whileTyping) continue
    if (command.when && !command.when()) continue
    return command
  }
  return undefined
}

const KEY_NAMES: Record<string, string> = {
  Delete: 'Del',
  Backspace: '⌫',
  Escape: 'Esc',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
}

export const IS_MAC_PLATFORM =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)

/** Format a human-readable mod shortcut for tooltips using the current platform. */
export function formatModKey(key: string, shift = false, mac = IS_MAC_PLATFORM): string {
  return formatShortcut({ key, mod: true, shift }, mac)
}

/** "⇧⌘K" on macOS, "Ctrl+Shift+K" elsewhere. */
export function formatShortcut(shortcut: Shortcut, mac: boolean): string {
  const raw = shortcut.code ?? shortcut.key ?? ''
  const key = KEY_NAMES[raw] ?? (raw.length === 1 ? raw.toUpperCase() : raw)
  const shift = shortcut.shift === true
  if (mac) return `${shift ? '⇧' : ''}${shortcut.mod ? '⌘' : ''}${key}`
  return `${shortcut.mod ? 'Ctrl+' : ''}${shift ? 'Shift+' : ''}${key}`
}

/** Every binding of a command, formatted; the first is the one to show where space is tight. */
export function shortcutLabels(keymap: Keymap, id: string, mac: boolean): string[] {
  return (keymap[id] ?? []).map((shortcut) => formatShortcut(shortcut, mac))
}

export type ShortcutGroup = { title: string; items: { label: string; keys: string[] }[] }

/** The shortcut sheet: the bound commands of each section, labelled as the palette labels them. */
export function buildShortcutSheet(
  commands: CommandAction[],
  keymap: Keymap,
  sections: { title: string; ids: string[] }[],
  mac: boolean,
): ShortcutGroup[] {
  const byId = new Map(commands.map((command) => [command.id, command]))
  return sections
    .map((section) => ({
      title: section.title,
      items: section.ids.flatMap((id) => {
        const command = byId.get(id)
        const keys = shortcutLabels(keymap, id, mac)
        return command && keys.length > 0 ? [{ label: command.label, keys }] : []
      }),
    }))
    .filter((group) => group.items.length > 0)
}
