import { describe, expect, it } from 'vitest'
import type { FabricObject } from 'fabric'
import {
  canGroupObjects,
  findObjectInTree,
  flattenLayerTree,
  isLayerGroup,
  topLevelLayer,
} from './layerGroups'

function fakeObject(id: string, extras: Record<string, unknown> = {}): FabricObject {
  return {
    type: extras.type ?? 'rect',
    getObjects: extras.getObjects,
    group: extras.group,
    ...extras,
    id,
  } as unknown as FabricObject
}

function fakeGroup(id: string, children: FabricObject[]): FabricObject {
  const group = fakeObject(id, {
    type: 'group',
    getObjects: () => children,
  })
  for (const child of children) {
    ;(child as unknown as { group: FabricObject }).group = group
  }
  return group
}

describe('layer groups', () => {
  it('isLayerGroup is true only for Fabric groups', () => {
    expect(isLayerGroup(fakeObject('a'))).toBe(false)
    expect(isLayerGroup(fakeObject('g', { type: 'group', getObjects: () => [] }))).toBe(true)
    expect(isLayerGroup(fakeObject('sel', { type: 'activeselection' }))).toBe(false)
  })

  it('flattenLayerTree nests children under groups and skips scrape fragments', () => {
    const childA = fakeObject('a')
    const childB = fakeObject('b')
    const group = fakeGroup('g', [childA, childB])
    const scrape = fakeObject('scrape', { scrapeFragment: true })
    const lone = fakeObject('c')

    const rows = flattenLayerTree([group, scrape, lone])
    expect(rows.map((row) => `${row.id}:${row.depth}:${row.parentId ?? '-'}`)).toEqual([
      'c:0:-',
      'g:0:-',
      'b:1:g',
      'a:1:g',
    ])
  })

  it('findObjectInTree walks into groups', () => {
    const nested = fakeObject('inner')
    const group = fakeGroup('g', [nested])
    expect(findObjectInTree([group], 'inner')).toBe(nested)
    expect(findObjectInTree([group], 'missing')).toBeNull()
  })

  it('topLevelLayer climbs nested groups', () => {
    const inner = fakeObject('inner')
    const mid = fakeGroup('mid', [inner])
    const outer = fakeGroup('outer', [mid])
    ;(inner as unknown as { group: FabricObject }).group = mid
    ;(mid as unknown as { group: FabricObject }).group = outer
    expect(topLevelLayer(inner)).toBe(outer)
  })

  it('canGroupObjects requires two eligible layers', () => {
    expect(canGroupObjects([fakeObject('a')])).toBe(false)
    expect(canGroupObjects([fakeObject('a'), fakeObject('b')])).toBe(true)
    expect(canGroupObjects([fakeObject('a'), fakeObject('s', { scrapeFragment: true })])).toBe(false)
  })
})
