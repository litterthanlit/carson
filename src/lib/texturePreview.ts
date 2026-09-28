import {
  grayscaleLuminosity,
  texturePlacementTransform,
  type TextureFit,
} from './textureGallery'

export type PosterSnapshot = { url: string; width: number; height: number }

export type TexturePreviewSettings = {
  blend: string
  opacity: number
  fit: TextureFit
  monochrome: boolean
}

const PAPER = '#f6f1e6'

/**
 * Composite `texture` over the poster snapshot the way the canvas will: same placement, the
 * blend as a canvas composite operation (Fabric's `globalCompositeOperation`), opacity as
 * global alpha, and Monochrome with the same luminosity formula as the applied filter.
 * `canvas` is sized to the snapshot; `posterWidth/Height` are poster units.
 */
export function drawTexturePreview(
  canvas: HTMLCanvasElement,
  posterImage: HTMLImageElement | null,
  posterWidth: number,
  posterHeight: number,
  texture: HTMLImageElement,
  settings: TexturePreviewSettings,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const k = canvas.width / Math.max(1, posterWidth)

  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  if (posterImage) ctx.drawImage(posterImage, 0, 0, canvas.width, canvas.height)
  ctx.restore()

  const imageWidth = texture.naturalWidth || texture.width || 1
  const imageHeight = texture.naturalHeight || texture.height || 1
  const transform = texturePlacementTransform(settings.fit, imageWidth, imageHeight, posterWidth, posterHeight)
  const drawWidth = Math.max(1, Math.round(imageWidth * transform.scale * k))
  const drawHeight = Math.max(1, Math.round(imageHeight * transform.scale * k))

  // Resample to the drawn size first so desaturating never walks a full-resolution raster.
  const layer = document.createElement('canvas')
  layer.width = drawWidth
  layer.height = drawHeight
  const layerCtx = layer.getContext('2d')
  if (!layerCtx) return
  layerCtx.drawImage(texture, 0, 0, drawWidth, drawHeight)
  if (settings.monochrome) {
    const pixels = layerCtx.getImageData(0, 0, drawWidth, drawHeight)
    grayscaleLuminosity(pixels.data)
    layerCtx.putImageData(pixels, 0, 0)
  }

  ctx.save()
  ctx.globalCompositeOperation = settings.blend as GlobalCompositeOperation
  ctx.globalAlpha = settings.opacity
  ctx.translate(transform.left * k, transform.top * k)
  ctx.rotate((transform.angle * Math.PI) / 180)
  ctx.drawImage(layer, 0, 0)
  ctx.restore()
}
