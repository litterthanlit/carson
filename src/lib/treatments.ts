/**
 * Non-destructive treatment stacks — Horizon 2.1 core.
 */
import { filters } from 'fabric'
import type { Canvas, FabricImage, FabricObject } from 'fabric'
import { getLayerDecayProfile } from './editorModel'
import {
  buildFxFilters,
  fxChipLabel,
  isFxKind,
  isTreatmentFilter,
  markTreatmentFilter,
  type FxKind,
} from './pixelFilters'
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
import {
  copierChain,
  usesCopier,
  findCopyMachineGhost,
  findCopyMachineRender,
  removeCopyMachineCompanions,
  renderCopyMachineTreatment,
  restoreCopyMachineSource,
} from './copyMachineTreatment'
import {
  DECAY_MARK_SOURCE_ID_KEY,
  DECAY_MARK_TREATMENT_ID_KEY,
  decayMarkKindFromParams,
  removeDecayMarkFragments,
  removeDecayMarkFragmentsForSource,
  renderDecayMarksTreatment,
  type DecayMarkFragmentTagger,
} from './decayMarksTreatment'
import {
  MISPRINT_SOURCE_ID_KEY,
  MISPRINT_TREATMENT_ID_KEY,
  removeMisprintFragments,
  removeMisprintFragmentsForSource,
  renderMisprintTreatment,
  type MisprintFragmentTagger,
} from './misprintTreatment'
import {
  TYPE_STRIP_SOURCE_ID_KEY,
  TYPE_STRIP_TREATMENT_ID_KEY,
  removeTypeStripFragments,
  removeTypeStripFragmentsForSource,
  renderTypeStripsTreatment,
  type TypeStripFragmentTagger,
} from './typeStripsTreatment'
import {
  LETTER_BREAK_SOURCE_ID_KEY,
  LETTER_BREAK_TREATMENT_ID_KEY,
  removeLetterBreakPieces,
  removeLetterBreakPiecesForSource,
  renderLetterBreakTreatment,
  type LetterBreakTagger,
} from './letterBreakTreatment'
import {
  TAPE_LIFT_SOURCE_ID_KEY,
  TAPE_LIFT_TREATMENT_ID_KEY,
  removeTapeLiftCompanions,
  removeTapeLiftCompanionsForSource,
  renderTapeLiftTreatment,
  type TapeLiftTagger,
} from './tapeLiftTreatment'
import { scaleTreatmentParams } from './instruments'
import { markLiveArtifactsFresh } from './liveArtifacts'
import { handShove } from './hand'

export type TreatmentType =
  | 'xerox'
  | 'decay'
  | 'decay-marks'
  | 'distress'
  | 'scatter'
  | 'cold-wash'
  | 'slice'
  | 'crop'
  | 'tear'
  | 'bad-crop'
  | 'glyph-break'
  | 'letter-break'
  | 'tape-lift'
  | 'scrape'
  | 'press-check'
  | 'copy-machine'
  | 'misprint'
  | 'type-strips'
  | 'fx'

export type Treatment = {
  id: string
  type: TreatmentType
  seed: number
  enabled: boolean
  params: Record<string, number>
  fxKind?: FxKind
}

export type TransformBaseline = {
  left: number
  top: number
  angle: number
  scaleX: number
  scaleY: number
  opacity: number
}

const ARTIFACT_TYPES = new Set<TreatmentType>([
  'slice',
  'crop',
  'tear',
  'bad-crop',
  'glyph-break',
  'letter-break',
  'tape-lift',
  'decay-marks',
  'misprint',
  'type-strips',
])
const ONE_PER_LAYER = new Set<TreatmentType>(['slice', 'crop', 'tear', 'bad-crop', 'glyph-break', 'letter-break', 'tape-lift', 'type-strips'])

const ARTIFACT_SOURCE_KEYS: Partial<Record<TreatmentType, string>> = {
  slice: SLICE_SOURCE_ID_KEY,
  crop: CROP_SOURCE_ID_KEY,
  tear: TEAR_SOURCE_ID_KEY,
  'bad-crop': BAD_CROP_SOURCE_ID_KEY,
  'glyph-break': GLYPH_SOURCE_ID_KEY,
  'letter-break': LETTER_BREAK_SOURCE_ID_KEY,
  'tape-lift': TAPE_LIFT_SOURCE_ID_KEY,
  'decay-marks': DECAY_MARK_SOURCE_ID_KEY,
  misprint: MISPRINT_SOURCE_ID_KEY,
  'type-strips': TYPE_STRIP_SOURCE_ID_KEY,
}

const ARTIFACT_TREATMENT_KEYS: Partial<Record<TreatmentType, string>> = {
  slice: SLICE_TREATMENT_ID_KEY,
  crop: CROP_TREATMENT_ID_KEY,
  tear: TEAR_TREATMENT_ID_KEY,
  'bad-crop': BAD_CROP_TREATMENT_ID_KEY,
  'glyph-break': GLYPH_TREATMENT_ID_KEY,
  'letter-break': LETTER_BREAK_TREATMENT_ID_KEY,
  'tape-lift': TAPE_LIFT_TREATMENT_ID_KEY,
  'decay-marks': DECAY_MARK_TREATMENT_ID_KEY,
  misprint: MISPRINT_TREATMENT_ID_KEY,
  'type-strips': TYPE_STRIP_TREATMENT_ID_KEY,
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

/** Rewrite pose on an existing baseline so treatments re-apply from the new composition. */
export function patchTransformBaseline(
  object: FabricObject,
  pose: Pick<TransformBaseline, 'left' | 'top' | 'angle'> & Partial<Pick<TransformBaseline, 'scaleX' | 'scaleY'>>,
): TransformBaseline | null {
  const current = readTransformBaseline(object)
  if (!current) return null
  const baseline: TransformBaseline = {
    ...current,
    left: pose.left,
    top: pose.top,
    angle: pose.angle,
    scaleX: pose.scaleX ?? current.scaleX,
    scaleY: pose.scaleY ?? current.scaleY,
  }
  object.set({ transformBaseline: baseline } as Partial<FabricObject>)
  return baseline
}

export function addTreatment(
  object: FabricObject,
  type: TreatmentType,
  params: Record<string, number>,
  seed: number,
  extras?: { fxKind?: FxKind },
): Treatment {
  const baseline = readTransformBaseline(object) ?? captureTransformBaseline(object)
  void baseline
  const treatment: Treatment = {
    id: newTreatmentId(),
    type,
    seed,
    enabled: true,
    params,
    fxKind: extras?.fxKind,
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
    case 'decay-marks': {
      const kind = decayMarkKindFromParams(treatment.params)
      const amount = treatment.params.amount ?? 55
      if (kind === 'fold') return `Fold·${amount}`
      if (kind === 'all') return `Wear·${amount}`
      return `Ink loss·${amount}`
    }
    case 'distress':
      return `Distress·${treatment.params.intensity ?? 70}`
    case 'scatter':
      return `Scatter·#${treatment.seed}`
    case 'cold-wash':
      return 'Cold wash'
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
    case 'letter-break':
      return `Letter break·#${treatment.seed}`
    case 'tape-lift':
      return `Tape lift·#${treatment.seed}`
    case 'scrape':
      return `Scrape·${treatment.params.count ?? 7}`
    case 'press-check':
      return 'Press Check'
    case 'copy-machine':
      return `Copy·#${treatment.seed}`
    case 'misprint':
      return `Misprint·${treatment.params.offset ?? 10}`
    case 'type-strips':
      return `Type strip·${treatment.params.rows ?? 5}`
    case 'fx':
      return fxChipLabel(treatment.fxKind, treatment.params)
    default:
      return treatment.type
  }
}

export function buildTreatmentFilters(
  treatments: Treatment[],
  tensionScale = 1,
): filters.BaseFilter<string, object>[] {
  const output: filters.BaseFilter<string, object>[] = []
  for (const treatment of treatments.filter((item) => item.enabled)) {
    const params = scaleTreatmentParams(treatment.type, treatment.params, tensionScale)
    // Xerox isn't a filter any more: it runs through the copier (see copierChain).
    if (treatment.type === 'decay') {
      const profile = getLayerDecayProfile(params.amount ?? 55)
      output.push(markTreatmentFilter(new filters.Contrast({ contrast: profile.contrast })))
      output.push(markTreatmentFilter(new filters.Noise({ noise: profile.noise })))
      output.push(markTreatmentFilter(new filters.Blur({ blur: profile.blur })))
    } else if (treatment.type === 'distress') {
      const intensity = (params.intensity ?? 70) / 100
      output.push(markTreatmentFilter(new filters.Contrast({ contrast: 0.2 + intensity * 0.5 })))
      output.push(markTreatmentFilter(new filters.Noise({ noise: 40 + intensity * 180 })))
      output.push(markTreatmentFilter(new filters.Blur({ blur: 0.05 + intensity * 0.12 })))
    } else if (treatment.type === 'cold-wash') {
      output.push(markTreatmentFilter(new filters.Grayscale()))
      output.push(markTreatmentFilter(new filters.Contrast({ contrast: 0.42 })))
      output.push(markTreatmentFilter(new filters.BlendColor({ color: '#2f6f8f', mode: 'tint', alpha: 0.22 })))
      output.push(markTreatmentFilter(new filters.Noise({ noise: 85 })))
    } else if (treatment.type === 'fx' && isFxKind(treatment.fxKind)) {
      output.push(...buildFxFilters(treatment.fxKind, params))
    }
  }
  return output
}

/**
 * Scatter is a hand shoving the piece across the table: it slides a few
 * millimetres (now and then further), turns more the further it went, and
 * keeps its size. `distance` and `rotation` are the stored strengths; the old
 * `scale` param is ignored — hands don't resize paper.
 */
export function applyScatterTransform(object: FabricObject, treatment: Treatment, tensionScale = 1, pxPerMm = 11.8) {
  const baseline = readTransformBaseline(object) ?? captureTransformBaseline(object)
  const random = createSeededRandom(treatment.seed)
  const strength = Math.max(0.1, tensionScale)
  const reachMm = (treatment.params.distance ?? 46) * 0.4 * strength
  const turn = (treatment.params.rotation ?? 18) * strength
  const shove = handShove(random, reachMm, turn, pxPerMm)
  object.set({
    left: baseline.left + shove.dx,
    top: baseline.top + shove.dy,
    angle: baseline.angle + shove.angle,
    scaleX: baseline.scaleX,
    scaleY: baseline.scaleY,
  })
}

export function renderTreatmentStack(object: FabricObject, tensionScale = 1, pxPerMm = 11.8) {
  applySyncTreatmentStack(object, tensionScale, pxPerMm)
}

function applySyncTreatmentStack(object: FabricObject, tensionScale = 1, pxPerMm = 11.8) {
  const stack = readTreatments(object).filter((item) => item.enabled && !ARTIFACT_TYPES.has(item.type))
  const filterTreatments = stack.filter(
    (item) => item.type !== 'scatter' && item.type !== 'copy-machine' && item.type !== 'xerox',
  )
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
  if (scatter) applyScatterTransform(object, scatter, tensionScale, pxPerMm)

  const built = buildTreatmentFilters(filterTreatments, tensionScale)
  const filterable = object as FabricImage
  if (typeof filterable.applyFilters === 'function') {
    const existing = (filterable.filters ?? []).filter((filter) => !isTreatmentFilter(filter))
    filterable.filters = [...existing, ...built]
    filterable.applyFilters()
  }

  for (const treatment of filterTreatments) {
    const params = scaleTreatmentParams(treatment.type, treatment.params, tensionScale)
    if (treatment.type === 'decay') {
      const profile = getLayerDecayProfile(params.amount ?? 55)
      object.set({ opacity: profile.opacity, globalCompositeOperation: 'multiply' })
    } else if (treatment.type === 'cold-wash') {
      object.set({ opacity: 0.92, globalCompositeOperation: 'multiply' })
    }
  }

  object.setCoords()
}

function cleanupOrphanedCopyMachineRenders(canvas: Canvas, source: FabricObject) {
  const sourceId = String((source as unknown as Record<string, unknown>).id ?? '')
  const hasCopyMachine = usesCopier(readTreatments(source))
  const render = findCopyMachineRender(canvas, sourceId)
  const ghost = findCopyMachineGhost(canvas, sourceId)
  if (!hasCopyMachine && (render || ghost)) {
    removeCopyMachineCompanions(canvas, sourceId)
    restoreCopyMachineSource(source)
  }
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
  removeLetterBreakPiecesForSource(canvas, sourceId)
  removeTapeLiftCompanionsForSource(canvas, sourceId)
  removeDecayMarkFragmentsForSource(canvas, sourceId)
  removeMisprintFragmentsForSource(canvas, sourceId)
  removeTypeStripFragmentsForSource(canvas, sourceId)
}

export type ArtifactFragmentTaggers = {
  slice: SliceFragmentTagger
  crop: CropFragmentTagger
  tear: TearFragmentTagger
  badCrop: BadCropFragmentTagger
  glyph: GlyphFragmentTagger
  letterBreak: LetterBreakTagger
  tapeLift: TapeLiftTagger
  decayMarks: DecayMarkFragmentTagger
  misprint: MisprintFragmentTagger
  typeStrips: TypeStripFragmentTagger
}

export async function renderTreatmentStackOnCanvas(
  canvas: Canvas,
  object: FabricObject,
  taggers: ArtifactFragmentTaggers,
  tensionScale = 1,
  /** Poster px per millimetre: physical sizes (tape lift texture, scatter drift, misfeed). */
  pxPerMm = 11.8,
  /** Poster width, for things that pivot about the sheet (the press's gripper edge). */
  sheetWidth?: number,
) {
  applySyncTreatmentStack(object, tensionScale, pxPerMm)

  const sourceId = String((object as unknown as Record<string, unknown>).id ?? '')
  const treatments = readTreatments(object)
  const enabledArtifacts = treatments.some((item) => ARTIFACT_TYPES.has(item.type) && item.enabled)

  cleanupOrphanedArtifactFragments(canvas, object)
  cleanupOrphanedCopyMachineRenders(canvas, object)

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
  for (const treatment of treatments.filter((item) => item.type === 'letter-break')) {
    if (treatment.enabled) renderLetterBreakTreatment(canvas, object, treatment, taggers.letterBreak)
    else removeLetterBreakPieces(canvas, treatment.id)
  }
  for (const treatment of treatments.filter((item) => item.type === 'tape-lift')) {
    const paper = typeof canvas.backgroundColor === 'string' ? canvas.backgroundColor : undefined
    if (treatment.enabled) renderTapeLiftTreatment(canvas, object, treatment, taggers.tapeLift, paper, pxPerMm)
    else removeTapeLiftCompanions(canvas, treatment.id)
  }
  for (const treatment of treatments.filter((item) => item.type === 'decay-marks')) {
    if (treatment.enabled) renderDecayMarksTreatment(canvas, object, treatment, taggers.decayMarks, tensionScale)
    else removeDecayMarkFragments(canvas, treatment.id)
  }
  for (const treatment of treatments.filter((item) => item.type === 'misprint')) {
    if (treatment.enabled) await renderMisprintTreatment(canvas, object, treatment, taggers.misprint, tensionScale, pxPerMm, sheetWidth)
    else removeMisprintFragments(canvas, treatment.id)
  }
  for (const treatment of treatments.filter((item) => item.type === 'type-strips')) {
    if (treatment.enabled) renderTypeStripsTreatment(canvas, object, treatment, taggers.typeStrips, tensionScale)
    else removeTypeStripFragments(canvas, treatment.id)
  }

  const copyMachineTreatments = copierChain(treatments)
  if (copyMachineTreatments.length > 0) {
    await renderCopyMachineTreatment(canvas, object, copyMachineTreatments, 1, tensionScale)
  } else {
    const copySourceId = String((object as unknown as Record<string, unknown>).id ?? '')
    removeCopyMachineCompanions(canvas, copySourceId)
    // Another artifact treatment (slice, letter break, …) may be hiding the source on purpose.
    if (!enabledArtifacts) restoreCopyMachineSource(object)
  }

  if (!enabledArtifacts) {
    const baseline = readTransformBaseline(object)
    restoreSliceSource(object, baseline?.opacity ?? 1)
    removeAllArtifactsForSource(canvas, sourceId)
  }

  markLiveArtifactsFresh(object)
  object.setCoords()
}

export const TREATMENT_SERIALIZE_KEY = 'treatments'
export const BASELINE_SERIALIZE_KEY = 'transformBaseline'
