import { FabricImage, StaticCanvas, type FabricObject } from 'fabric'
import { getLayerDecayProfile, getPrintScanProfile } from './editorModel'
import type { FilterPreset } from './filterGallery'
import { paramsForTreatment } from './filterGallery'
import type { FxKind } from './pixelFilters'
import {
  applyScatterTransform,
  buildTreatmentFilters,
  captureTransformBaseline,
  type Treatment,
} from './treatments'

const PREVIEW_SEED = 42
/** Type and shapes are snapshotted at this multiplier before fx run (see `rasterizeLayer.ts`). */
export const SNAPSHOT_MULTIPLIER = 2
const MIN_MULTIPLIER = 0.02
const MAX_MULTIPLIER = 2

/** Fx params measured in raster pixels. Everything else is relative to the layer or unitless. */
const PIXEL_PARAMS: Partial<Record<FxKind, readonly string[]>> = {
  'motion-blur': ['distance'],
  pixelate: ['blocksize'],
  halftone: ['blocksize'],
}

/** Treatments that composite with multiply on the canvas; the preview image should too. */
const MULTIPLY_TREATMENTS = new Set<Treatment['type']>(['xerox', 'decay', 'cold-wash'])

type SourceRaster = { element: HTMLImageElement; multiplier: number; pixelRatio: number }

const previewCache = new Map<string, string>()
const sourceCache = new Map<string, Promise<SourceRaster>>()

export function clearFilterPreviewCache() {
  previewCache.clear()
  sourceCache.clear()
}

export function invalidateFilterPreviewForObject(objectId: string) {
  for (const cache of [previewCache, sourceCache]) {
    for (const key of cache.keys()) {
      if (key.startsWith(`${objectId}:`)) cache.delete(key)
    }
  }
}

/** Multiplier that renders a layer's bounds at `targetPx` on the long side. */
export function previewMultiplier(boundsWidth: number, boundsHeight: number, targetPx: number) {
  const longSide = Math.max(boundsWidth, boundsHeight, 1)
  return Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, targetPx / longSide))
}

/**
 * Preview pixels per applied-filter pixel. Image layers filter their own element, so one poster
 * unit holds `1 / scaleX` element pixels; everything else is snapshotted at SNAPSHOT_MULTIPLIER.
 */
export function previewPixelRatio(multiplier: number, isImage: boolean, scaleX: number) {
  const appliedPerUnit = isImage ? 1 / Math.max(Math.abs(scaleX), 1e-6) : SNAPSHOT_MULTIPLIER
  return multiplier / appliedPerUnit
}

/** Scale pixel-measured params so the preview blurs as far, relative to the layer, as the result. */
export function scalePreviewParams(
  fxKind: FxKind | undefined,
  params: Record<string, number>,
  pixelRatio: number,
): Record<string, number> {
  const keys = fxKind ? PIXEL_PARAMS[fxKind] : undefined
  if (!keys) return params
  const scaled = { ...params }
  for (const key of keys) {
    const value = scaled[key]
    if (value !== undefined) scaled[key] = value * pixelRatio
  }
  return scaled
}

export function previewBlendMode(preset: FilterPreset): 'multiply' | undefined {
  return MULTIPLY_TREATMENTS.has(preset.treatmentType) ? 'multiply' : undefined
}

function objectIdOf(source: FabricObject) {
  return String((source as unknown as Record<string, unknown>).id ?? 'unknown')
}

function loadElement(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = reject
    element.src = url
  })
}

/** Rasterize the layer once per size; every preset preview reuses the same pixels. */
function sourceRaster(source: FabricObject, targetPx: number): Promise<SourceRaster> {
  const key = `${objectIdOf(source)}:${targetPx}`
  const cached = sourceCache.get(key)
  if (cached) return cached
  const bounds = source.getBoundingRect()
  const multiplier = previewMultiplier(bounds.width, bounds.height, targetPx)
  const pixelRatio = previewPixelRatio(multiplier, source.type === 'image', source.scaleX ?? 1)
  const pending = loadElement(source.toDataURL({ format: 'png', multiplier })).then((element) => ({
    element,
    multiplier,
    pixelRatio,
  }))
  pending.catch(() => sourceCache.delete(key))
  sourceCache.set(key, pending)
  return pending
}

/**
 * The layer with no filter, as a PNG data URL, for the before/after toggle. It is the raster every
 * preset preview at `maxSize` is built from, so it costs nothing extra and lines up exactly.
 */
export async function renderOriginalPreview(source: FabricObject, maxSize = 320): Promise<string> {
  return (await sourceRaster(source, maxSize)).element.src
}

function syntheticTreatment(
  type: Treatment['type'],
  params: Record<string, number>,
  fxKind?: FxKind,
): Treatment {
  return { id: 'preview', type, seed: PREVIEW_SEED, enabled: true, params, fxKind }
}

function treatmentOpacity(treatment: Treatment, params: Record<string, number>) {
  if (treatment.type === 'xerox') return getPrintScanProfile(params.generation ?? 5).opacity
  if (treatment.type === 'decay') return getLayerDecayProfile(params.amount ?? 55).opacity
  if (treatment.type === 'cold-wash') return 0.92
  return 1
}

/**
 * Scatter moves the layer, and an object's own toDataURL crops to its bounds, which hides the
 * move. Render into a frame padded for the travel, with a ghost of the original position.
 */
function renderScatterFrame(raster: SourceRaster, params: Record<string, number>) {
  const width = raster.element.naturalWidth
  const height = raster.element.naturalHeight
  const travel = (params.distance ?? 46) * raster.multiplier
  const pad = Math.ceil(travel + Math.max(width, height) * 0.3)
  const frame = new StaticCanvas(undefined, {
    width: width + pad * 2,
    height: height + pad * 2,
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  })
  const ghost = new FabricImage(raster.element, { left: pad, top: pad, opacity: 0.18 })
  const moved = new FabricImage(raster.element, { left: pad, top: pad })
  captureTransformBaseline(moved)
  applyScatterTransform(moved, syntheticTreatment('scatter', { ...params, distance: travel }))
  frame.add(ghost, moved)
  frame.renderAll()
  const url = frame.toDataURL({ format: 'png', multiplier: 1 })
  void frame.dispose()
  return url
}

/**
 * Render `preset` over the layer at `maxSize` px on the long side. Output is PNG so transparent
 * areas stay transparent, and pixel-measured params are scaled to match the applied result.
 */
export async function renderFilterPreview(
  source: FabricObject,
  preset: FilterPreset,
  paramOverrides: Record<string, number> = {},
  maxSize = 320,
): Promise<string> {
  const params = paramsForTreatment(preset, paramOverrides)
  const key = `${objectIdOf(source)}:${maxSize}:${preset.id}:${JSON.stringify(params)}`
  const cached = previewCache.get(key)
  if (cached) return cached

  const raster = await sourceRaster(source, maxSize)
  let url: string
  if (preset.treatmentType === 'scatter') {
    url = renderScatterFrame(raster, params)
  } else {
    const scaled = scalePreviewParams(preset.fxKind, params, raster.pixelRatio)
    const treatment = syntheticTreatment(preset.treatmentType, scaled, preset.fxKind)
    const image = new FabricImage(raster.element)
    const built = buildTreatmentFilters([treatment])
    if (built.length > 0) {
      image.filters = built
      image.applyFilters()
    }
    image.set({ opacity: treatmentOpacity(treatment, scaled) })
    url = image.toDataURL({ format: 'png', multiplier: 1 })
    // Releases this instance's WebGL texture cache; the shared source element stays loaded.
    image.dispose()
  }
  previewCache.set(key, url)
  return url
}

export type Debounced<T extends (...args: never[]) => void> = ((...args: Parameters<T>) => void) & {
  cancel: () => void
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): Debounced<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  const debounced = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, ms)
  }
  debounced.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }
  return debounced
}

/** Give the main thread a turn between heavy synchronous filter passes. */
export function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler
  if (scheduler?.yield) return scheduler.yield()
  return new Promise((resolve) => setTimeout(resolve, 0))
}
