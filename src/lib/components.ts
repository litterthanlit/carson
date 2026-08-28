/**
 * Component instances and slot overrides (Horizon 2.8).
 * Definitions live on DocumentMeta. Instances carry componentId + slot overrides.
 */
import type { FabricObject } from 'fabric'
import { readObjectProp } from './canvasUtils'
import { topLevelLayer, walkObjectTree } from './layerGroups'
import type { Treatment } from './treatments'

export const COMPONENT_ID_KEY = 'componentId'
export const COMPONENT_SLOT_KEY = 'componentSlotId'
export const COMPONENT_OVERRIDES_KEY = 'componentOverrides'

export type ComponentSlotOverride = {
  text?: string
  fill?: string
  stroke?: string
}

export type ComponentOverrides = Record<string, ComponentSlotOverride>

export function readComponentId(object: FabricObject | null): string | null {
  if (!object) return null
  const id = readObjectProp(object, COMPONENT_ID_KEY)
  return typeof id === 'string' && id.length > 0 ? id : null
}

export function writeComponentId(object: FabricObject, componentId: string | null) {
  object.set({ [COMPONENT_ID_KEY]: componentId ?? '' } as Partial<FabricObject>)
}

export function readSlotId(object: FabricObject | null): string | null {
  if (!object) return null
  const id = readObjectProp(object, COMPONENT_SLOT_KEY)
  return typeof id === 'string' && id.length > 0 ? id : null
}

export function readComponentOverrides(object: FabricObject | null): ComponentOverrides {
  if (!object) return {}
  const raw = readObjectProp(object, COMPONENT_OVERRIDES_KEY)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return raw as ComponentOverrides
}

export function writeComponentOverrides(object: FabricObject, overrides: ComponentOverrides) {
  object.set({ [COMPONENT_OVERRIDES_KEY]: overrides } as Partial<FabricObject>)
}

export function overrideCount(overrides: ComponentOverrides): number {
  return Object.values(overrides).filter((slot) => slot.text !== undefined || slot.fill !== undefined || slot.stroke !== undefined)
    .length
}

export function instanceRoot(object: FabricObject): FabricObject | null {
  let current: FabricObject | null = object
  while (current) {
    if (readComponentId(current)) return current
    current = current.group && current.group.type === 'group' ? current.group : null
  }
  return readComponentId(object) ? object : null
}

export function ensureComponentSlotIds(root: FabricObject) {
  let index = 0
  walkObjectTree([root], (object) => {
    if (!readSlotId(object)) {
      const fallback = String(readObjectProp(object, 'id') ?? `slot-${index}`)
      object.set({ [COMPONENT_SLOT_KEY]: fallback } as Partial<FabricObject>)
    }
    index += 1
  })
}

export function retargetObjectIds(root: FabricObject, nextId: (kind: string) => string) {
  walkObjectTree([root], (object) => {
    const kind = String(readObjectProp(object, 'kind') ?? object.type ?? 'shape')
    object.set({ id: nextId(kind) } as Partial<FabricObject>)
  })
}

export function applySlotOverrides(root: FabricObject, overrides: ComponentOverrides) {
  walkObjectTree([root], (object) => {
    const slotId = readSlotId(object)
    if (!slotId) return
    const slot = overrides[slotId]
    if (!slot) return
    if (slot.text !== undefined) object.set({ text: slot.text } as Partial<FabricObject>)
    if (slot.fill !== undefined) object.set({ fill: slot.fill })
    if (slot.stroke !== undefined) object.set({ stroke: slot.stroke })
  })
}

export function mergeSlotOverride(
  overrides: ComponentOverrides,
  slotId: string,
  patch: ComponentSlotOverride,
): ComponentOverrides {
  const current = overrides[slotId] ?? {}
  const next: ComponentSlotOverride = { ...current }
  if (patch.text !== undefined) next.text = patch.text
  if (patch.fill !== undefined) next.fill = patch.fill
  if (patch.stroke !== undefined) next.stroke = patch.stroke
  return { ...overrides, [slotId]: next }
}

export function recordOverrideFromPatch(
  object: FabricObject,
  patch: { text?: string; fill?: string; stroke?: string },
): boolean {
  const root = instanceRoot(object) ?? (readComponentId(topLevelLayer(object)) ? topLevelLayer(object) : null)
  if (!root) return false
  const slotId = readSlotId(object) ?? String(readObjectProp(object, 'id') ?? '')
  if (!slotId) return false
  if (patch.text === undefined && patch.fill === undefined && patch.stroke === undefined) return false
  writeComponentOverrides(root, mergeSlotOverride(readComponentOverrides(root), slotId, patch))
  return true
}

export function detachInstance(root: FabricObject) {
  writeComponentId(root, null)
  writeComponentOverrides(root, {})
}

export function isTreatmentRecord(value: unknown): value is Treatment {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && typeof record.type === 'string' && typeof record.seed === 'number'
}

export function treatmentsFromSnapshot(snapshot: Record<string, unknown>): Treatment[] {
  const raw = snapshot.treatments
  if (!Array.isArray(raw)) return []
  return raw.filter(isTreatmentRecord)
}

export function collectInstanceRoots(objects: FabricObject[], componentId: string): FabricObject[] {
  const roots: FabricObject[] = []
  walkObjectTree(objects, (object) => {
    if (readComponentId(object) === componentId) roots.push(object)
  })
  return roots
}

