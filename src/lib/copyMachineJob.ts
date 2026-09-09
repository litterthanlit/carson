import {
  applyCopyMachineChain,
  type CopyMachineChainStep,
} from './copyMachine'

export type CopyMachineJobRequest = {
  id: string
  width: number
  height: number
  pixels: ArrayBuffer
  treatments: CopyMachineChainStep[]
  exportScale: number
  tensionScale: number
}

export type CopyMachineJobResult = {
  id: string
  width: number
  height: number
  pixels: ArrayBuffer
}

export function cloneImageDataPixels(imageData: ImageData): ArrayBuffer {
  return imageData.data.slice().buffer
}

export function imageDataFromJobPixels(pixels: ArrayBuffer, width: number, height: number): ImageData {
  return new ImageData(new Uint8ClampedArray(pixels), width, height)
}

export function runCopyMachineJob(request: CopyMachineJobRequest): CopyMachineJobResult {
  const source = imageDataFromJobPixels(request.pixels, request.width, request.height)
  const output = applyCopyMachineChain(source, request.treatments, request.exportScale, request.tensionScale)
  return {
    id: request.id,
    width: output.width,
    height: output.height,
    pixels: cloneImageDataPixels(output),
  }
}
