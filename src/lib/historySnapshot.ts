/**
 * Compact history snapshots.
 *
 * Undo snapshots are full scene JSON. Image layers embed their pixels as data URLs,
 * so a poster with a few photos turned every commit into a multi-megabyte
 * `JSON.stringify` and kept one copy of every image per history step.
 *
 * Snapshots now intern large data URLs into a session pool and store a short
 * reference instead. Identical images share one pool entry across every step, so
 * history memory grows with edits, not with image bytes. Saved files and autosave
 * are unaffected — they serialize the real data URLs.
 */
import { FabricImage } from 'fabric'

const REF_PREFIX = 'carson-src:'
/** Only intern payloads worth the bookkeeping. */
const MIN_INTERN_LENGTH = 2048

const refToSrc = new Map<string, string>()
const srcToRef = new Map<string, string>()
let nextRef = 1

function internSrc(src: string): string {
  let ref = srcToRef.get(src)
  if (!ref) {
    ref = `${REF_PREFIX}${nextRef++}`
    srcToRef.set(src, ref)
    refToSrc.set(ref, src)
  }
  return ref
}

type Json = unknown

function mapSources(value: Json, transform: (src: string) => string): Json {
  if (Array.isArray(value)) return value.map((item) => mapSources(item, transform))
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, Json>
  let out: Record<string, Json> | null = null
  for (const key of Object.keys(record)) {
    const item = record[key]
    let next: Json = item
    if (key === 'src' && typeof item === 'string') next = transform(item)
    else if (item && typeof item === 'object') next = mapSources(item, transform)
    if (next !== item) {
      out ??= { ...record }
      out[key] = next
    }
  }
  return out ?? record
}

/** Replace large embedded image sources with pool references. */
export function internSnapshotSources<T>(json: T): T {
  return mapSources(json, (src) => (src.length >= MIN_INTERN_LENGTH && src.startsWith('data:') ? internSrc(src) : src)) as T
}

/** Restore pool references to their data URLs. Unknown references are left as-is. */
export function resolveSnapshotSources<T>(json: T): T {
  return mapSources(json, (src) => (src.startsWith(REF_PREFIX) ? (refToSrc.get(src) ?? src) : src)) as T
}

type SerializableCanvas = { toObject: (props?: string[]) => unknown }

// ── Paint layers in history ────────────────────────────────────────────────
// A paint layer's pixels live in a <canvas>; encoding it to PNG for every history
// snapshot would cost ~0.5s on a 300dpi poster. While a history snapshot is being
// serialized, paint layers emit a versioned reference instead, backed by a pooled
// copy of their pixels (a GPU copy, later compressed to a PNG blob off-thread).

const PAINT_REF_PREFIX = 'carson-paint:'
const TRANSPARENT_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

type PaintEntry = { canvas?: HTMLCanvasElement; blob?: Blob; width: number; height: number }
const paintPool = new Map<string, PaintEntry>()
let serializingHistory = false

type PaintSource = { id?: unknown; paintLayer?: unknown; paintVersion?: unknown }

function paintRefFor(object: PaintSource, element: HTMLCanvasElement): string {
  const ref = `${PAINT_REF_PREFIX}${String(object.id ?? 'paint')}@${Number(object.paintVersion ?? 0)}`
  if (!paintPool.has(ref)) {
    const copy = document.createElement('canvas')
    copy.width = element.width
    copy.height = element.height
    copy.getContext('2d')?.drawImage(element, 0, 0)
    const entry: PaintEntry = { canvas: copy, width: copy.width, height: copy.height }
    paintPool.set(ref, entry)
    copy.toBlob?.((blob) => {
      if (!blob) return
      entry.blob = blob
      entry.canvas = undefined
    }, 'image/png')
  }
  return ref
}

export function serializeHistorySnapshot(canvas: SerializableCanvas, props: readonly string[]): string {
  serializingHistory = true
  try {
    return JSON.stringify(internSnapshotSources(canvas.toObject(props as string[])))
  } finally {
    serializingHistory = false
  }
}

/** Swap paint references for a placeholder; `rehydratePaintLayers` restores pixels after load. */
function resolvePaintRefs(value: Json): Json {
  if (Array.isArray(value)) return value.map(resolvePaintRefs)
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, Json>
  const out: Record<string, Json> = {}
  for (const key of Object.keys(record)) out[key] = resolvePaintRefs(record[key])
  if (typeof record.src === 'string' && record.src.startsWith(PAINT_REF_PREFIX)) {
    out.src = TRANSPARENT_PIXEL
    out.paintRef = record.src
  }
  return out
}

export function parseHistorySnapshot(snapshot: string): Record<string, unknown> {
  return resolvePaintRefs(resolveSnapshotSources(JSON.parse(snapshot) as Record<string, unknown>)) as Record<string, unknown>
}

type RehydratableImage = {
  paintRef?: string
  setElement: (element: HTMLCanvasElement) => void
  set: (props: Record<string, unknown>) => void
  _objects?: RehydratableImage[]
}

/** After a snapshot load, put pooled paint pixels back into their layers. */
export async function rehydratePaintLayers(objects: RehydratableImage[]): Promise<void> {
  for (const object of objects) {
    if (object._objects) await rehydratePaintLayers(object._objects)
    const ref = object.paintRef
    if (!ref) continue
    const entry = paintPool.get(ref)
    object.set({ paintRef: undefined })
    if (!entry) continue
    const canvas = document.createElement('canvas')
    canvas.width = entry.width
    canvas.height = entry.height
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    if (entry.canvas) ctx.drawImage(entry.canvas, 0, 0)
    else if (entry.blob) {
      const bitmap = await createImageBitmap(entry.blob)
      ctx.drawImage(bitmap, 0, 0)
      bitmap.close()
    }
    object.setElement(canvas)
    object.set({ objectCaching: false, dirty: true })
  }
}

// Saves need a real data URL. Encode each paint version once, asynchronously when
// possible (`preparePaintSources`), and serve the cached URL from getSrc.
const paintUrlCache = new WeakMap<HTMLCanvasElement, { version: number; url: string }>()

function paintDataUrl(object: PaintSource, element: HTMLCanvasElement): string {
  const version = Number(object.paintVersion ?? 0)
  const cached = paintUrlCache.get(element)
  if (cached && cached.version === version) return cached.url
  const url = element.toDataURL('image/png')
  paintUrlCache.set(element, { version, url })
  return url
}

type PaintWalkable = PaintSource & { _originalElement?: unknown; _objects?: PaintWalkable[] }

/** Encode stale paint layers off the main thread before a save serializes them. */
export async function preparePaintSources(objects: PaintWalkable[]): Promise<void> {
  for (const object of objects) {
    if (object._objects) await preparePaintSources(object._objects)
    const element = object._originalElement
    if (!object.paintLayer || !(element instanceof HTMLCanvasElement)) continue
    const version = Number(object.paintVersion ?? 0)
    if (paintUrlCache.get(element)?.version === version) continue
    const blob = await new Promise<Blob | null>((resolve) => element.toBlob(resolve, 'image/png'))
    if (!blob) continue
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
    paintUrlCache.set(element, { version, url })
  }
}

/** Test hook. */
export function historySourcePoolSize() {
  return refToSrc.size
}

const srcCache = new WeakMap<object, string>()
let srcCacheInstalled = false

/**
 * `FabricImage.getSrc()` reads `element.src`, which copies the whole data URL out of
 * the DOM on every call (every history commit, thumbnail, autosave). Cache it per
 * `<img>` element; a new element (setElement, filters on a canvas) gets a new entry.
 * Canvas-backed sources are not cached because their pixels can change in place.
 */
export function installImageSrcCache() {
  if (srcCacheInstalled) return
  srcCacheInstalled = true
  const proto = FabricImage.prototype as unknown as {
    getSrc: (this: { _originalElement?: unknown; _element?: unknown }, filtered?: boolean) => string
  }
  const original = proto.getSrc
  proto.getSrc = function getSrcCached(filtered?: boolean) {
    const source = this as unknown as PaintSource & { _originalElement?: unknown }
    if (!filtered && source.paintLayer && typeof HTMLCanvasElement !== 'undefined' && source._originalElement instanceof HTMLCanvasElement) {
      return serializingHistory ? paintRefFor(source, source._originalElement) : paintDataUrl(source, source._originalElement)
    }
    const element = (filtered ? this._element : this._originalElement) as HTMLImageElement | undefined
    if (typeof HTMLImageElement === 'undefined' || !(element instanceof HTMLImageElement)) {
      return original.call(this, filtered)
    }
    const cached = srcCache.get(element)
    if (cached !== undefined) return cached
    const value = original.call(this, filtered)
    if (value) srcCache.set(element, value)
    return value
  }
}
