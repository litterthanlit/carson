import { applyCopyMachineChain, type CopyMachineChainStep } from './copyMachine'
import {
  cloneImageDataPixels,
  imageDataFromJobPixels,
  type CopyMachineJobRequest,
  type CopyMachineJobResult,
} from './copyMachineJob'
import type { SheetPatch } from './press'

type PendingJob = {
  resolve: (imageData: ImageData) => void
  reject: (error: Error) => void
}

let worker: Worker | null = null
let workerUnavailable = typeof Worker === 'undefined'
let jobSerial = 0
const pending = new Map<string, PendingJob>()

function failPending(error: Error) {
  for (const job of pending.values()) job.reject(error)
  pending.clear()
}

function handleWorkerMessage(event: MessageEvent<CopyMachineJobResult>) {
  const job = pending.get(event.data.id)
  if (!job) return
  pending.delete(event.data.id)
  job.resolve(imageDataFromJobPixels(event.data.pixels, event.data.width, event.data.height))
}

function acquireWorker(): Worker | null {
  if (workerUnavailable) return null
  if (worker) return worker
  try {
    const next = new Worker(new URL('./copyMachine.worker.ts', import.meta.url), { type: 'module' })
    next.addEventListener('message', handleWorkerMessage)
    next.addEventListener('error', () => {
      workerUnavailable = true
      worker = null
      failPending(new Error('Copy Machine worker failed'))
    })
    worker = next
    return next
  } catch {
    workerUnavailable = true
    return null
  }
}

export function copyMachineWorkerAvailable(): boolean {
  return acquireWorker() !== null
}

export function terminateCopyMachineWorker() {
  worker?.terminate()
  worker = null
  failPending(new Error('Copy Machine worker terminated'))
}

export async function applyCopyMachineChainAsync(
  sourceImageData: ImageData,
  treatments: CopyMachineChainStep[],
  exportScale = 1,
  tensionScale = 1,
  sheet?: SheetPatch,
): Promise<ImageData> {
  const host = acquireWorker()
  if (!host) {
    return applyCopyMachineChain(sourceImageData, treatments, exportScale, tensionScale, sheet)
  }

  const request: CopyMachineJobRequest = {
    id: `cm-${(jobSerial += 1)}`,
    width: sourceImageData.width,
    height: sourceImageData.height,
    pixels: cloneImageDataPixels(sourceImageData),
    treatments: treatments.map((treatment) => ({
      seed: treatment.seed,
      enabled: treatment.enabled,
      params: { ...treatment.params },
    })),
    exportScale,
    tensionScale,
    sheet,
  }

  return new Promise((resolve, reject) => {
    pending.set(request.id, { resolve, reject })
    host.postMessage(request, [request.pixels])
  })
}

/**
 * Latest-wins runner, one task at a time per key. While a key's task runs,
 * only the newest request waits behind it; the ones it replaced resolve null
 * without running. The running task is never cut short, so its caller decides
 * whether its result is still wanted.
 */
export function createLatestPerKey<T>() {
  const newest = new Map<string, number>()
  const running = new Map<string, Promise<unknown>>()
  return async function run(key: string, task: () => Promise<T>): Promise<T | null> {
    const ticket = (newest.get(key) ?? 0) + 1
    newest.set(key, ticket)
    while (running.has(key)) {
      await running.get(key)?.catch(() => undefined)
      if (newest.get(key) !== ticket) return null
    }
    if (newest.get(key) !== ticket) return null
    const job = task()
    running.set(key, job)
    try {
      return await job
    } finally {
      if (running.get(key) === job) running.delete(key)
    }
  }
}

const latestBake = createLatestPerKey<ImageData>()

/**
 * Bake for one layer, dropping requests a newer one replaced before they ran.
 * A slider dragged across a slow bake queues one job, not one per step.
 * Resolves null when superseded.
 */
export function applyCopyMachineChainLatest(
  key: string,
  sourceImageData: ImageData,
  treatments: CopyMachineChainStep[],
  exportScale = 1,
  tensionScale = 1,
  sheet?: SheetPatch,
): Promise<ImageData | null> {
  return latestBake(key, () =>
    applyCopyMachineChainAsync(sourceImageData, treatments, exportScale, tensionScale, sheet),
  )
}
