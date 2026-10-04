/**
 * Non-destructive slice treatment — source layer survives; hand-cut pieces are removable artifacts.
 */
import type { Canvas, FabricObject } from 'fabric'
import type { CutFragment } from './editorModel'
import { renderPaperCut } from './paperCutRender'
import type { Treatment } from './treatments'

export const SLICE_SOURCE_ID_KEY = 'sliceSourceId'
export const SLICE_TREATMENT_ID_KEY = 'sliceTreatmentId'

export type SliceDirection = 'horizontal' | 'vertical'

export function sliceDirectionFromParams(params: Record<string, number>): SliceDirection {
  return (params.direction ?? 0) === 1 ? 'vertical' : 'horizontal'
}

export function sliceDirectionToParam(direction: SliceDirection): number {
  return direction === 'vertical' ? 1 : 0
}

export function readSliceProp(object: FabricObject | null, key: string): unknown {
  if (!object) return undefined
  return (object as unknown as Record<string, unknown>)[key]
}

export function cropFragments(imageUrl: string, fragments: CutFragment[]) {
  return new Promise<string[]>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const output = fragments.map((fragment) => {
        const crop = document.createElement('canvas')
        crop.width = Math.max(1, Math.round(fragment.width))
        crop.height = Math.max(1, Math.round(fragment.height))
        const context = crop.getContext('2d')
        context?.drawImage(
          image,
          fragment.clipLeft,
          fragment.clipTop,
          fragment.width,
          fragment.height,
          0,
          0,
          fragment.width,
          fragment.height,
        )
        return crop.toDataURL('image/png')
      })
      resolve(output)
    }
    image.onerror = reject
    image.src = imageUrl
  })
}

export function findSliceFragments(canvas: Canvas, treatmentId: string): FabricObject[] {
  return canvas.getObjects().filter((object) => readSliceProp(object, SLICE_TREATMENT_ID_KEY) === treatmentId)
}

export function removeSliceFragments(canvas: Canvas, treatmentId: string) {
  for (const fragment of findSliceFragments(canvas, treatmentId)) {
    canvas.remove(fragment)
  }
}

export function removeSliceFragmentsForSource(canvas: Canvas, sourceId: string) {
  for (const object of canvas.getObjects()) {
    if (readSliceProp(object, SLICE_SOURCE_ID_KEY) === sourceId) {
      canvas.remove(object)
    }
  }
}

export function hideSliceSource(object: FabricObject) {
  object.set({
    opacity: 0,
    evented: false,
  } as Partial<FabricObject>)
  object.setCoords()
}

export function restoreSliceSource(object: FabricObject, fallbackOpacity = 1) {
  object.set({
    opacity: fallbackOpacity,
    evented: true,
  } as Partial<FabricObject>)
  object.setCoords()
}

export type SliceFragmentTagger = (object: FabricObject, index: number) => void

/**
 * Slice: a scalpel through the layer, strips or columns. The lines are hand-cut
 * (a degree off, a slight bow), shared by neighbouring strips so nothing goes
 * missing, and each strip slides a few millimetres along its cut.
 */
export async function renderSliceTreatment(
  canvas: Canvas,
  source: FabricObject,
  treatment: Treatment,
  tagFragment: SliceFragmentTagger,
  pxPerMm = 11.8,
) {
  removeSliceFragments(canvas, treatment.id)
  if (!treatment.enabled) return
  const gap = treatment.params.gap ?? 9
  renderPaperCut(
    canvas,
    source,
    treatment,
    {
      style: 'scalpel',
      direction: sliceDirectionFromParams(treatment.params),
      pieces: treatment.params.pieces ?? 5,
      separationMm: gap * 0.12,
      slideMm: 2 + gap * 0.5,
      turnDeg: 1.5,
    },
    { sourceKey: SLICE_SOURCE_ID_KEY, treatmentKey: SLICE_TREATMENT_ID_KEY },
    tagFragment,
    pxPerMm,
  )
}
