/**
 * Non-destructive type strips — repeated print bars live on the stack.
 * Source stays editable; fragments are companions re-rendered from seed + Tension.
 * On the poster's press each strip prints as solid as the ink was where it lies.
 */
import { Rect, Textbox, type Canvas, type FabricObject } from 'fabric'
import { createTypeStrips, type TypeStrip } from './editorModel'
import { scaleInstrumentParams } from './instrumentTension'
import { canvasPress, pressInkDensityAt, type Press } from './press'
import { createSeededRandom } from './random'
import { readSliceProp } from './sliceTreatment'
import type { Treatment } from './treatments'

export const TYPE_STRIP_SOURCE_ID_KEY = 'typeStripSourceId'
export const TYPE_STRIP_TREATMENT_ID_KEY = 'typeStripTreatmentId'

const TENSION_KEYS = ['jitter'] as const

export function isTypeStripCompanionLayer(object: FabricObject | Record<string, unknown>): boolean {
  const record = object as unknown as Record<string, unknown>
  return Boolean(record[TYPE_STRIP_SOURCE_ID_KEY])
}

export function findTypeStripFragments(canvas: Canvas, treatmentId: string): FabricObject[] {
  return canvas
    .getObjects()
    .filter((object) => readSliceProp(object, TYPE_STRIP_TREATMENT_ID_KEY) === treatmentId)
}

export function removeTypeStripFragments(canvas: Canvas, treatmentId: string) {
  for (const fragment of findTypeStripFragments(canvas, treatmentId)) {
    canvas.remove(fragment)
  }
}

export function removeTypeStripFragmentsForSource(canvas: Canvas, sourceId: string) {
  for (const object of canvas.getObjects()) {
    if (readSliceProp(object, TYPE_STRIP_SOURCE_ID_KEY) === sourceId) {
      canvas.remove(object)
    }
  }
}

export function stripTypeStripFragments(canvas: Canvas) {
  for (const object of [...canvas.getObjects()]) {
    if (isTypeStripCompanionLayer(object)) canvas.remove(object)
  }
}

export function omitTypeStripFragmentsFromCanvasJSON<T extends { objects?: unknown[] }>(json: T): T {
  if (!Array.isArray(json.objects)) return json
  return {
    ...json,
    objects: json.objects.filter((object) => {
      if (!object || typeof object !== 'object') return true
      const record = object as Record<string, unknown>
      return !record[TYPE_STRIP_SOURCE_ID_KEY]
    }),
  }
}

export function typeStripsForTreatment(
  source: { id: string; text: string; left: number; top: number; width: number; height: number },
  treatment: Treatment,
  tensionScale = 1,
): TypeStrip[] {
  const params = scaleInstrumentParams(treatment.params, TENSION_KEYS, tensionScale)
  const height = Math.max(12, params.height ?? 18)
  const minWidth = params.minWidth ?? source.width
  return createTypeStrips(
    {
      id: source.id,
      text: source.text,
      left: source.left,
      top: source.top + source.height + 18,
      width: Math.max(source.width, minWidth),
    },
    {
      rows: params.rows ?? 5,
      height,
      gap: params.gap ?? 4,
      jitter: params.jitter ?? 12,
      random: createSeededRandom(treatment.seed),
    },
  )
}

export type TypeStripFragmentTagger = (object: FabricObject, strip: TypeStrip, part: 'block' | 'label') => void

/**
 * Opacity of a strip's ink — the black bar when inverted, the lettering when
 * not; paper is paper either way. 0.96 off the press, as before.
 */
export function typeStripInkOpacity(strip: Pick<TypeStrip, 'left' | 'top' | 'width' | 'height'>, press: Press | null): number {
  if (!press) return 0.96
  return 0.96 * pressInkDensityAt(press, strip.left + strip.width / 2, strip.top + strip.height / 2)
}

export function renderTypeStripsTreatment(
  canvas: Canvas,
  source: FabricObject,
  treatment: Treatment,
  tagFragment: TypeStripFragmentTagger,
  tensionScale = 1,
) {
  removeTypeStripFragments(canvas, treatment.id)
  if (!treatment.enabled || source.type !== 'textbox') return

  const sourceId = String(readSliceProp(source, 'id') ?? 'type')
  const bounds = source.getBoundingRect()
  const strips = typeStripsForTreatment(
    {
      id: sourceId,
      text: String(readSliceProp(source, 'text') ?? 'TYPE STRIP'),
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    },
    treatment,
    tensionScale,
  )

  const press = canvasPress(canvas)
  strips.forEach((strip) => {
    const ink = typeStripInkOpacity(strip, press)
    const block = new Rect({
      left: strip.left,
      top: strip.top,
      width: strip.width,
      height: strip.height,
      fill: strip.inverted ? '#111111' : '#f8f6ef',
      angle: strip.angle,
      opacity: strip.inverted ? ink : 0.96,
      selectable: false,
      evented: false,
      [TYPE_STRIP_SOURCE_ID_KEY]: sourceId,
      [TYPE_STRIP_TREATMENT_ID_KEY]: treatment.id,
    } as Partial<FabricObject>)
    tagFragment(block, strip, 'block')

    const label = new Textbox(strip.text, {
      left: strip.left + 6,
      top: strip.top + 3,
      width: strip.width - 12,
      height: strip.height,
      fontFamily: 'Arial Black',
      fontSize: Math.max(10, strip.height * 0.58),
      fontWeight: 900,
      charSpacing: -20,
      fill: strip.inverted ? '#f8f6ef' : '#111111',
      angle: strip.angle,
      // Dry ink lets the paper through; knocked-out lettering is paper already.
      opacity: strip.inverted || !press ? 1 : ink / 0.96,
      selectable: false,
      evented: false,
      [TYPE_STRIP_SOURCE_ID_KEY]: sourceId,
      [TYPE_STRIP_TREATMENT_ID_KEY]: treatment.id,
    } as Partial<FabricObject>)
    tagFragment(label, strip, 'label')
    canvas.add(block, label)
  })
}
