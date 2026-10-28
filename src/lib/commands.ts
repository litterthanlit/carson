/**
 * Command palette registry (Horizon 2.9).
 */

export type CommandAction = {
  id: string
  label: string
  keywords: string[]
  scope?: 'selection' | 'canvas' | 'any'
  disabled?: boolean
  /** Resolves when the action has landed, so an agent can wait for it; the palette doesn't. */
  run: () => void | Promise<unknown>
}

export function filterCommands(commands: CommandAction[], query: string): CommandAction[] {
  const q = query.trim().toLowerCase()
  if (!q) return commands
  return commands.filter((command) => {
    const haystack = [command.label, ...command.keywords].join(' ').toLowerCase()
    return q.split(/\s+/).every((token) => haystack.includes(token))
  })
}
