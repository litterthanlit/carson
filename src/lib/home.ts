import type { StoredProject } from './storage'

export function projectLastUsed(project: Pick<StoredProject, 'savedAt' | 'lastUsedAt'>): string {
  return project.lastUsedAt ?? project.savedAt
}

export function sortProjectsForHome(projects: StoredProject[]): StoredProject[] {
  return [...projects].sort((a, b) => projectLastUsed(b).localeCompare(projectLastUsed(a)))
}

export function formatProjectTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return date.toLocaleString()
}

export function posterAspectRatio(project: Pick<StoredProject, 'preset'>): string {
  const width = project.preset.width > 0 ? project.preset.width : 3
  const height = project.preset.height > 0 ? project.preset.height : 4
  return `${width} / ${height}`
}
