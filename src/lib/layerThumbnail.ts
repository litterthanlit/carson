import type { Canvas, FabricObject } from 'fabric'

const THUMB_SIZE = 28
const THUMB_JPEG_QUALITY = 0.7

type ThumbnailCacheEntry = {
  signature: string
  dataUrl: string
}

const thumbnailCache = new Map<string, ThumbnailCacheEntry>()

export type LayerThumbnailSource = {
  id?: unknown
  type?: string | null
  width?: number
  height?: number
  scaleX?: number
  scaleY?: number
  angle?: number
  fill?: unknown
  text?: unknown
  opacity?: number
  treatments?: unknown
  filters?: unknown[] | null
}

export function layerThumbnailSignature(source: LayerThumbnailSource): string {
  return JSON.stringify({
    id: String(source.id ?? ''),
    type: source.type ?? '',
    width: source.width ?? 0,
    height: source.height ?? 0,
    scaleX: source.scaleX ?? 1,
    scaleY: source.scaleY ?? 1,
    angle: source.angle ?? 0,
    fill: source.fill ?? '',
    text: source.text ?? '',
    opacity: source.opacity ?? 1,
    treatments: source.treatments ?? [],
    filterCount: Array.isArray(source.filters) ? source.filters.length : 0,
  })
}

export function clearLayerThumbnailCache() {
  thumbnailCache.clear()
}

export function invalidateLayerThumbnail(objectId: string) {
  thumbnailCache.delete(objectId)
}

export function createLayerThumbnail(object: FabricObject, canvas: Canvas): string | null {
  if (object.visible === false) return null
  try {
    const bounds = object.getBoundingRect()
    if (bounds.width < 1 || bounds.height < 1) return null
    const record = object as unknown as LayerThumbnailSource
    const objectId = String(record.id ?? '')
    const signature = layerThumbnailSignature(record)
    const cached = objectId ? thumbnailCache.get(objectId) : undefined
    if (cached && cached.signature === signature) return cached.dataUrl

    const multiplier = Math.min(THUMB_SIZE / bounds.width, THUMB_SIZE / bounds.height, 1)
    const dataUrl = object.toDataURL({
      format: 'jpeg',
      quality: THUMB_JPEG_QUALITY,
      multiplier: Math.max(0.05, multiplier),
    })
    if (objectId) thumbnailCache.set(objectId, { signature, dataUrl })
    return dataUrl
  } catch {
    try {
      return canvas.toDataURL({
        format: 'jpeg',
        quality: THUMB_JPEG_QUALITY,
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
