/**
 * Uploaded fonts that outlive the session — a small IndexedDB of their own.
 *
 * A separate database (not a new store in `carson-poster`) so persisting fonts never
 * needs a version bump, and so a migration can never put saved posters at risk.
 *
 * One record per distinct font file, keyed by a hash of its bytes: uploading or
 * opening the same file again writes nothing new. A record lists every family
 * name it was installed under; a family name belongs to one file at a time, so a
 * newer file under the same name takes the name over.
 */
import { cache as fabricCache } from 'fabric'
import { installUploadedFont, loadFontFile, uploadedFont, type UploadedFont } from './fonts'

export type StoredFontRecord = {
  /** Hash of the file's bytes; see `fontBytesKey`. */
  hash: string
  families: string[]
  fileName: string
  mimeType: string
  bytes: Uint8Array<ArrayBuffer>
  savedAt: string
}

const DB_NAME = 'carson-fonts'
const DB_VERSION = 1
const STORE = 'fonts'

// ── Pure planning ────────────────────────────────────────────────────────────

/** FNV-1a over the bytes from two seeds, plus the length: a stable, synchronous content key. */
export function fontBytesKey(bytes: Uint8Array): string {
  let a = 0x811c9dc5
  let b = 0x01000193 ^ 0x5bd1e995
  for (let at = 0; at < bytes.length; at += 1) {
    a = Math.imul(a ^ bytes[at], 0x01000193)
    b = Math.imul(b ^ bytes[at], 0x01000193 + 2)
  }
  const hex = (value: number) => (value >>> 0).toString(16).padStart(8, '0')
  return `${bytes.length.toString(16)}-${hex(a)}${hex(b)}`
}

export type FontRecordIndex = { hash: string; families: string[] }

export type FontWritePlan =
  | { kind: 'unchanged' }
  | {
      kind: 'write'
      /** Families of the record for the incoming file after the write. */
      families: string[]
      /** No record held this file yet: create one (with the bytes). */
      create: boolean
      /** Other files that lose the family name and keep at least one other. */
      update: FontRecordIndex[]
      /** Other files whose only family name was taken over. */
      remove: string[]
    }

/** What to write so `family` resolves to the file with `hash`, storing each file once. */
export function planFontWrite(existing: readonly FontRecordIndex[], hash: string, family: string): FontWritePlan {
  const own = existing.find((record) => record.hash === hash)
  const others = existing.filter((record) => record.hash !== hash && record.families.includes(family))
  if (own?.families.includes(family) && others.length === 0) return { kind: 'unchanged' }
  const update: FontRecordIndex[] = []
  const remove: string[] = []
  for (const record of others) {
    const families = record.families.filter((name) => name !== family)
    if (families.length) update.push({ hash: record.hash, families })
    else remove.push(record.hash)
  }
  return {
    kind: 'write',
    families: own ? [...new Set([...own.families, family])] : [family],
    create: !own,
    update,
    remove,
  }
}

/** The fonts to install from stored records: one per family name. */
export function fontsFromRecords(records: readonly StoredFontRecord[]): UploadedFont[] {
  const byFamily = new Map<string, UploadedFont>()
  for (const record of [...records].sort((a, b) => a.savedAt.localeCompare(b.savedAt))) {
    for (const family of record.families) {
      byFamily.set(family, { family, fileName: record.fileName, mimeType: record.mimeType, bytes: record.bytes })
    }
  }
  return [...byFamily.values()]
}

// ── IndexedDB ────────────────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'hash' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open font database'))
    request.onblocked = () => reject(new Error('Font database blocked'))
  })
  // A failed open (private mode, blocked) may succeed later; don't cache the failure.
  dbPromise.catch(() => {
    dbPromise = null
  })
  return dbPromise
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Font transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('Font transaction aborted'))
  })
}

export async function listStoredFonts(): Promise<StoredFontRecord[]> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readonly')
  const request = tx.objectStore(STORE).getAll()
  await txDone(tx)
  return request.result as StoredFontRecord[]
}

/** Keep a font file across reloads. Resolves once the write is committed (or nothing needed writing). */
export async function storeFont(font: UploadedFont): Promise<void> {
  const hash = fontBytesKey(font.bytes)
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  const request = store.getAll()
  // Plan and write inside the same transaction, so two writes can't interleave.
  request.onsuccess = () => {
    const records = request.result as StoredFontRecord[]
    const plan = planFontWrite(records, hash, font.family)
    if (plan.kind === 'unchanged') return
    const own = records.find((record) => record.hash === hash)
    store.put(
      own
        ? { ...own, families: plan.families }
        : {
            hash,
            families: plan.families,
            fileName: font.fileName,
            mimeType: font.mimeType,
            bytes: font.bytes,
            savedAt: new Date().toISOString(),
          },
    )
    for (const change of plan.update) {
      const record = records.find((item) => item.hash === change.hash)
      if (record) store.put({ ...record, families: change.families })
    }
    for (const removed of plan.remove) store.delete(removed)
  }
  await txDone(tx)
}

// ── Session ──────────────────────────────────────────────────────────────────

export type RestoredFonts = { families: string[]; failed: string[]; storageAvailable: boolean }

let restorePromise: Promise<RestoredFonts> | null = null

/**
 * Install every stored font, once per page. Await it before anything loads or
 * measures a poster: Fabric caches glyph widths per family, and widths measured
 * in a stand-in face would stick after the real font arrives.
 */
export function restoreStoredFonts(): Promise<RestoredFonts> {
  restorePromise ??= (async () => {
    let records: StoredFontRecord[]
    try {
      records = await listStoredFonts()
    } catch {
      return { families: [], failed: [], storageAvailable: false }
    }
    const families: string[] = []
    const failed: string[] = []
    for (const font of fontsFromRecords(records)) {
      // An upload this session under the same name is newer; keep it.
      if (uploadedFont(font.family)) continue
      try {
        await installUploadedFont(font)
        families.push(font.family)
      } catch {
        failed.push(font.family)
      }
      fabricCache.clearFontCache(font.family)
    }
    return { families, failed, storageAvailable: true }
  })()
  return restorePromise
}

let warnedSessionOnly = false

/**
 * Persist a font that is already installed for the session. Never throws: when the
 * browser won't store it (quota, private mode) the font still works until a reload,
 * and the first such failure returns a note for the status line.
 */
export async function persistFont(font: UploadedFont): Promise<string | null> {
  try {
    await storeFont(font)
    return null
  } catch {
    if (warnedSessionOnly) return null
    warnedSessionOnly = true
    return 'This browser won’t keep uploaded fonts, so they last until you reload'
  }
}

/** Upload a font file: install it now and keep it for later sessions. */
export async function uploadFontFile(file: File): Promise<{ family: string; notice: string | null }> {
  const family = await loadFontFile(file)
  const font = uploadedFont(family)
  const notice = font ? await persistFont(font) : null
  fabricCache.clearFontCache(family)
  return { family, notice }
}

/** The font file for a family, from this session or from storage — what a poster file embeds. */
export async function fontForFile(family: string): Promise<UploadedFont | undefined> {
  const live = uploadedFont(family)
  if (live) return live
  try {
    return fontsFromRecords(await listStoredFonts()).find((font) => font.family === family)
  } catch {
    return undefined
  }
}
