import { FabricImage, type FabricObject } from 'fabric'
import { createThumbnail } from './assets'
import { getLayerDecayProfile, getPrintScanProfile } from './editorModel'
import type { FilterPreset } from './filterGallery'
import { paramsForTreatment } from './filterGallery'
import {
  applyScatterTransform,
  buildTreatmentFilters,
  captureTransformBaseline,
  type Treatment,
} from './treatments'

const PREVIEW_SEED = 42
const previewCache = new Map<string, string>()

function cacheKey(objectId: string, presetId: string, params: Record<string, number>, size: number) {
  return `${objectId}:${presetId}:${JSON.stringify(params)}:${size}`
}

export function clearFilterPreviewCache() {
  previewCache.clear()
}

export function invalidateFilterPreviewForObject(objectId: string) {
  for (const key of previewCache.keys()) {
    if (key.startsWith(`${objectId}:`)) previewCache.delete(key)
  }
}

function syntheticTreatment(preset: FilterPreset, params: Record<string, number>): Treatment {
  return {
    id: 'preview',
    type: preset.treatmentType,
    seed: PREVIEW_SEED,
    enabled: true,
    params,
  }
}

function applyTreatmentVisuals(image: FabricImage, treatment: Treatment, params: Record<string, number>) {
  if (treatment.type === 'xerox') {
    const profile = getPrintScanProfile(params.generation ?? 5)
    image.set({ opacity: profile.opacity, globalCompositeOperation: 'multiply' })
  } else if (treatment.type === 'decay') {
    const profile = getLayerDecayProfile(params.amount ?? 55)
    image.set({ opacity: profile.opacity, globalCompositeOperation: 'multiply' })
  } else if (treatment.type === 'cold-wash') {
    image.set({ opacity: 0.92, globalCompositeOperation: 'multiply' })
  }
}

export async function renderFilterPreview(
  source: FabricObject,
  preset: FilterPreset,
  paramOverrides: Record<string, number> = {},
  maxSize = 320,
): Promise<string> {
  const objectId = String((source as unknown as Record<string, unknown>).id ?? 'unknown')
  const params = paramsForTreatment(preset, paramOverrides)
  const key = cacheKey(objectId, preset.id, params, maxSize)
  const cached = previewCache.get(key)
  if (cached) return cached

  const dataUrl = source.toDataURL({ format: 'png', multiplier: 0.35 })
  const image = await FabricImage.fromURL(dataUrl, { crossOrigin: 'anonymous' })
  const treatment = syntheticTreatment(preset, params)

  if (preset.treatmentType === 'scatter') {
    captureTransformBaseline(image)
    applyScatterTransform(image, treatment, 1)
  } else {
    const built = buildTreatmentFilters([treatment])
    if (built.length > 0) {
      image.filters = built
      image.applyFilters()
    }
    applyTreatmentVisuals(image, treatment, params)
  }

  const raw = image.toDataURL({ format: 'jpeg', quality: 0.82 })
  const thumb = await createThumbnail(raw, maxSize)
  previewCache.set(key, thumb)
  return thumb
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}
