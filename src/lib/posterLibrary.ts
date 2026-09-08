/**
 * Pure helpers for the local poster library (dashboard names, autosave filtering).
 */

export const AUTOSAVE_PROJECT_ID = '__autosave__'

export function isAutosaveProjectId(id: string): boolean {
  return id === AUTOSAVE_PROJECT_ID
}

export function excludeAutosaveProjects<T extends { id: string }>(projects: T[]): T[] {
  return projects.filter((project) => !isAutosaveProjectId(project.id))
}

/** Next name for a duplicated poster: "Foo copy", then "Foo copy 2", … */
export function nextDuplicateName(existingNames: string[], sourceName: string): string {
  const names = new Set(existingNames)
  const base = sourceName.trim() || 'Untitled poster'
  const first = `${base} copy`
  if (!names.has(first)) return first
  let index = 2
  while (names.has(`${base} copy ${index}`)) {
    index += 1
  }
  return `${base} copy ${index}`
}
