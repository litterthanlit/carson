/**
 * Command palette registry (Horizon 2.9).
 */

export type CommandAction = {
  id: string
  label: string
  keywords: string[]
  scope?: 'selection' | 'canvas' | 'any'
  run: () => void
}

export function filterCommands(commands: CommandAction[], query: string): CommandAction[] {
  const q = query.trim().toLowerCase()
  if (!q) return commands
  return commands.filter((command) => {
    const haystack = [command.label, ...command.keywords].join(' ').toLowerCase()
    return q.split(/\s+/).every((token) => haystack.includes(token))
  })
}
