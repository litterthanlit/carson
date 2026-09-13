import { describe, expect, it } from 'vitest'
import { applyPosterPreset } from './editorModel'
import { formatProjectTimestamp, projectLastUsed, sortProjectsForHome } from './home'
import type { StoredProject } from './storage'

function project(partial: Partial<StoredProject> & Pick<StoredProject, 'id' | 'name' | 'savedAt'>): StoredProject {
  return {
    preset: applyPosterPreset('a3'),
    canvas: {},
    ...partial,
  }
}

describe('home recents', () => {
  it('prefers lastUsedAt over savedAt for recency', () => {
    const olderSave = project({
      id: 'a',
      name: 'Older save, opened recently',
      savedAt: '2026-01-01T00:00:00.000Z',
      lastUsedAt: '2026-09-11T12:00:00.000Z',
    })
    const newerSave = project({
      id: 'b',
      name: 'Newer save, never reopened',
      savedAt: '2026-06-01T00:00:00.000Z',
    })

    expect(projectLastUsed(olderSave)).toBe('2026-09-11T12:00:00.000Z')
    expect(sortProjectsForHome([newerSave, olderSave]).map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('promotes a file that was opened without saving above a newer save', () => {
    const opened = project({
      id: 'opened',
      name: 'Night bus',
      savedAt: '2026-01-01T00:00:00.000Z',
      lastUsedAt: '2026-09-13T10:00:00.000Z',
    })
    const savedLater = project({
      id: 'saved',
      name: 'Day plaza',
      savedAt: '2026-09-13T09:00:00.000Z',
    })

    expect(sortProjectsForHome([savedLater, opened]).map((item) => item.name)).toEqual(['Night bus', 'Day plaza'])
  })

  it('formats valid timestamps and falls back for junk dates', () => {
    expect(formatProjectTimestamp('not-a-date')).toBe('Unknown date')
    expect(formatProjectTimestamp('2026-09-11T12:00:00.000Z').length).toBeGreaterThan(4)
  })
})
