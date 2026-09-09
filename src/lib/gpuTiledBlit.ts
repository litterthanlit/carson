export type BlitBackend = 'webgpu' | 'canvas2d'

export type ExportBlitTile = {
  source: CanvasImageSource
  dx: number
  dy: number
}

export function detectBlitBackend(): BlitBackend {
  if (typeof navigator === 'undefined') return 'canvas2d'
  const gpu = (navigator as Navigator & { gpu?: unknown }).gpu
  return gpu ? 'webgpu' : 'canvas2d'
}

function compositeTilesCanvas2d(
  width: number,
  height: number,
  tiles: ExportBlitTile[],
): HTMLCanvasElement {
  const output = document.createElement('canvas')
  output.width = width
  output.height = height
  const ctx = output.getContext('2d')
  if (!ctx) throw new Error('Export failed — no 2d context')
  for (const tile of tiles) {
    ctx.drawImage(tile.source, tile.dx, tile.dy)
  }
  return output
}

const GPU_TEXTURE_COPY_DST = 0x08
const GPU_TEXTURE_RENDER_ATTACHMENT = 0x10

type GpuCanvasContext = {
  configure: (descriptor: {
    device: GPUDevice
    format: GPUTextureFormat
    alphaMode: 'premultiplied'
    usage: number
  }) => void
  getCurrentTexture: () => GPUTexture
}

async function compositeTilesWebGpu(
  width: number,
  height: number,
  tiles: ExportBlitTile[],
): Promise<HTMLCanvasElement | null> {
  const gpu = (navigator as Navigator & { gpu?: GPU }).gpu
  if (!gpu) return null
  const adapter = await gpu.requestAdapter()
  if (!adapter) return null
  const device = await adapter.requestDevice()
  const maxDim = device.limits.maxTextureDimension2D
  if (width > maxDim || height > maxDim) {
    device.destroy()
    return null
  }

  const output = document.createElement('canvas')
  output.width = width
  output.height = height
  const context = output.getContext('webgpu') as unknown as GpuCanvasContext | null
  if (!context) {
    device.destroy()
    return null
  }

  const format = gpu.getPreferredCanvasFormat()
  context.configure({
    device,
    format,
    alphaMode: 'premultiplied',
    usage: GPU_TEXTURE_RENDER_ATTACHMENT | GPU_TEXTURE_COPY_DST,
  })

  const dest = context.getCurrentTexture()
  for (const tile of tiles) {
    const source = tile.source
    if (!(source instanceof HTMLCanvasElement) && !(source instanceof OffscreenCanvas) && !(source instanceof ImageBitmap)) {
      device.destroy()
      return null
    }
    const tileWidth = 'width' in source ? Number(source.width) : 0
    const tileHeight = 'height' in source ? Number(source.height) : 0
    if (tileWidth < 1 || tileHeight < 1) continue
    device.queue.copyExternalImageToTexture(
      { source },
      { texture: dest, origin: { x: Math.max(0, Math.round(tile.dx)), y: Math.max(0, Math.round(tile.dy)) } },
      { width: tileWidth, height: tileHeight },
    )
  }
  await device.queue.onSubmittedWorkDone()
  device.destroy()
  return output
}

export async function compositeExportTiles(
  width: number,
  height: number,
  tiles: ExportBlitTile[],
  backend: BlitBackend = 'canvas2d',
): Promise<HTMLCanvasElement> {
  if (backend === 'webgpu') {
    try {
      const gpuOutput = await compositeTilesWebGpu(width, height, tiles)
      if (gpuOutput) return gpuOutput
    } catch {
      return compositeTilesCanvas2d(width, height, tiles)
    }
  }
  return compositeTilesCanvas2d(width, height, tiles)
}
