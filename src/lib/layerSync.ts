let suppressDepth = 0

export function isLayerSyncSuppressed(): boolean {
  return suppressDepth > 0
}

export function beginSuppressLayerSync() {
  suppressDepth += 1
}

export function endSuppressLayerSync() {
  suppressDepth = Math.max(0, suppressDepth - 1)
}

export function resetLayerSyncSuppress() {
  suppressDepth = 0
}

export async function withLayerSyncSuppressed<T>(fn: () => Promise<T> | T): Promise<T> {
  beginSuppressLayerSync()
  try {
    return await fn()
  } finally {
    endSuppressLayerSync()
  }
}
