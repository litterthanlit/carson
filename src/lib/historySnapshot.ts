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

export function serializeHistorySnapshot(canvas: SerializableCanvas, props: readonly string[]): string {
  return JSON.stringify(internSnapshotSources(canvas.toObject(props as string[])))
}

export function parseHistorySnapshot(snapshot: string): Record<string, unknown> {
  return resolveSnapshotSources(JSON.parse(snapshot) as Record<string, unknown>)
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
