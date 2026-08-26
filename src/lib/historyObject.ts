/**
 * Lightweight history payloads for object property and z-order edits (Horizon 2.1).
 */
import type { Path as FabricPath } from 'fabric'
import type { Canvas, FabricObject } from 'fabric'
import { applyLayerMask, readLayerMask, writeLayerMask, type LayerMask } from './layerMask'
import { applyPathData, type PathData } from './pathEditing'
import { readObjectProp } from './canvasUtils'

export type ObjectPatch = {
  left: number
  top: number
  angle?: number
  scaleX?: number
  scaleY?: number
  opacity: number
  blendMode?: string
  name: string
  visible: boolean
  selectable: boolean
  evented: boolean
  pathData?: PathData
  layerMask?: LayerMask | null
}

export function captureObjectPatch(object: FabricObject): string {
  const patch: ObjectPatch = {
    left: object.left ?? 0,
    top: object.top ?? 0,
    opacity: object.opacity ?? 1,
    blendMode: String(object.globalCompositeOperation ?? 'source-over'),
    name: String(readObjectProp(object, 'name') ?? 'Layer'),
    visible: object.visible !== false,
    selectable: object.selectable !== false,
    evented: object.evented !== false,
    layerMask: readLayerMask(object),
  }
  return JSON.stringify(patch)
}

export function capturePathEditPatch(object: FabricObject): string {
  const patch = JSON.parse(captureObjectPatch(object)) as ObjectPatch
  if (object.type !== 'path') return JSON.stringify(patch)
  const path = object as FabricPath
  return JSON.stringify({
    ...patch,
    angle: path.angle ?? 0,
    scaleX: path.scaleX ?? 1,
    scaleY: path.scaleY ?? 1,
    pathData: JSON.parse(JSON.stringify(path.path)) as PathData,
  })
}

export function applyObjectPatch(object: FabricObject, patchJson: string): void {
  const patch = JSON.parse(patchJson) as ObjectPatch
  if (patch.pathData && object.type === 'path') {
    applyPathData(object as FabricPath, patch.pathData)
  }
  object.set({
    left: patch.left,
    top: patch.top,
    angle: patch.angle ?? object.angle ?? 0,
    scaleX: patch.scaleX ?? object.scaleX ?? 1,
    scaleY: patch.scaleY ?? object.scaleY ?? 1,
    opacity: patch.opacity,
    globalCompositeOperation: patch.blendMode ?? object.globalCompositeOperation ?? 'source-over',
    name: patch.name,
    visible: patch.visible,
    selectable: patch.selectable,
    evented: patch.evented,
  } as Partial<FabricObject>)
  if (Object.prototype.hasOwnProperty.call(patch, 'layerMask')) {
    writeLayerMask(object, patch.layerMask ?? null)
    void applyLayerMask(object)
  }
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
