/**
 * Non-destructive misprint — the sheet went through the press twice and didn't
 * land in the same place. The second impression is the same ink at full
 * density, shifted a fraction of a millimetre (mostly along the feed) and
 * turned a hair about the gripper edge: a doubled, heavier print with a thin
 * fringe — not a faint drop shadow.
 * Source stays editable; the companion is re-rendered from seed + Tension.
 */
import type { Canvas, FabricObject } from 'fabric'
import { round } from './canvasUtils'
import { pressMisfeed } from './hand'
import { getPrintScanProfile } from './editorModel'
import { scaleInstrumentParams } from './instrumentTension'
import { createSeededRandom } from './random'
import { readSliceProp } from './sliceTreatment'
import type { Treatment } from './treatments'

export const MISPRINT_SOURCE_ID_KEY = 'misprintSourceId'
export const MISPRINT_TREATMENT_ID_KEY = 'misprintTreatmentId'

const TENSION_KEYS = ['offset'] as const

export function misprintParamsFromGeneration(generation: number): {
  generation: number
  offset: number
  opacity: number
} {
  const profile = getPrintScanProfile(generation)
  return {
    generation: profile.generation,
    offset: profile.misregistration,
    opacity: round(0.18 + profile.generation * 0.018),
  }
}

export function isMisprintCompanionLayer(object: FabricObject | Record<string, unknown>): boolean {
  const record = object as unknown as Record<string, unknown>
  return Boolean(record[MISPRINT_SOURCE_ID_KEY])
}

export function findMisprintFragments(canvas: Canvas, treatmentId: string): FabricObject[] {
  return canvas
    .getObjects()
    .filter((object) => readSliceProp(object, MISPRINT_TREATMENT_ID_KEY) === treatmentId)
}

export function removeMisprintFragments(canvas: Canvas, treatmentId: string) {
  for (const fragment of findMisprintFragments(canvas, treatmentId)) {
    canvas.remove(fragment)
  }
}

export function removeMisprintFragmentsForSource(canvas: Canvas, sourceId: string) {
  for (const object of canvas.getObjects()) {
    if (readSliceProp(object, MISPRINT_SOURCE_ID_KEY) === sourceId) {
      canvas.remove(object)
    }
  }
}

export function stripMisprintFragments(canvas: Canvas) {
  for (const object of [...canvas.getObjects()]) {
    if (isMisprintCompanionLayer(object)) canvas.remove(object)
  }
}

export function omitMisprintFragmentsFromCanvasJSON<T extends { objects?: unknown[] }>(json: T): T {
  if (!Array.isArray(json.objects)) return json
  return {
    ...json,
    objects: json.objects.filter((object) => {
      if (!object || typeof object !== 'object') return true
      const record = object as Record<string, unknown>
      return !record[MISPRINT_SOURCE_ID_KEY]
    }),
  }
}

/** Stored offset (3–18, from the generation) → millimetres of misfeed. */
export function misprintOffsetMm(offset: number): number {
  return Math.max(0, offset) * 0.08
}

export function misprintPoseForTreatment(
  source: { left: number; top: number; angle: number },
  treatment: Treatment,
  tensionScale = 1,
  pxPerMm = 11.8,
  sheetWidth = source.left * 2,
) {
  const params = scaleInstrumentParams(treatment.params, TENSION_KEYS, tensionScale)
  const random = createSeededRandom(treatment.seed)
  const landed = pressMisfeed(random, { x: source.left, y: source.top }, misprintOffsetMm(params.offset ?? 10), pxPerMm, sheetWidth)
  return {
    left: landed.x,
    top: landed.y,
    angle: source.angle + landed.angle,
    // Ink is ink: the second hit prints as dense as the first.
    opacity: 0.88,
    globalCompositeOperation: 'multiply' as const,
  }
}

export type MisprintFragmentTagger = (object: FabricObject) => void

export async function renderMisprintTreatment(
  canvas: Canvas,
  source: FabricObject,
  treatment: Treatment,
  tagFragment: MisprintFragmentTagger,
  tensionScale = 1,
  pxPerMm = 11.8,
  sheetWidth?: number,
) {
  removeMisprintFragments(canvas, treatment.id)
  if (!treatment.enabled) return

  const sourceId = String(readSliceProp(source, 'id') ?? 'layer')
  const pose = misprintPoseForTreatment(
    {
      left: source.left ?? 0,
      top: source.top ?? 0,
      angle: source.angle ?? 0,
    },
    treatment,
    tensionScale,
    pxPerMm,
    sheetWidth,
  )
  const clone = await source.clone()
  clone.set({
    ...pose,
    treatments: [],
    transformBaseline: undefined,
    layerMask: undefined,
    selectable: false,
    evented: false,
    [MISPRINT_SOURCE_ID_KEY]: sourceId,
    [MISPRINT_TREATMENT_ID_KEY]: treatment.id,
  } as Partial<FabricObject>)
  tagFragment(clone)
  const sourceIndex = canvas.getObjects().indexOf(source)
  canvas.add(clone)
  if (sourceIndex >= 0) canvas.moveObjectTo(clone, sourceIndex)
}
