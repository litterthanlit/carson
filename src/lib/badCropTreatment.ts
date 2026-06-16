/**
 * Non-destructive bad-crop accident — 3 slices, middle gap removed, source survives.
 */
import { FabricImage, type Canvas, type FabricObject } from 'fabric'
import { createCutFragments } from './editorModel'
import { createSeededRandom } from './random'
import {
  cropFragments,
  hideSliceSource,
  readSliceProp,
  sliceDirectionFromParams,
  sliceDirectionToParam,
} from './sliceTreatment'
import type { Treatment } from './treatments'

export const BAD_CROP_SOURCE_ID_KEY = 'badCropSourceId'
export const BAD_CROP_TREATMENT_ID_KEY = 'badCropTreatmentId'

export { sliceDirectionFromParams, sliceDirectionToParam }

export function findBadCropFragments(canvas: Canvas, treatmentId: string): FabricObject[] {
  return canvas.getObjects().filter((object) => readSliceProp(object, BAD_CROP_TREATMENT_ID_KEY) === treatmentId)
}

export function removeBadCropFragments(canvas: Canvas, treatmentId: string) {
  for (const fragment of findBadCropFragments(canvas, treatmentId)) {
    canvas.remove(fragment)
  }
}

export function removeBadCropFragmentsForSource(canvas: Canvas, sourceId: string) {
  for (const object of canvas.getObjects()) {
    if (readSliceProp(object, BAD_CROP_SOURCE_ID_KEY) === sourceId) {
      canvas.remove(object)
    }
  }
}

export type BadCropFragmentTagger = (object: FabricObject, index: number) => void

export async function renderBadCropTreatment(
  canvas: Canvas,
  source: FabricObject,
  treatment: Treatment,
  tagFragment: BadCropFragmentTagger,
) {
  removeBadCropFragments(canvas, treatment.id)
  if (!treatment.enabled) return

  const sourceId = String(readSliceProp(source, 'id') ?? 'layer')
  const bounds = source.getBoundingRect()
  const direction = sliceDirectionFromParams(treatment.params)
  const gap = treatment.params.gap ?? 16
  const drift = treatment.params.drift ?? 40
  const random = createSeededRandom(treatment.seed)

  const fragments = createCutFragments(
    {
      id: sourceId,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    },
    { pieces: 3, gap, direction },
  )

  const imageUrl = source.toDataURL({ format: 'png', multiplier: 1 })
  const cropped = await cropFragments(imageUrl, fragments)
  const baseOpacity = source.opacity ?? 1

  for (const [index, url] of cropped.entries()) {
    if (index === 1) continue
    const fragment = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
    const frame = fragments[index]
    const driftScale = drift * (0.35 + random() * 0.15)
    fragment.set({
      left: frame.left + (index === 0 ? -driftScale : driftScale),
      top: frame.top + (index === 0 ? driftScale * 0.4 : -driftScale * 0.4),
      angle: index === 0 ? -4 : 5,
      opacity: baseOpacity,
      globalCompositeOperation: 'multiply',
      [BAD_CROP_SOURCE_ID_KEY]: sourceId,
      [BAD_CROP_TREATMENT_ID_KEY]: treatment.id,
    } as Partial<FabricObject>)
    tagFragment(fragment, index)
    canvas.add(fragment)
  }

  hideSliceSource(source)
}
