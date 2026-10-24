/**
 * Non-destructive decay marks — ink-loss chips and fold creases live on the stack.
 * Source stays editable; fragments are companions re-rendered from seed + Tension.
 * On the poster's press they are the sheet's own: its folds crease every layer
 * at the same lines, and ink flakes off where the sheet is most worn.
 */
import { Rect, type Canvas, type FabricObject } from 'fabric'
import { createLayerDecayMarks, getLayerDecayProfile, type LayerDecayMark, type SliceSource } from './editorModel'
import { canvasPress, pressFolds, pressWearChips, type Press } from './press'
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
  press?: Press | null,
): LayerDecayMark[] {
  const kind = decayMarkKindFromParams(treatment.params)
  const params = scaleInstrumentParams(treatment.params, TENSION_KEYS, tensionScale)
  const amount = params.amount ?? 55
  const marks = press
    ? sheetDecayMarks(source, amount, press)
    : createLayerDecayMarks(source, {
        amount,
        random: createSeededRandom(treatment.seed),
      })
  if (kind === 'all') return marks
  return marks.filter((mark) => mark.kind === kind)
}

/**
 * The sheet's decay where this layer lies: a crease for each fold of the
 * sheet that crosses it, and chips at its most worn spots.
 */
export function sheetDecayMarks(source: SliceSource, amount: number, press: Press): LayerDecayMark[] {
  const progress = getLayerDecayProfile(amount).amount / 100
  const marks: LayerDecayMark[] = []
  const right = source.left + source.width
  const bottom = source.top + source.height
  const round = (value: number) => Math.round(value * 100) / 100
  pressWearChips(press, source, progress).forEach((chip, index) => {
    marks.push({
      id: `${source.id}-ink-loss-${index + 1}`,
      kind: 'ink-loss',
      left: round(chip.x - chip.width / 2),
      top: round(chip.y - chip.height / 2),
      width: round(chip.width),
      height: round(chip.height),
      angle: round(chip.angle),
      opacity: round(0.5 + progress * 0.35),
    })
  })
  pressFolds(press).forEach((fold, index) => {
    const tilt = Math.tan((fold.angle * Math.PI) / 180)
    if (fold.axis === 'y') {
      // A crease across the sheet: where it meets this layer's left edge.
      const top = fold.position + (source.left - press.width / 2) * tilt
      const mid = fold.position + (source.left + source.width / 2 - press.width / 2) * tilt
      if (mid < source.top || mid > bottom) return
      marks.push({
        id: `${source.id}-fold-${index + 1}`,
        kind: 'fold',
        left: round(source.left),
        top: round(top),
        width: round(source.width),
        height: 2,
        angle: round(fold.angle),
        opacity: round(0.12 + progress * 0.22),
      })
    } else {
      const left = fold.position + (source.top - press.height / 2) * tilt
      const mid = fold.position + (source.top + source.height / 2 - press.height / 2) * tilt
      if (mid < source.left || mid > right) return
      marks.push({
        id: `${source.id}-fold-${index + 1}`,
        kind: 'fold',
        left: round(left),
        top: round(source.top),
        width: 2,
        height: round(source.height),
        angle: round(-fold.angle),
        opacity: round(0.12 + progress * 0.22),
      })
    }
  })
  return marks
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
    canvasPress(canvas),
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
