/**
 * IndexedDB-backed project persistence. Replaces localStorage (5MB quota,
 * silent overwrite, no autosave) with durable, quota-tolerant storage.
 * Migrates any legacy localStorage saves on first open.
 */
import type { PosterPreset } from './editorModel'

export type StoredProject = {
  id: string
  name: string
  savedAt: string
  preset: PosterPreset
  canvas: Record<string, unknown>
}

const DB_NAME = 'carson-poster'
const DB_VERSION = 1
const STORE = 'projects'
const AUTOSAVE_ID = '__autosave__'
const LEGACY_KEY = 'carson.poster.projects.v1'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('savedAt', 'savedAt')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open project database'))
  })
  return dbPromise
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Storage transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('Storage transaction aborted'))
  })
}

export async function listProjects(): Promise<StoredProject[]> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readonly')
  const request = tx.objectStore(STORE).getAll()
  await txDone(tx)
  const projects = (request.result as StoredProject[]).filter((p) => p.id !== AUTOSAVE_ID)
  return projects.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

export async function findProjectByName(name: string): Promise<StoredProject | undefined> {
  const projects = await listProjects()
  return projects.find((p) => p.name === name)
}

export async function saveProject(project: StoredProject): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).put(project)
  await txDone(tx)
}

export async function deleteProject(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).delete(id)
  await txDone(tx)
}

export async function saveAutosave(snapshot: Omit<StoredProject, 'id'>): Promise<void> {
  await saveProject({ ...snapshot, id: AUTOSAVE_ID })
}

export async function loadAutosave(): Promise<StoredProject | undefined> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readonly')
  const request = tx.objectStore(STORE).get(AUTOSAVE_ID)
  await txDone(tx)
  return request.result as StoredProject | undefined
}

export async function clearAutosave(): Promise<void> {
  await deleteProject(AUTOSAVE_ID)
}

export function newProjectId(): string {
  return `project-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

/** One-time migration of legacy localStorage saves into IndexedDB. */
export async function migrateLegacyProjects(): Promise<number> {
  let legacy: Array<Omit<StoredProject, 'id'>> = []
  try {
    legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? '[]')
  } catch {
    return 0
  }
  if (!Array.isArray(legacy) || legacy.length === 0) return 0

  const existing = await listProjects()
  const existingNames = new Set(existing.map((p) => p.name))
  let migrated = 0
  for (const project of legacy) {
    if (!project?.name || !project?.canvas || existingNames.has(project.name)) continue
    await saveProject({ ...project, id: newProjectId() })
    migrated += 1
  }
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* quota/security errors are non-fatal here */
  }
  return migrated
}
