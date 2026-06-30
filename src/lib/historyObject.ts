/**
 * Lightweight history payloads for object property and z-order edits (Horizon 2.1).
 */
import type { Canvas, FabricObject } from 'fabric'
import { readObjectProp } from './canvasUtils'

export type ObjectPatch = {
  left: number
  top: number
  opacity: number
  name: string
  visible: boolean
  selectable: boolean
  evented: boolean
}

export function captureObjectPatch(object: FabricObject): string {
  const patch: ObjectPatch = {
    left: object.left ?? 0,
    top: object.top ?? 0,
    opacity: object.opacity ?? 1,
    name: String(readObjectProp(object, 'name') ?? 'Layer'),
    visible: object.visible !== false,
    selectable: object.selectable !== false,
    evented: object.evented !== false,
  }
  return JSON.stringify(patch)
}

export function applyObjectPatch(object: FabricObject, patchJson: string): void {
  const patch = JSON.parse(patchJson) as ObjectPatch
  object.set({
    left: patch.left,
    top: patch.top,
    opacity: patch.opacity,
    name: patch.name,
    visible: patch.visible,
    selectable: patch.selectable,
    evented: patch.evented,
  } as Partial<FabricObject>)
  object.setCoords()
}

export function captureLayerOrder(canvas: Canvas): string {
  return JSON.stringify(
    canvas.getObjects().map((object) => String(readObjectProp(object, 'id') ?? '')),
  )
}

export function applyLayerOrder(canvas: Canvas, orderJson: string): void {
  const ids = JSON.parse(orderJson) as string[]
  const objects = canvas.getObjects()
  const byId = new Map(objects.map((object) => [String(readObjectProp(object, 'id') ?? ''), object]))
  ids.forEach((id, index) => {
    const object = byId.get(id)
    if (object) canvas.moveObjectTo(object, index)
  })
}
