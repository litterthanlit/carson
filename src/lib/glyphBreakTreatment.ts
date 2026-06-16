/**
 * Non-destructive glyph-break — source textbox survives; expressive letters are removable artifacts.
 */
import { Textbox, type Canvas, type FabricObject } from 'fabric'
import { createExpressiveGlyphs, type ExpressiveLegibility } from './editorModel'
import { createSeededRandom } from './random'
import { hideSliceSource, readSliceProp } from './sliceTreatment'
import type { Treatment } from './treatments'

export const GLYPH_SOURCE_ID_KEY = 'glyphSourceId'
export const GLYPH_TREATMENT_ID_KEY = 'glyphTreatmentId'

const ACCENTS = ['#e11d48', '#05b6d4', '#f59e0b', '#84cc16']

export function legibilityFromParam(value: number): ExpressiveLegibility {
  if (value === 2) return 'high'
  if (value === 1) return 'medium'
  return 'low'
}

export function legibilityToParam(value: ExpressiveLegibility): number {
  if (value === 'high') return 2
  if (value === 'medium') return 1
  return 0
}

export function findGlyphFragments(canvas: Canvas, treatmentId: string): FabricObject[] {
  return canvas.getObjects().filter((object) => readSliceProp(object, GLYPH_TREATMENT_ID_KEY) === treatmentId)
}

export function removeGlyphFragments(canvas: Canvas, treatmentId: string) {
  for (const fragment of findGlyphFragments(canvas, treatmentId)) {
    canvas.remove(fragment)
  }
}

export function removeGlyphFragmentsForSource(canvas: Canvas, sourceId: string) {
  for (const object of canvas.getObjects()) {
    if (readSliceProp(object, GLYPH_SOURCE_ID_KEY) === sourceId) {
      canvas.remove(object)
    }
  }
}

export type GlyphFragmentTagger = (object: FabricObject, index: number, glyphText: string) => void

export function renderGlyphBreakTreatment(
  canvas: Canvas,
  source: FabricObject,
  treatment: Treatment,
  tagFragment: GlyphFragmentTagger,
) {
  removeGlyphFragments(canvas, treatment.id)
  if (!treatment.enabled || source.type !== 'textbox') return

  const sourceId = String(readSliceProp(source, 'id') ?? 'type')
  const text = String(readSliceProp(source, 'text') ?? '')
  const intensity = treatment.params.intensity ?? 70
  const legibility = legibilityFromParam(treatment.params.legibility ?? 0)
  const glyphs = createExpressiveGlyphs(
    {
      id: sourceId,
      text,
      left: source.left ?? 0,
      top: source.top ?? 0,
      fontSize: Number(readSliceProp(source, 'fontSize') ?? 80),
      charSpacing: Number(readSliceProp(source, 'charSpacing') ?? 0),
    },
    { intensity, legibility, random: createSeededRandom(treatment.seed) },
  )

  const fill = String(readSliceProp(source, 'fill') ?? '#111111')
  const fontFamily = String(readSliceProp(source, 'fontFamily') ?? 'Impact')
  const fontWeight = readSliceProp(source, 'fontWeight') as string | number | undefined
  const baseAngle = source.angle ?? 0

  glyphs.forEach((glyph, index) => {
    const letter = new Textbox(glyph.text, {
      left: glyph.left,
      top: glyph.top,
      width: Math.max(16, glyph.fontSize * 0.9),
      fontFamily,
      fontSize: glyph.fontSize,
      fontWeight,
      fill: index % 7 === 0 && legibility === 'low' ? ACCENTS[index % ACCENTS.length] : fill,
      opacity: glyph.opacity,
      angle: baseAngle + glyph.angle,
      scaleX: glyph.scaleX,
      scaleY: glyph.scaleY,
      charSpacing: -20,
      [GLYPH_SOURCE_ID_KEY]: sourceId,
      [GLYPH_TREATMENT_ID_KEY]: treatment.id,
    } as Partial<FabricObject>)
    tagFragment(letter, index, glyph.text)
    canvas.add(letter)
  })

  hideSliceSource(source)
}
