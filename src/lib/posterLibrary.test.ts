import { describe, expect, it } from 'vitest'
import {
  AUTOSAVE_PROJECT_ID,
  excludeAutosaveProjects,
  isAutosaveProjectId,
  nextDuplicateName,
} from './posterLibrary'

describe('excludeAutosaveProjects', () => {
  it('drops the autosave id and keeps named posters', () => {
    const projects = [
      { id: AUTOSAVE_PROJECT_ID, name: 'Resume' },
      { id: 'project-1', name: 'Ray Gun' },
    ]
    expect(excludeAutosaveProjects(projects)).toEqual([{ id: 'project-1', name: 'Ray Gun' }])
  })
})

describe('isAutosaveProjectId', () => {
  it('matches only the reserved autosave id', () => {
    expect(isAutosaveProjectId(AUTOSAVE_PROJECT_ID)).toBe(true)
    expect(isAutosaveProjectId('project-1')).toBe(false)
  })
})

describe('nextDuplicateName', () => {
  it('appends copy when the name is free', () => {
    expect(nextDuplicateName(['Ray Gun'], 'Ray Gun')).toBe('Ray Gun copy')
  })

  it('increments copy 2 when copy already exists', () => {
    expect(nextDuplicateName(['Untitled poster', 'Untitled poster copy'], 'Untitled poster')).toBe(
      'Untitled poster copy 2',
    )
  })

  it('skips taken copy numbers', () => {
    expect(
      nextDuplicateName(
        ['Mark', 'Mark copy', 'Mark copy 2', 'Mark copy 4'],
        'Mark',
      ),
    ).toBe('Mark copy 3')
  })

  it('uses Untitled poster when the source name is blank', () => {
    expect(nextDuplicateName([], '   ')).toBe('Untitled poster copy')
  })
})
