/**
 * File identity once you are already in a poster: Save as / Duplicate
 * copies, never silent overwrite. Home recents sort by last opened.
 */

export function uniqueCopyName(baseName: string, existingNames: readonly string[]): string {
  const names = new Set(existingNames)
  const base = baseName.trim() || 'Untitled poster'
  const copy = `${base} copy`
  if (!names.has(copy)) return copy
  let suffix = 2
  while (names.has(`${base} copy ${suffix}`)) suffix += 1
  return `${base} copy ${suffix}`
}

export function posterNameTaken(name: string, existingNames: readonly string[]): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false
  return existingNames.includes(trimmed)
}

export function saveAsDialogCopy(): { title: string; body: string; submit: string } {
  return {
    title: 'Save as',
    body: 'Copy this poster as a new file. The original stays on Home.',
    submit: 'Save copy',
  }
}

export function saveAsNameError(name: string, existingNames: readonly string[]): string | undefined {
  const trimmed = name.trim()
  if (!trimmed) return 'Name this copy to save it.'
  if (posterNameTaken(trimmed, existingNames)) {
    return `A poster named “${trimmed}” already exists. Pick a new name — this will not overwrite.`
  }
  return undefined
}
