/**
 * Non-destructive slice treatment — source layer survives; fragments are removable artifacts.
 */
import { FabricImage, type Canvas, type FabricObject } from 'fabric'
import { createCutFragments, type CutFragment } from './editorModel'
import { createSeededRandom } from './random'
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

export async function renderSliceTreatment(
  canvas: Canvas,
  source: FabricObject,
  treatment: Treatment,
  tagFragment: SliceFragmentTagger,
) {
  removeSliceFragments(canvas, treatment.id)

  if (!treatment.enabled) {
    return
  }

  const sourceId = String(readSliceProp(source, 'id') ?? 'layer')
  const bounds = source.getBoundingRect()
  const direction = sliceDirectionFromParams(treatment.params)
  const pieces = treatment.params.pieces ?? 5
  const gap = treatment.params.gap ?? 9
  const fragments = createCutFragments(
    {
      id: sourceId,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    },
    { pieces, gap, direction },
  )

  const imageUrl = source.toDataURL({ format: 'png', multiplier: 1 })
  const cropped = await cropFragments(imageUrl, fragments)
  const random = createSeededRandom(treatment.seed)
  const baseOpacity = source.opacity ?? 1

  for (const [index, url] of cropped.entries()) {
    const fragment = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
    const frame = fragments[index]
    const angleJitter = (index % 2 === 0 ? -1 : 1) * (2 + random() * 2)
    fragment.set({
      left: frame.left,
      top: frame.top,
      angle: angleJitter,
      opacity: baseOpacity,
      [SLICE_SOURCE_ID_KEY]: sourceId,
      [SLICE_TREATMENT_ID_KEY]: treatment.id,
    } as Partial<FabricObject>)
    tagFragment(fragment, index)
    canvas.add(fragment)
  }

  hideSliceSource(source)
}
