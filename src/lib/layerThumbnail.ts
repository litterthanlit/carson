import type { Canvas, FabricObject } from 'fabric'

const THUMB_SIZE = 28

export function createLayerThumbnail(object: FabricObject, canvas: Canvas): string | null {
  if (object.visible === false) return null
  try {
    const bounds = object.getBoundingRect()
    if (bounds.width < 1 || bounds.height < 1) return null
    const multiplier = Math.min(THUMB_SIZE / bounds.width, THUMB_SIZE / bounds.height, 1)
    return object.toDataURL({
      format: 'png',
      multiplier: Math.max(0.05, multiplier),
    })
  } catch {
    try {
      return canvas.toDataURL({
        format: 'png',
        multiplier: 0.05,
        left: object.left ?? 0,
        top: object.top ?? 0,
        width: Math.max(1, (object.width ?? 1) * (object.scaleX ?? 1)),
        height: Math.max(1, (object.height ?? 1) * (object.scaleY ?? 1)),
      })
    } catch {
      return null
    }
  }
}
