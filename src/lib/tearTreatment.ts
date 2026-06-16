/**
 * Non-destructive tear treatment — source survives; torn scraps are removable artifacts.
 */
import { FabricImage, type Canvas, type FabricObject } from 'fabric'
import { createTearFragments } from './editorModel'
import { createSeededRandom } from './random'
import {
  cropFragments,
  hideSliceSource,
  readSliceProp,
} from './sliceTreatment'
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

export async function renderTearTreatment(
  canvas: Canvas,
  source: FabricObject,
  treatment: Treatment,
  tagFragment: TearFragmentTagger,
) {
  removeTearFragments(canvas, treatment.id)
  if (!treatment.enabled) return

  const sourceId = String(readSliceProp(source, 'id') ?? 'layer')
  const bounds = source.getBoundingRect()
  const pieces = treatment.params.pieces ?? 7
  const gap = treatment.params.gap ?? 32
  const fragments = createTearFragments(
    {
      id: sourceId,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    },
    { pieces, gap, random: createSeededRandom(treatment.seed) },
  )

  const imageUrl = source.toDataURL({ format: 'png', multiplier: 1 })
  const cropped = await cropFragments(imageUrl, fragments)
  const baseOpacity = source.opacity ?? 1

  for (const [index, url] of cropped.entries()) {
    const fragment = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
    const frame = fragments[index]
    fragment.set({
      left: frame.left,
      top: frame.top,
      angle: frame.angle,
      opacity: baseOpacity,
      globalCompositeOperation: index % 3 === 0 ? 'multiply' : 'source-over',
      [TEAR_SOURCE_ID_KEY]: sourceId,
      [TEAR_TREATMENT_ID_KEY]: treatment.id,
    } as Partial<FabricObject>)
    tagFragment(fragment, index)
    canvas.add(fragment)
  }

  hideSliceSource(source)
}
