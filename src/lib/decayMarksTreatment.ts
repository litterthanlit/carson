/**
 * Non-destructive decay marks — ink-loss chips and fold creases live on the stack.
 * Source stays editable; fragments are companions re-rendered from seed + Tension.
 */
import { Rect, type Canvas, type FabricObject } from 'fabric'
import { createLayerDecayMarks, type LayerDecayMark, type SliceSource } from './editorModel'
import { scaleInstrumentParams } from './instrumentTension'
import { createSeededRandom } from './random'
import { readSliceProp } from './sliceTreatment'
import type { Treatment } from './treatments'

export const DECAY_MARK_SOURCE_ID_KEY = 'decayMarkSourceId'
export const DECAY_MARK_TREATMENT_ID_KEY = 'decayMarkTreatmentId'

export type DecayMarkKind = 'ink-loss' | 'fold' | 'all'

const TENSION_KEYS = ['amount'] as const

export function decayMarkKindFromParams(params: Record<string, number>): DecayMarkKind {
  if (params.kind === 1) return 'fold'
  if (params.kind === 2) return 'all'
  return 'ink-loss'
}

export function decayMarkKindToParam(kind: DecayMarkKind): number {
  if (kind === 'fold') return 1
  if (kind === 'all') return 2
  return 0
}

export function isDecayMarkCompanionLayer(object: FabricObject | Record<string, unknown>): boolean {
  const record = object as unknown as Record<string, unknown>
  return Boolean(record[DECAY_MARK_SOURCE_ID_KEY])
}

export function findDecayMarkFragments(canvas: Canvas, treatmentId: string): FabricObject[] {
  return canvas
    .getObjects()
    .filter((object) => readSliceProp(object, DECAY_MARK_TREATMENT_ID_KEY) === treatmentId)
}

export function removeDecayMarkFragments(canvas: Canvas, treatmentId: string) {
  for (const fragment of findDecayMarkFragments(canvas, treatmentId)) {
    canvas.remove(fragment)
  }
}

export function removeDecayMarkFragmentsForSource(canvas: Canvas, sourceId: string) {
  for (const object of canvas.getObjects()) {
    if (readSliceProp(object, DECAY_MARK_SOURCE_ID_KEY) === sourceId) {
      canvas.remove(object)
    }
  }
}

export function stripDecayMarkFragments(canvas: Canvas) {
  for (const object of [...canvas.getObjects()]) {
    if (isDecayMarkCompanionLayer(object)) canvas.remove(object)
  }
}

export function omitDecayMarkFragmentsFromCanvasJSON<T extends { objects?: unknown[] }>(json: T): T {
  if (!Array.isArray(json.objects)) return json
  return {
    ...json,
    objects: json.objects.filter((object) => {
      if (!object || typeof object !== 'object') return true
      const record = object as Record<string, unknown>
      return !record[DECAY_MARK_SOURCE_ID_KEY]
    }),
  }
}

export function decayMarksForTreatment(
  source: SliceSource,
  treatment: Treatment,
  tensionScale = 1,
): LayerDecayMark[] {
  const kind = decayMarkKindFromParams(treatment.params)
  const params = scaleInstrumentParams(treatment.params, TENSION_KEYS, tensionScale)
  const marks = createLayerDecayMarks(source, {
    amount: params.amount ?? 55,
    random: createSeededRandom(treatment.seed),
  })
  if (kind === 'all') return marks
  return marks.filter((mark) => mark.kind === kind)
}

export type DecayMarkFragmentTagger = (object: FabricObject, mark: LayerDecayMark, index: number) => void

export function renderDecayMarksTreatment(
  canvas: Canvas,
  source: FabricObject,
  treatment: Treatment,
  tagFragment: DecayMarkFragmentTagger,
  tensionScale = 1,
) {
  removeDecayMarkFragments(canvas, treatment.id)
  if (!treatment.enabled) return

  const sourceId = String(readSliceProp(source, 'id') ?? 'layer')
  const bounds = source.getBoundingRect()
  const marks = decayMarksForTreatment(
    {
      id: sourceId,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    },
    treatment,
    tensionScale,
  )

  marks.forEach((mark, index) => {
    const fragment = new Rect({
      left: mark.left,
      top: mark.top,
      width: mark.width,
      height: mark.height,
      fill: mark.kind === 'ink-loss' ? '#f8f6ef' : '#111111',
      opacity: mark.opacity,
      angle: mark.angle,
      globalCompositeOperation: mark.kind === 'ink-loss' ? 'source-over' : 'multiply',
      selectable: false,
      evented: false,
      [DECAY_MARK_SOURCE_ID_KEY]: sourceId,
      [DECAY_MARK_TREATMENT_ID_KEY]: treatment.id,
    } as Partial<FabricObject>)
    tagFragment(fragment, mark, index)
    canvas.add(fragment)
  })
}
