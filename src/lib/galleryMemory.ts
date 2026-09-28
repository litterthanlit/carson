import {
  FILTER_CATEGORIES,
  isPresetApplicable,
  presetById,
  presetsForCategory,
  type FilterCategory,
} from './filterGallery'
import {
  TEXTURE_BLEND_MODES,
  textureById,
  texturesForCategory,
  type TextureAsset,
  type TextureCategory,
  type TextureFit,
} from './textureGallery'

/**
 * Remembers where each gallery was left so reopening it continues from there (Photoshop's
 * Filter Gallery reopens on the last filter and settings). Stored in localStorage so it
 * survives reloads; every field is validated on read, so a renamed preset, a removed texture
 * or hand-edited storage falls back to defaults instead of breaking the dialog.
 */

export const FILTER_GALLERY_KEY = 'carson.filterGallery.v1'
export const TEXTURE_GALLERY_KEY = 'carson.textureGallery.v1'

export const TEXTURE_OPACITY_MIN = 8
export const TEXTURE_OPACITY_MAX = 100

export type FilterGalleryState = {
  category: FilterCategory
  presetId: string | null
  params: Record<string, number>
}

export type TextureGalleryState = {
  category: TextureCategory
  textureId: string | null
  blend: string
  opacity: number
  fit: TextureFit
  /** A studio preference, not a per-texture default: it carries across texture changes. */
  monochrome: boolean
}

// Session fallback for when storage is unavailable (private mode, blocked site data).
const sessionMemory = new Map<string, unknown>()

function load(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw)
  } catch {
    // Unavailable or corrupt storage falls through to the session copy.
  }
  return sessionMemory.get(key) ?? null
}

function save(key: string, value: unknown) {
  sessionMemory.set(key, value)
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Quota or privacy settings; the session copy still works.
  }
}

export function clearGalleryMemory() {
  sessionMemory.clear()
  try {
    localStorage.removeItem(FILTER_GALLERY_KEY)
    localStorage.removeItem(TEXTURE_GALLERY_KEY)
  } catch {
    // Nothing to clear.
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function isFilterCategory(value: unknown): value is FilterCategory {
  return FILTER_CATEGORIES.some((item) => item.id === value)
}

function firstPresetId(category: FilterCategory, selectedIsImage: boolean) {
  const presets = presetsForCategory(category)
  return (presets.find((preset) => isPresetApplicable(preset, selectedIsImage)) ?? presets[0])?.id ?? null
}

/** State for a category the user just switched to: its first preset that fits the layer. */
export function filterStateForCategory(category: FilterCategory, selectedIsImage: boolean): FilterGalleryState {
  const presetId = firstPresetId(category, selectedIsImage)
  return { category, presetId, params: { ...(presetId ? presetById(presetId)?.defaultParams : {}) } }
}

/**
 * Where the Filter Gallery opens: the remembered filter and its settings when that filter still
 * exists and fits the selected layer; otherwise the remembered category's first fitting filter.
 */
export function resolveFilterGalleryState(saved: unknown, selectedIsImage: boolean): FilterGalleryState {
  const data = record(saved)
  const preset = typeof data.presetId === 'string' ? presetById(data.presetId) : undefined
  if (!preset || !isPresetApplicable(preset, selectedIsImage)) {
    return filterStateForCategory(isFilterCategory(data.category) ? data.category : 'blur', selectedIsImage)
  }
  const stored = record(data.params)
  const params = { ...preset.defaultParams }
  for (const def of preset.paramDefs) {
    const value = stored[def.key]
    if (typeof value === 'number' && Number.isFinite(value)) params[def.key] = clamp(value, def.min, def.max)
  }
  return { category: preset.category, presetId: preset.id, params }
}

export function loadFilterGalleryState(selectedIsImage: boolean) {
  return resolveFilterGalleryState(load(FILTER_GALLERY_KEY), selectedIsImage)
}

export function saveFilterGalleryState(state: FilterGalleryState) {
  save(FILTER_GALLERY_KEY, state)
}

/** State for a texture the user just picked: that texture's own blend, opacity and fit. */
export function textureDefaults(texture: TextureAsset): Omit<TextureGalleryState, 'category' | 'monochrome'> {
  return {
    textureId: texture.id,
    blend: texture.defaultBlend,
    opacity: Math.round(texture.defaultOpacity * 100),
    fit: texture.hasAlpha ? 'layer' : 'cover',
  }
}

function firstTextureState(category: TextureCategory, monochrome: boolean): TextureGalleryState {
  const first = texturesForCategory(category)[0]
  return first
    ? { category, ...textureDefaults(first), monochrome }
    : { category, textureId: null, blend: 'multiply', opacity: 55, fit: 'cover', monochrome }
}

/**
 * Where the Texture Gallery opens: the remembered texture with the blend, opacity and fit the
 * user last chose for it, as long as the texture is still in a listed category.
 */
export function resolveTextureGalleryState(
  saved: unknown,
  categories: readonly { id: TextureCategory }[],
): TextureGalleryState {
  const data = record(saved)
  const fallbackCategory = categories[0]?.id ?? 'print'
  // Grit reads as tone, not tint: textures default to monochrome until the user opts into color.
  const monochrome = typeof data.monochrome === 'boolean' ? data.monochrome : true
  const texture = typeof data.textureId === 'string' ? textureById(data.textureId) : undefined
  if (!texture || !categories.some((item) => item.id === texture.category)) {
    const category = categories.find((item) => item.id === data.category)?.id ?? fallbackCategory
    return firstTextureState(category, monochrome)
  }
  const defaults = textureDefaults(texture)
  const blend = TEXTURE_BLEND_MODES.some((mode) => mode.value === data.blend) ? String(data.blend) : defaults.blend
  const opacity =
    typeof data.opacity === 'number' && Number.isFinite(data.opacity)
      ? Math.round(clamp(data.opacity, TEXTURE_OPACITY_MIN, TEXTURE_OPACITY_MAX))
      : defaults.opacity
  const fit = data.fit === 'cover' || data.fit === 'layer' ? data.fit : defaults.fit
  return { category: texture.category, textureId: texture.id, blend, opacity, fit, monochrome }
}

export function loadTextureGalleryState(categories: readonly { id: TextureCategory }[]) {
  return resolveTextureGalleryState(load(TEXTURE_GALLERY_KEY), categories)
}

export function saveTextureGalleryState(state: TextureGalleryState) {
  save(TEXTURE_GALLERY_KEY, state)
}

/** Textures whose full-size file failed to load; cleared on reload (e.g. after `npm run import-textures`). */
export const missingTextureIds = new Set<string>()
