/**
 * True CMYK plate separations from an RGB raster (Horizon 2.6 leftover).
 * Each plate is 8-bit ink coverage: 0 = paper, 255 = solid ink.
 */
import { rgbToCmyk } from './cmykPreview'

export const PLATE_CHANNELS = ['cyan', 'magenta', 'yellow', 'black'] as const
export type PlateChannel = (typeof PLATE_CHANNELS)[number]
export const PLATE_PDF_MAX_EDGE = 2048

export type CmykPlateSet = {
  width: number
  height: number
  cyan: Uint8ClampedArray
  magenta: Uint8ClampedArray
  yellow: Uint8ClampedArray
  black: Uint8ClampedArray
}

export const PLATE_LABELS: Record<PlateChannel, string> = {
  cyan: 'Cyan',
  magenta: 'Magenta',
  yellow: 'Yellow',
  black: 'Black',
}

export function plateRasterScale(width: number, height: number, requestedScale: number) {
  const longest = Math.max(width, height)
  if (longest <= 0) return 1
  const cap = PLATE_PDF_MAX_EDGE / longest
  return Math.max(0.05, Math.min(requestedScale, cap))
}

export function rgbaToCmykPlates(rgba: Uint8ClampedArray, width: number, height: number): CmykPlateSet {
  const count = width * height
  const cyan = new Uint8ClampedArray(count)
  const magenta = new Uint8ClampedArray(count)
  const yellow = new Uint8ClampedArray(count)
  const black = new Uint8ClampedArray(count)

  for (let pixel = 0, i = 0; pixel < count; pixel += 1, i += 4) {
    const alpha = (rgba[i + 3] ?? 255) / 255
    const cmyk = rgbToCmyk(rgba[i] ?? 0, rgba[i + 1] ?? 0, rgba[i + 2] ?? 0)
    cyan[pixel] = Math.round((cmyk.c / 100) * 255 * alpha)
    magenta[pixel] = Math.round((cmyk.m / 100) * 255 * alpha)
    yellow[pixel] = Math.round((cmyk.y / 100) * 255 * alpha)
    black[pixel] = Math.round((cmyk.k / 100) * 255 * alpha)
  }

  return { width, height, cyan, magenta, yellow, black }
}

/** Paper-white grayscale: solid ink is black, no ink is white. */
export function plateInkToPaperRgba(ink: Uint8ClampedArray): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(ink.length * 4)
  for (let pixel = 0; pixel < ink.length; pixel += 1) {
    const paper = 255 - (ink[pixel] ?? 0)
    const offset = pixel * 4
    rgba[offset] = paper
    rgba[offset + 1] = paper
    rgba[offset + 2] = paper
    rgba[offset + 3] = 255
  }
  return rgba
}

export function plateChannel(plates: CmykPlateSet, channel: PlateChannel) {
  switch (channel) {
    case 'cyan':
      return plates.cyan
    case 'magenta':
      return plates.magenta
    case 'yellow':
      return plates.yellow
    case 'black':
      return plates.black
  }
}

export function plateToDataUrl(width: number, height: number, ink: Uint8ClampedArray) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Plate export failed — no 2d context')
  const image = ctx.createImageData(width, height)
  image.data.set(plateInkToPaperRgba(ink))
  ctx.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}
