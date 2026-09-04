/**
 * Press Check as a poster-scoped companion overlay.
 * Sources stay editable; the bake is stripped on save and re-rendered from seed.
 */
import { FabricImage, type Canvas, type FabricObject } from 'fabric'
import type { PosterPreset } from './editorModel'
import {
  pressCheckParamsFromRecord,
  renderPressCheckPass,
  scalePressCheckParams,
} from './pressCheck'
import { createSeededRandom } from './random'
import type { Treatment } from './treatments'

export const PRESS_CHECK_TREATMENT_ID_KEY = 'pressCheckTreatmentId'
export const PRESS_CHECK_FRAGMENT_KEY = 'pressCheckFragment'

export function isPressCheckCompanionLayer(object: unknown): boolean {
  if (!object || typeof object !== 'object') return false
  const record = object as Record<string, unknown>
  return Boolean(record[PRESS_CHECK_TREATMENT_ID_KEY] || record[PRESS_CHECK_FRAGMENT_KEY])
}

export function removePressCheckFragments(canvas: Canvas, treatmentId?: string) {
  for (const object of [...canvas.getObjects()]) {
    const record = object as unknown as Record<string, unknown>
    if (!record[PRESS_CHECK_FRAGMENT_KEY]) continue
    if (treatmentId && record[PRESS_CHECK_TREATMENT_ID_KEY] !== treatmentId) continue
    canvas.remove(object)
  }
}

export function stripPressCheckFragments(canvas: Canvas) {
  removePressCheckFragments(canvas)
}

export function omitPressCheckFragmentsFromCanvasJSON<T extends { objects?: unknown[] }>(json: T): T {
  if (!Array.isArray(json.objects)) return json
  return {
    ...json,
    objects: json.objects.filter((object) => {
      if (!object || typeof object !== 'object') return true
      const record = object as Record<string, unknown>
      return !record[PRESS_CHECK_TREATMENT_ID_KEY] && !record[PRESS_CHECK_FRAGMENT_KEY]
    }),
  }
}

const MAX_PRESS_RASTER = 1280
const MAX_PRESS_EXPORT_RASTER = 2048

function pressCheckRasterSize(
  poster: Pick<PosterPreset, 'width' | 'height'>,
  exportScale: number,
) {
  const destW = Math.max(1, poster.width * Math.max(0.01, exportScale))
  const destH = Math.max(1, poster.height * Math.max(0.01, exportScale))
  const maxEdge = exportScale > 1 ? MAX_PRESS_EXPORT_RASTER : MAX_PRESS_RASTER
  const scale = Math.min(1, maxEdge / Math.max(destW, destH))
  return {
    width: Math.max(1, Math.round(destW * scale)),
    height: Math.max(1, Math.round(destH * scale)),
  }
}

function imageDataToDataUrl(imageData: ImageData): string {
  const element = document.createElement('canvas')
  element.width = imageData.width
  element.height = imageData.height
  const context = element.getContext('2d')
  if (!context) throw new Error('Press Check render failed — no output context')
  context.putImageData(imageData, 0, 0)
  return element.toDataURL('image/png')
}

function snapshotPoster(
  canvas: Canvas,
  poster: Pick<PosterPreset, 'width' | 'height'>,
  rasterWidth: number,
  rasterHeight: number,
): ImageData | null {
  const multiplier = rasterWidth / Math.max(1, poster.width)
  const element = canvas.toCanvasElement(multiplier, {
    left: 0,
    top: 0,
    width: poster.width,
    height: poster.height,
    filter: (object) => !isPressCheckCompanionLayer(object),
  })
  const context = element.getContext('2d')
  if (!context) return null
  if (element.width === rasterWidth && element.height === rasterHeight) {
    return context.getImageData(0, 0, element.width, element.height)
  }
  const fitted = document.createElement('canvas')
  fitted.width = rasterWidth
  fitted.height = rasterHeight
  const fittedCtx = fitted.getContext('2d')
  if (!fittedCtx) return context.getImageData(0, 0, element.width, element.height)
  fittedCtx.drawImage(element, 0, 0, rasterWidth, rasterHeight)
  return fittedCtx.getImageData(0, 0, rasterWidth, rasterHeight)
}

export async function renderPressCheckTreatment(
  canvas: Canvas,
  treatment: Treatment,
  poster: Pick<PosterPreset, 'width' | 'height'>,
  tagObject: (object: FabricObject, name: string) => void,
  tensionScale = 1,
  exportScale = 1,
) {
  removePressCheckFragments(canvas, treatment.id)
  if (!treatment.enabled) return
  if (typeof document === 'undefined') return

  const raster = pressCheckRasterSize(poster, exportScale)
  const snapshot = snapshotPoster(canvas, poster, raster.width, raster.height)
  if (!snapshot) return

  const params = scalePressCheckParams(pressCheckParamsFromRecord(treatment.params), tensionScale)
  const pixelScale = snapshot.width / Math.max(1, poster.width)
  const imageData = renderPressCheckPass(snapshot, params, createSeededRandom(treatment.seed), pixelScale)
  const image = await FabricImage.fromURL(imageDataToDataUrl(imageData), { crossOrigin: 'anonymous' })
  image.set({
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    scaleX: poster.width / Math.max(1, image.width ?? poster.width),
    scaleY: poster.height / Math.max(1, image.height ?? poster.height),
    selectable: false,
    evented: false,
    [PRESS_CHECK_TREATMENT_ID_KEY]: treatment.id,
    [PRESS_CHECK_FRAGMENT_KEY]: true,
  } as Partial<FabricObject>)
  tagObject(image, 'Press Check')
  canvas.add(image)
  canvas.bringObjectToFront(image)
}

export async function rebakePressCheckTreatments(
  canvas: Canvas,
  treatments: Treatment[],
  poster: Pick<PosterPreset, 'width' | 'height'>,
  tagObject: (object: FabricObject, name: string) => void,
  tensionScale = 1,
  exportScale = 1,
) {
  const press = treatments.filter((item) => item.type === 'press-check')
  for (const treatment of press) {
    await renderPressCheckTreatment(canvas, treatment, poster, tagObject, tensionScale, exportScale)
  }
}
