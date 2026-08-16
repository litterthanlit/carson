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
