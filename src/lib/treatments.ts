/**
 * Non-destructive treatment stacks — Horizon 2.1 core.
 */
import { filters } from 'fabric'
import type { Canvas, FabricImage, FabricObject } from 'fabric'
import { getLayerDecayProfile, getPrintScanProfile } from './editorModel'
import { createSeededRandom } from './random'
import {
  BAD_CROP_SOURCE_ID_KEY,
  BAD_CROP_TREATMENT_ID_KEY,
  removeBadCropFragments,
  removeBadCropFragmentsForSource,
  renderBadCropTreatment,
  type BadCropFragmentTagger,
} from './badCropTreatment'
import {
  CROP_SOURCE_ID_KEY,
  CROP_TREATMENT_ID_KEY,
  cropModeFromParams,
  removeCropFragments,
  removeCropFragmentsForSource,
  renderCropTreatment,
  type CropFragmentTagger,
} from './cropTreatment'
import {
  GLYPH_SOURCE_ID_KEY,
  GLYPH_TREATMENT_ID_KEY,
  removeGlyphFragments,
  removeGlyphFragmentsForSource,
  renderGlyphBreakTreatment,
  type GlyphFragmentTagger,
} from './glyphBreakTreatment'
import {
  removeSliceFragments,
  removeSliceFragmentsForSource,
  renderSliceTreatment,
  restoreSliceSource,
  sliceDirectionFromParams,
  SLICE_SOURCE_ID_KEY,
  SLICE_TREATMENT_ID_KEY,
  type SliceFragmentTagger,
} from './sliceTreatment'
import {
  TEAR_SOURCE_ID_KEY,
  TEAR_TREATMENT_ID_KEY,
  removeTearFragments,
  removeTearFragmentsForSource,
  renderTearTreatment,
  type TearFragmentTagger,
} from './tearTreatment'

export type TreatmentType =
  | 'xerox'
  | 'decay'
  | 'distress'
  | 'scatter'
  | 'slice'
  | 'crop'
  | 'tear'
  | 'bad-crop'
  | 'glyph-break'

export type Treatment = {
  id: string
  type: TreatmentType
  seed: number
  enabled: boolean
  params: Record<string, number>
}

export type TransformBaseline = {
  left: number
  top: number
  angle: number
  scaleX: number
  scaleY: number
  opacity: number
}

const TREATMENT_FILTER_PREFIX = 'carson-'
const ARTIFACT_TYPES = new Set<TreatmentType>(['slice', 'crop', 'tear', 'bad-crop', 'glyph-break'])
const ONE_PER_LAYER = new Set<TreatmentType>(['slice', 'crop', 'tear', 'bad-crop', 'glyph-break'])

const ARTIFACT_SOURCE_KEYS: Partial<Record<TreatmentType, string>> = {
  slice: SLICE_SOURCE_ID_KEY,
  crop: CROP_SOURCE_ID_KEY,
  tear: TEAR_SOURCE_ID_KEY,
  'bad-crop': BAD_CROP_SOURCE_ID_KEY,
  'glyph-break': GLYPH_SOURCE_ID_KEY,
}

const ARTIFACT_TREATMENT_KEYS: Partial<Record<TreatmentType, string>> = {
  slice: SLICE_TREATMENT_ID_KEY,
  crop: CROP_TREATMENT_ID_KEY,
  tear: TEAR_TREATMENT_ID_KEY,
  'bad-crop': BAD_CROP_TREATMENT_ID_KEY,
  'glyph-break': GLYPH_TREATMENT_ID_KEY,
}

export function newTreatmentId(): string {
  return `tx-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export function readTreatments(object: FabricObject | null): Treatment[] {
  if (!object) return []
  const raw = (object as unknown as Record<string, unknown>).treatments
  if (!Array.isArray(raw)) return []
  return raw as Treatment[]
}

export function writeTreatments(object: FabricObject, treatments: Treatment[]) {
  object.set({ treatments } as Partial<FabricObject>)
}

export function readTransformBaseline(object: FabricObject | null): TransformBaseline | null {
  if (!object) return null
  const raw = (object as unknown as Record<string, unknown>).transformBaseline
  if (!raw || typeof raw !== 'object') return null
  return raw as TransformBaseline
}

export function captureTransformBaseline(object: FabricObject): TransformBaseline {
  const baseline: TransformBaseline = {
    left: object.left ?? 0,
    top: object.top ?? 0,
    angle: object.angle ?? 0,
    scaleX: object.scaleX ?? 1,
    scaleY: object.scaleY ?? 1,
    opacity: object.opacity ?? 1,
  }
  object.set({ transformBaseline: baseline } as Partial<FabricObject>)
  return baseline
}

export function addTreatment(
  object: FabricObject,
  type: TreatmentType,
  params: Record<string, number>,
  seed: number,
): Treatment {
  const baseline = readTransformBaseline(object) ?? captureTransformBaseline(object)
  void baseline
  const treatment: Treatment = {
    id: newTreatmentId(),
    type,
    seed,
    enabled: true,
    params,
  }
  const stack = ONE_PER_LAYER.has(type)
    ? [...readTreatments(object).filter((item) => item.type !== type), treatment]
    : [...readTreatments(object), treatment]
  writeTreatments(object, stack)
  return treatment
}

export function removeTreatment(object: FabricObject, treatmentId: string) {
  writeTreatments(
    object,
    readTreatments(object).filter((item) => item.id !== treatmentId),
  )
}

export function updateTreatment(
  object: FabricObject,
  treatmentId: string,
  patch: Partial<Pick<Treatment, 'params' | 'enabled' | 'seed'>>,
) {
  writeTreatments(
    object,
    readTreatments(object).map((item) => (item.id === treatmentId ? { ...item, ...patch } : item)),
  )
}

export function reorderTreatment(object: FabricObject, treatmentId: string, direction: 'up' | 'down') {
  const stack = [...readTreatments(object)]
  const index = stack.findIndex((item) => item.id === treatmentId)
  if (index < 0) return
  const swap = direction === 'up' ? index - 1 : index + 1
  if (swap < 0 || swap >= stack.length) return
  ;[stack[index], stack[swap]] = [stack[swap], stack[index]]
  writeTreatments(object, stack)
}

export function treatmentLabel(treatment: Treatment): string {
  switch (treatment.type) {
    case 'xerox':
      return `Xerox·${treatment.params.generation ?? 5}`
    case 'decay':
      return `Decay·${treatment.params.amount ?? 55}`
    case 'distress':
      return `Distress·${treatment.params.intensity ?? 70}`
    case 'scatter':
      return `Scatter·#${treatment.seed}`
    case 'slice': {
      const axis = sliceDirectionFromParams(treatment.params) === 'vertical' ? 'V' : 'H'
      return `Slice·${axis}·${treatment.params.pieces ?? 5}`
    }
    case 'crop':
      return `Crop·${cropModeFromParams(treatment.params)}`
    case 'tear':
      return `Tear·${treatment.params.pieces ?? 7}`
    case 'bad-crop':
      return `Bad crop·${sliceDirectionFromParams(treatment.params) === 'vertical' ? 'V' : 'H'}`
    case 'glyph-break':
      return `Glyphs·${treatment.params.intensity ?? 70}`
    default:
      return treatment.type
  }
}

export function buildTreatmentFilters(treatments: Treatment[]): filters.BaseFilter<string, Record<string, unknown>>[] {
  const output: filters.BaseFilter<string, Record<string, unknown>>[] = []
  for (const treatment of treatments.filter((item) => item.enabled)) {
    if (treatment.type === 'xerox') {
      const profile = getPrintScanProfile(treatment.params.generation ?? 5)
      output.push(new filters.Grayscale())
      output.push(new filters.Contrast({ contrast: profile.contrast }))
      output.push(new filters.Noise({ noise: profile.noise }))
      output.push(new filters.Blur({ blur: profile.blur }))
    } else if (treatment.type === 'decay') {
      const profile = getLayerDecayProfile(treatment.params.amount ?? 55)
      output.push(new filters.Contrast({ contrast: profile.contrast }))
      output.push(new filters.Noise({ noise: profile.noise }))
      output.push(new filters.Blur({ blur: profile.blur }))
    } else if (treatment.type === 'distress') {
      const intensity = (treatment.params.intensity ?? 70) / 100
      output.push(new filters.Contrast({ contrast: 0.2 + intensity * 0.5 }))
      output.push(new filters.Noise({ noise: 40 + intensity * 180 }))
      output.push(new filters.Blur({ blur: 0.05 + intensity * 0.12 }))
    }
  }
  return output
}

export function applyScatterTransform(object: FabricObject, treatment: Treatment, tensionScale = 1) {
  const baseline = readTransformBaseline(object) ?? captureTransformBaseline(object)
  const random = createSeededRandom(treatment.seed)
  const scale = Math.max(0.1, tensionScale)
  const distance = (treatment.params.distance ?? 46) * scale
  const rotation = (treatment.params.rotation ?? 18) * scale
  const size = (treatment.params.scale ?? 0.14) * scale
  const dx = (random() - 0.5) * distance * 2
  const dy = (random() - 0.5) * distance * 2
  const da = (random() - 0.5) * rotation * 2
  const ds = 1 + (random() - 0.5) * size * 2
  object.set({
    left: baseline.left + dx,
    top: baseline.top + dy,
    angle: baseline.angle + da,
    scaleX: baseline.scaleX * ds,
    scaleY: baseline.scaleY * ds,
  })
}

export function renderTreatmentStack(object: FabricObject, tensionScale = 1) {
  applySyncTreatmentStack(object, tensionScale)
}

function applySyncTreatmentStack(object: FabricObject, tensionScale = 1) {
  const stack = readTreatments(object).filter((item) => item.enabled && !ARTIFACT_TYPES.has(item.type))
  const filterTreatments = stack.filter((item) => item.type !== 'scatter')
  const scatter = stack.find((item) => item.type === 'scatter')

  const baseline = readTransformBaseline(object)
  if (baseline) {
    object.set({
      left: baseline.left,
      top: baseline.top,
      angle: baseline.angle,
      scaleX: baseline.scaleX,
      scaleY: baseline.scaleY,
      opacity: baseline.opacity,
    })
  }
  if (scatter) applyScatterTransform(object, scatter, tensionScale)

  const built = buildTreatmentFilters(filterTreatments)
  const filterable = object as FabricImage
  if (typeof filterable.applyFilters === 'function') {
    const existing = (filterable.filters ?? []).filter(
      (filter) => !String(filter?.type ?? '').startsWith(TREATMENT_FILTER_PREFIX),
    )
    filterable.filters = [...existing, ...built]
    filterable.applyFilters()
  }

  for (const treatment of filterTreatments) {
    if (treatment.type === 'xerox') {
      const profile = getPrintScanProfile(treatment.params.generation ?? 5)
      object.set({ opacity: profile.opacity, globalCompositeOperation: 'multiply' })
    } else if (treatment.type === 'decay') {
      const profile = getLayerDecayProfile(treatment.params.amount ?? 55)
      object.set({ opacity: profile.opacity, globalCompositeOperation: 'multiply' })
    }
  }

  object.setCoords()
}

function cleanupOrphanedArtifactFragments(canvas: Canvas, source: FabricObject) {
  const sourceId = String((source as unknown as Record<string, unknown>).id ?? '')
  const activeIds = new Set(readTreatments(source).map((item) => item.id))
  for (const object of canvas.getObjects()) {
    const record = object as unknown as Record<string, unknown>
    for (const type of ARTIFACT_TYPES) {
      const sourceKey = ARTIFACT_SOURCE_KEYS[type]
      const treatmentKey = ARTIFACT_TREATMENT_KEYS[type]
      if (!sourceKey || !treatmentKey) continue
      const artifactSourceId = record[sourceKey]
      const artifactTreatmentId = record[treatmentKey]
      if (artifactSourceId === sourceId && artifactTreatmentId && !activeIds.has(String(artifactTreatmentId))) {
        canvas.remove(object)
      }
    }
  }
}

function removeAllArtifactsForSource(canvas: Canvas, sourceId: string) {
  removeSliceFragmentsForSource(canvas, sourceId)
  removeCropFragmentsForSource(canvas, sourceId)
  removeTearFragmentsForSource(canvas, sourceId)
  removeBadCropFragmentsForSource(canvas, sourceId)
  removeGlyphFragmentsForSource(canvas, sourceId)
}

export type ArtifactFragmentTaggers = {
  slice: SliceFragmentTagger
  crop: CropFragmentTagger
  tear: TearFragmentTagger
  badCrop: BadCropFragmentTagger
  glyph: GlyphFragmentTagger
}

export async function renderTreatmentStackOnCanvas(
  canvas: Canvas,
  object: FabricObject,
  taggers: ArtifactFragmentTaggers,
  tensionScale = 1,
) {
  applySyncTreatmentStack(object, tensionScale)

  const sourceId = String((object as unknown as Record<string, unknown>).id ?? '')
  const treatments = readTreatments(object)
  const enabledArtifacts = treatments.some((item) => ARTIFACT_TYPES.has(item.type) && item.enabled)

  cleanupOrphanedArtifactFragments(canvas, object)

  for (const treatment of treatments.filter((item) => item.type === 'slice')) {
    if (treatment.enabled) await renderSliceTreatment(canvas, object, treatment, taggers.slice)
    else removeSliceFragments(canvas, treatment.id)
  }
  for (const treatment of treatments.filter((item) => item.type === 'crop')) {
    if (treatment.enabled) await renderCropTreatment(canvas, object, treatment, taggers.crop)
    else removeCropFragments(canvas, treatment.id)
  }
  for (const treatment of treatments.filter((item) => item.type === 'tear')) {
    if (treatment.enabled) await renderTearTreatment(canvas, object, treatment, taggers.tear)
    else removeTearFragments(canvas, treatment.id)
  }
  for (const treatment of treatments.filter((item) => item.type === 'bad-crop')) {
    if (treatment.enabled) await renderBadCropTreatment(canvas, object, treatment, taggers.badCrop)
    else removeBadCropFragments(canvas, treatment.id)
  }
  for (const treatment of treatments.filter((item) => item.type === 'glyph-break')) {
    if (treatment.enabled) renderGlyphBreakTreatment(canvas, object, treatment, taggers.glyph)
    else removeGlyphFragments(canvas, treatment.id)
  }

  if (!enabledArtifacts) {
    const baseline = readTransformBaseline(object)
    restoreSliceSource(object, baseline?.opacity ?? 1)
    removeAllArtifactsForSource(canvas, sourceId)
  }

  object.setCoords()
}

export const TREATMENT_SERIALIZE_KEY = 'treatments'
export const BASELINE_SERIALIZE_KEY = 'transformBaseline'
