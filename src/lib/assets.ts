/**
 * Visual asset library — IndexedDB blobs with thumbnails (Horizon 2.8).
 */

export type StoredAsset = {
  id: string
  name: string
  mimeType: string
  dataUrl: string
  thumbnail: string
  savedAt: string
}

const DB_NAME = 'carson-assets'
const DB_VERSION = 1
const STORE = 'assets'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open asset database'))
  })
  return dbPromise
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Asset transaction failed'))
  })
}

export function newAssetId() {
  return `asset-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export async function listAssets(): Promise<StoredAsset[]> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readonly')
  const request = tx.objectStore(STORE).getAll()
  await txDone(tx)
  return (request.result as StoredAsset[]).sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

export async function saveAsset(asset: StoredAsset): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).put(asset)
  await txDone(tx)
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).delete(id)
  await txDone(tx)
}

export async function createThumbnail(dataUrl: string, maxSize = 96): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    image.onerror = reject
    image.src = dataUrl
  })
}
