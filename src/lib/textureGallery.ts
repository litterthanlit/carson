import { TEXTURE_ASSETS as GENERATED } from './textureCatalog.generated'

export type TextureCategory =
  | 'print'
  | 'ink'
  | 'grunge'
  | 'paper'
  | 'surface'
  | 'lens'
  | 'photocopy'
  | 'found'

export type TextureFit = 'cover' | 'layer'

export type TextureAsset = {
  id: string
  name: string
  category: TextureCategory
  src: string
  thumb: string
  hasAlpha: boolean
  defaultBlend: string
  defaultOpacity: number
}

export const TEXTURE_CATEGORIES: { id: TextureCategory; label: string }[] = [
  { id: 'print', label: 'Print' },
  { id: 'ink', label: 'Ink' },
  { id: 'grunge', label: 'Grunge' },
  { id: 'paper', label: 'Paper' },
  { id: 'photocopy', label: 'Photocopy' },
  { id: 'surface', label: 'Surface' },
  { id: 'lens', label: 'Lens' },
  { id: 'found', label: 'Found' },
]

export const TEXTURE_BLEND_MODES: { value: string; label: string }[] = [
  { value: 'multiply', label: 'Multiply' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'soft-light', label: 'Soft light' },
  { value: 'screen', label: 'Screen' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'source-over', label: 'Normal' },
]

export const TEXTURE_ASSETS: TextureAsset[] = GENERATED as unknown as TextureAsset[]

export function texturesForCategory(category: TextureCategory): TextureAsset[] {
  return TEXTURE_ASSETS.filter((texture) => texture.category === category)
}

export function textureById(id: string): TextureAsset | undefined {
  return TEXTURE_ASSETS.find((texture) => texture.id === id)
}

export function populatedTextureCategories() {
  return TEXTURE_CATEGORIES.filter((category) => texturesForCategory(category.id).length > 0)
}

export function textureUrl(path: string) {
  const base = import.meta.env.BASE_URL
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${prefix}${path.replace(/^\//, '')}`
}

export function coverScale(imageWidth: number, imageHeight: number, posterWidth: number, posterHeight: number) {
  const width = imageWidth > 0 ? imageWidth : 1
  const height = imageHeight > 0 ? imageHeight : 1
  return Math.max(posterWidth / width, posterHeight / height)
}

export function layerScale(imageWidth: number, imageHeight: number, posterWidth: number, posterHeight: number) {
  const width = imageWidth > 0 ? imageWidth : 1
  const height = imageHeight > 0 ? imageHeight : 1
  const maxWidth = posterWidth * 0.72
  const maxHeight = posterHeight * 0.6
  return Math.min(1, maxWidth / width, maxHeight / height)
}

export type TextureTransform = { left: number; top: number; scale: number; angle: number }

/**
 * Where a placed texture sits, in poster units. The canvas placement and the gallery preview
 * both use this, so the preview shows exactly what Place texture produces.
 */
export function texturePlacementTransform(
  fit: TextureFit,
  imageWidth: number,
  imageHeight: number,
  posterWidth: number,
  posterHeight: number,
): TextureTransform {
  if (fit === 'cover') {
    const scale = coverScale(imageWidth, imageHeight, posterWidth, posterHeight)
    return {
      left: (posterWidth - imageWidth * scale) / 2,
      top: (posterHeight - imageHeight * scale) / 2,
      scale,
      angle: 0,
    }
  }
  return {
    left: posterWidth * 0.12,
    top: posterHeight * 0.2,
    scale: layerScale(imageWidth, imageHeight, posterWidth, posterHeight),
    angle: -2,
  }
}

/**
 * Luminosity weights of Fabric's `Grayscale({ mode: 'luminosity' })`, which Place texture
 * applies for Monochrome; the preview desaturates with the same formula.
 */
export function grayscaleLuminosity(data: Uint8ClampedArray) {
  for (let index = 0; index < data.length; index += 4) {
    const value = 0.21 * (data[index] ?? 0) + 0.72 * (data[index + 1] ?? 0) + 0.07 * (data[index + 2] ?? 0)
    data[index] = value
    data[index + 1] = value
    data[index + 2] = value
  }
}
