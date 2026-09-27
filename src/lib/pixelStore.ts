/**
 * Session store for raster undo data (paint strokes).
 *
 * Each stroke keeps the before/after pixels of just its dirty rectangle. Entries
 * start as ImageData (instant undo) and are compressed to PNG blobs in the
 * background — `canvas.toBlob` encodes off the main thread — so a long painting
 * session holds kilobytes per stroke instead of raw RGBA megabytes.
 */

type Entry = { image?: ImageData; blob?: Blob; width: number; height: number }

const entries = new Map<string, Entry>()
let nextKey = 1

function compress(key: string, entry: Entry) {
  if (typeof document === 'undefined' || !entry.image) return
  const canvas = document.createElement('canvas')
  canvas.width = entry.width
  canvas.height = entry.height
  const ctx = canvas.getContext('2d')
  if (!ctx || typeof canvas.toBlob !== 'function') return
  ctx.putImageData(entry.image, 0, 0)
  canvas.toBlob((blob) => {
    const current = entries.get(key)
    if (!blob || current !== entry) return
    entry.blob = blob
    entry.image = undefined
  }, 'image/png')
}

export function storePixels(image: ImageData): string {
  const key = `px-${nextKey++}`
  const entry: Entry = { image, width: image.width, height: image.height }
  entries.set(key, entry)
  compress(key, entry)
  return key
}

/** Resolve stored pixels, decoding the compressed form if needed. */
export async function loadPixels(key: string): Promise<ImageData | null> {
  const entry = entries.get(key)
  if (!entry) return null
  if (entry.image) return entry.image
  if (!entry.blob) return null
  const bitmap = await createImageBitmap(entry.blob)
  const canvas = document.createElement('canvas')
  canvas.width = entry.width
  canvas.height = entry.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  return ctx.getImageData(0, 0, entry.width, entry.height)
}

export function hasPixels(key: string): boolean {
  return entries.has(key)
}
