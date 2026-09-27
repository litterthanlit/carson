type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
}

/**
 * Run background work (autosave, thumbnails) when the main thread is idle, so it
 * never lands in the middle of a drag or a slider scrub. Falls back to a timeout
 * where `requestIdleCallback` is missing (Safari/WKWebView).
 */
export function runWhenIdle(work: () => void, timeout = 2000) {
  const idle = (typeof window !== 'undefined' ? window : undefined) as IdleWindow | undefined
  if (idle?.requestIdleCallback) idle.requestIdleCallback(work, { timeout })
  else setTimeout(work, 0)
}
