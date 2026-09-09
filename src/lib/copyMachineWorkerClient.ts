import { applyCopyMachineChain, type CopyMachineChainStep } from './copyMachine'
import {
  cloneImageDataPixels,
  imageDataFromJobPixels,
  type CopyMachineJobRequest,
  type CopyMachineJobResult,
} from './copyMachineJob'

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
): Promise<ImageData> {
  const host = acquireWorker()
  if (!host) {
    return applyCopyMachineChain(sourceImageData, treatments, exportScale, tensionScale)
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
  }

  return new Promise((resolve, reject) => {
    pending.set(request.id, { resolve, reject })
    host.postMessage(request, [request.pixels])
  })
}
