/**
 * Layer groups — nested Fabric Group walkers for the layers panel (Horizon 2.8).
 */
import type { FabricObject, Group } from 'fabric'
import { readObjectProp } from './canvasUtils'

export function isLayerGroup(object: FabricObject): object is Group {
  return object.type === 'group'
}

export function getGroupChildren(object: FabricObject): FabricObject[] {
  if (!isLayerGroup(object)) return []
  return object.getObjects()
}

export function walkObjectTree(
  objects: FabricObject[],
  visit: (object: FabricObject, depth: number, parent: FabricObject | null) => void,
  depth = 0,
  parent: FabricObject | null = null,
) {
  for (const object of objects) {
    visit(object, depth, parent)
    if (isLayerGroup(object)) {
      walkObjectTree(getGroupChildren(object), visit, depth + 1, object)
    }
  }
}

export function findObjectInTree(objects: FabricObject[], id: string): FabricObject | null {
  for (const object of objects) {
    if (String(readObjectProp(object, 'id') ?? '') === id) return object
    if (isLayerGroup(object)) {
      const nested = findObjectInTree(getGroupChildren(object), id)
      if (nested) return nested
    }
  }
  return null
}

/** Climb nested groups (not ActiveSelection) to the canvas-level object. */
export function topLevelLayer(object: FabricObject): FabricObject {
  let current = object
  while (current.group && current.group.type === 'group') {
    current = current.group
  }
  return current
}

export function canGroupObjects(objects: FabricObject[]): boolean {
  const eligible = objects.filter((object) => {
    if (object.type === 'activeselection') return false
    if (readObjectProp(object, 'scrapeFragment')) return false
    if (readObjectProp(object, 'decayMarkSourceId')) return false
    return true
  })
  return eligible.length >= 2
}

export type LayerTreeNode = {
  id: string
  depth: number
  parentId: string | null
  object: FabricObject
}

export function flattenLayerTree(objects: FabricObject[]): LayerTreeNode[] {
  const rows: LayerTreeNode[] = []
  const visit = (list: FabricObject[], depth: number, parentId: string | null) => {
    for (const object of [...list].reverse()) {
      if (readObjectProp(object, 'scrapeFragment')) continue
      if (readObjectProp(object, 'decayMarkSourceId')) continue
      const id = String(readObjectProp(object, 'id') ?? '')
      if (!id) continue
      rows.push({ id, depth, parentId, object })
      if (isLayerGroup(object)) visit(getGroupChildren(object), depth + 1, id)
    }
  }
  visit(objects, 0, null)
  return rows
}
