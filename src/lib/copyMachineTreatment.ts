/**
 * Copy Machine treatment render — companion bitmap layer, source stays editable.
 */
import { FabricImage, type Canvas, type FabricObject } from 'fabric'
import {
  copyMachineParamsFromRecord,
  renderCopyMachinePass,
} from './copyMachine'
import { createSeededRandom } from './random'
import { readTransformBaseline, type Treatment } from './treatments'

export const COPY_MACHINE_SOURCE_ID_KEY = 'copyMachineSourceId'

export function readCopyMachineProp(object: FabricObject | null, key: string): unknown {
  if (!object) return undefined
  return (object as unknown as Record<string, unknown>)[key]
}

export function findCopyMachineRender(canvas: Canvas, sourceId: string): FabricObject | undefined {
  return canvas.getObjects().find((object) => readCopyMachineProp(object, COPY_MACHINE_SOURCE_ID_KEY) === sourceId)
}

export function removeCopyMachineRender(canvas: Canvas, sourceId: string) {
  const render = findCopyMachineRender(canvas, sourceId)
  if (render) canvas.remove(render)
}

export function hideCopyMachineSource(object: FabricObject) {
  object.set({
    opacity: 0,
    evented: true,
  } as Partial<FabricObject>)
  object.setCoords()
}

export function restoreCopyMachineSource(object: FabricObject, fallbackOpacity = 1) {
  object.set({
    opacity: fallbackOpacity,
    evented: true,
  } as Partial<FabricObject>)
  object.setCoords()
}

function sourceToImageData(source: FabricObject): ImageData {
  const element = source.toCanvasElement({ enableRetinaScaling: true })
  const context = element.getContext('2d')
  if (!context) throw new Error('Copy Machine render failed — no 2d context')
  return context.getImageData(0, 0, element.width, element.height)
}

function imageDataToDataUrl(imageData: ImageData): string {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Copy Machine render failed — no output context')
  context.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

export function renderCopyMachineChain(
  treatments: Treatment[],
  source: FabricObject,
): ImageData {
  let imageData = sourceToImageData(source)
  for (const treatment of treatments) {
    if (!treatment.enabled) continue
    const params = copyMachineParamsFromRecord(treatment.params)
    const random = createSeededRandom(treatment.seed)
    imageData = renderCopyMachinePass(imageData, params, random)
  }
  return imageData
}

export async function renderCopyMachineTreatment(
  canvas: Canvas,
  source: FabricObject,
  treatments: Treatment[],
) {
  const sourceId = String(readCopyMachineProp(source, 'id') ?? 'layer')
  const enabled = treatments.some((item) => item.type === 'copy-machine' && item.enabled)
  removeCopyMachineRender(canvas, sourceId)

  if (!enabled) {
    restoreCopyMachineSource(source, readTransformBaselineOpacity(source))
    return
  }

  const chain = treatments.filter((item) => item.type === 'copy-machine')
  const imageData = renderCopyMachineChain(chain, source)
  const dataUrl = imageDataToDataUrl(imageData)
  const image = await FabricImage.fromURL(dataUrl, { crossOrigin: 'anonymous' })
  const bounds = source.getBoundingRect()

  image.set({
    left: bounds.left,
    top: bounds.top,
    angle: source.angle ?? 0,
    scaleX: bounds.width / Math.max(1, image.width),
    scaleY: bounds.height / Math.max(1, image.height),
    originX: 'left',
    originY: 'top',
    globalCompositeOperation: 'multiply',
    opacity: 0.94,
    selectable: false,
    evented: false,
    [COPY_MACHINE_SOURCE_ID_KEY]: sourceId,
  } as Partial<FabricObject>)

  const sourceIndex = canvas.getObjects().indexOf(source)
  canvas.add(image)
  if (sourceIndex >= 0) {
    canvas.moveObjectTo(image, sourceIndex)
  }

  hideCopyMachineSource(source)
}

function readTransformBaselineOpacity(source: FabricObject): number {
  const baseline = readTransformBaseline(source)
  return baseline?.opacity ?? source.opacity ?? 1
}
