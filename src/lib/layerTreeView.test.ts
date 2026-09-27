import { describe, expect, it } from 'vitest'
import { effectiveCollapsedIds, groupIdsWithChildren, visibleLayerRows } from './layerTreeView'

const rows = [
  { id: 'a' },
  { id: 'g1' },
  { id: 'b', parentId: 'g1' },
  { id: 'g2', parentId: 'g1' },
  { id: 'c', parentId: 'g2' },
  { id: 'd' },
]

describe('layerTreeView', () => {
  it('finds groups that have children', () => {
    expect([...groupIdsWithChildren(rows)].sort()).toEqual(['g1', 'g2'])
  })

  it('hides every descendant of a collapsed group', () => {
    expect(visibleLayerRows(rows, new Set(['g1'])).map((row) => row.id)).toEqual(['a', 'g1', 'd'])
    expect(visibleLayerRows(rows, new Set(['g2'])).map((row) => row.id)).toEqual(['a', 'g1', 'b', 'g2', 'd'])
  })

  it('returns all rows when nothing is collapsed', () => {
    expect(visibleLayerRows(rows, new Set())).toBe(rows)
  })

  it('expands the ancestors of a selected nested layer', () => {
    const collapsed = new Set(['g1', 'g2'])
    expect([...effectiveCollapsedIds(rows, collapsed, ['c'])]).toEqual([])
    expect([...effectiveCollapsedIds(rows, collapsed, ['b'])]).toEqual(['g2'])
    expect([...effectiveCollapsedIds(rows, collapsed, ['d'])].sort()).toEqual(['g1', 'g2'])
  })
})
