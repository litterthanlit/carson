import { classRegistry, type FabricObject } from 'fabric'

/**
 * Revive a `toObject()` snapshot as the correct Fabric class.
 * `FabricObject.fromObject` does not dispatch on `type`, so Groups (and
 * Textboxes, Images, …) must go through the class registry.
 */
export async function reviveSerializedObject(json: Record<string, unknown>): Promise<FabricObject> {
  const type = String(json.type ?? '')
  if (!type) {
    throw new Error('Serialized object is missing a type')
  }
  const klass = classRegistry.getClass(type) as {
    fromObject?: (serialized: Record<string, unknown>) => Promise<FabricObject>
  }
  if (typeof klass?.fromObject !== 'function') {
    throw new Error(`Cannot revive Fabric type “${type}”`)
  }
  return await klass.fromObject(json)
}
