/**
 * Non-destructive tear treatment — source survives; hand-torn pieces are removable artifacts.
 */
import type { Canvas, FabricObject } from 'fabric'
import { renderPaperCut } from './paperCutRender'
import { readSliceProp } from './sliceTreatment'
import type { Treatment } from './treatments'

export const TEAR_SOURCE_ID_KEY = 'tearSourceId'
export const TEAR_TREATMENT_ID_KEY = 'tearTreatmentId'

export function findTearFragments(canvas: Canvas, treatmentId: string): FabricObject[] {
  return canvas.getObjects().filter((object) => readSliceProp(object, TEAR_TREATMENT_ID_KEY) === treatmentId)
}

export function removeTearFragments(canvas: Canvas, treatmentId: string) {
  for (const fragment of findTearFragments(canvas, treatmentId)) {
    canvas.remove(fragment)
  }
}

export function removeTearFragmentsForSource(canvas: Canvas, sourceId: string) {
  for (const object of canvas.getObjects()) {
    if (readSliceProp(object, TEAR_SOURCE_ID_KEY) === sourceId) {
      canvas.remove(object)
    }
  }
}

export type TearFragmentTagger = (object: FabricObject, index: number) => void

/**
 * Tear collage: the layer torn into columns by hand. Each tear is a wandering
 * line a few millimetres deep shared by its two pieces; torn printed paper
 * shows its pale core along the edge; the hand pulls the pieces apart.
 */
export async function renderTearTreatment(
  canvas: Canvas,
  source: FabricObject,
  treatment: Treatment,
  tagFragment: TearFragmentTagger,
  pxPerMm = 11.8,
  paperColor?: string,
) {
  removeTearFragments(canvas, treatment.id)
  if (!treatment.enabled) return
  const gap = treatment.params.gap ?? 32
  renderPaperCut(
    canvas,
    source,
    treatment,
    {
      style: 'tear',
      direction: 'vertical',
      pieces: treatment.params.pieces ?? 7,
      separationMm: gap * 0.08,
      slideMm: gap * 0.15,
      turnDeg: 3.5,
    },
    { sourceKey: TEAR_SOURCE_ID_KEY, treatmentKey: TEAR_TREATMENT_ID_KEY },
    tagFragment,
    pxPerMm,
    paperColor,
  )
}
