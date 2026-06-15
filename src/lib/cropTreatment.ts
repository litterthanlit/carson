/**
 * Non-destructive crop treatment — source layer survives; crop fragment is a removable artifact.
 */
import { FabricImage, type Canvas, type FabricObject } from 'fabric'
import { createAggressiveCropFrame, type AggressiveCropMode } from './editorModel'
import { createSeededRandom } from './random'
import {
  cropFragments,
  hideSliceSource,
  readSliceProp,
  restoreSliceSource,
} from './sliceTreatment'
import type { Treatment } from './treatments'

export const CROP_SOURCE_ID_KEY = 'cropSourceId'
export const CROP_TREATMENT_ID_KEY = 'cropTreatmentId'

export function cropModeFromParams(params: Record<string, number>): AggressiveCropMode {
  const mode = params.mode ?? 0
  if (mode === 1) return 'edge'
  if (mode === 2) return 'off-center'
  return 'close'
}

export function cropModeToParam(mode: AggressiveCropMode): number {
  if (mode === 'edge') return 1
  if (mode === 'off-center') return 2
  return 0
}

export function findCropFragments(canvas: Canvas, treatmentId: string): FabricObject[] {
  return canvas.getObjects().filter((object) => readSliceProp(object, CROP_TREATMENT_ID_KEY) === treatmentId)
}

export function removeCropFragments(canvas: Canvas, treatmentId: string) {
  for (const fragment of findCropFragments(canvas, treatmentId)) {
    canvas.remove(fragment)
  }
}

export function removeCropFragmentsForSource(canvas: Canvas, sourceId: string) {
  for (const object of canvas.getObjects()) {
    if (readSliceProp(object, CROP_SOURCE_ID_KEY) === sourceId) {
      canvas.remove(object)
    }
  }
}

export type CropFragmentTagger = (object: FabricObject, treatment: Treatment) => void

export async function renderCropTreatment(
  canvas: Canvas,
  source: FabricObject,
  treatment: Treatment,
  tagFragment: CropFragmentTagger,
) {
  removeCropFragments(canvas, treatment.id)

  if (!treatment.enabled) {
    return
  }

  const sourceId = String(readSliceProp(source, 'id') ?? 'layer')
  const bounds = source.getBoundingRect()
  const mode = cropModeFromParams(treatment.params)
  const frame = createAggressiveCropFrame(
    {
      id: sourceId,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    },
    { mode, random: createSeededRandom(treatment.seed) },
  )

  const imageUrl = source.toDataURL({ format: 'png', multiplier: 1 })
  const [url] = await cropFragments(imageUrl, [frame])
  const fragment = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
  const baseOpacity = source.opacity ?? 1
  const sourceAngle = source.angle ?? 0

  fragment.set({
    left: frame.left,
    top: frame.top,
    angle: sourceAngle + (mode === 'edge' ? -2 : mode === 'off-center' ? 3 : 0),
    opacity: baseOpacity,
    globalCompositeOperation: mode === 'close' ? 'source-over' : 'multiply',
    [CROP_SOURCE_ID_KEY]: sourceId,
    [CROP_TREATMENT_ID_KEY]: treatment.id,
  } as Partial<FabricObject>)
  tagFragment(fragment, treatment)
  canvas.add(fragment)

  hideSliceSource(source)
}

export { restoreSliceSource as restoreCropSource }
