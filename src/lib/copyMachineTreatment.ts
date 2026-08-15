/**
 * Copy Machine treatment render — companion bitmap layer, source stays editable.
 * CM-2 adds a misregistration ghost (tonal-only) behind the main bake.
 */
import { FabricImage, type Canvas, type FabricObject } from 'fabric'
import {
  copyMachineGhostDelta,
  copyMachineGhostOpacity,
  copyMachineParamsFromRecord,
  copyMachinePixelScale,
  renderCopyMachineGhostPass,
  renderCopyMachinePass,
  scaleCopyMachineParams,
  type CopyMachineParams,
} from './copyMachine'
import { createSeededRandom } from './random'
import { readTransformBaseline, readTreatments, type Treatment } from './treatments'

export const COPY_MACHINE_SOURCE_ID_KEY = 'copyMachineSourceId'
export const COPY_GHOST_SOURCE_ID_KEY = 'copyGhostSourceId'

const GHOST_SEED_OFFSET = 0x9e3779b9

export function readCopyMachineProp(object: FabricObject | null, key: string): unknown {
  if (!object) return undefined
  return (object as unknown as Record<string, unknown>)[key]
}

export function findCopyMachineRender(canvas: Canvas, sourceId: string): FabricObject | undefined {
  return canvas.getObjects().find((object) => readCopyMachineProp(object, COPY_MACHINE_SOURCE_ID_KEY) === sourceId)
}

export function findCopyMachineGhost(canvas: Canvas, sourceId: string): FabricObject | undefined {
  return canvas.getObjects().find((object) => readCopyMachineProp(object, COPY_GHOST_SOURCE_ID_KEY) === sourceId)
}

export function removeCopyMachineRender(canvas: Canvas, sourceId: string) {
  const render = findCopyMachineRender(canvas, sourceId)
  if (render) canvas.remove(render)
}

export function removeCopyMachineGhost(canvas: Canvas, sourceId: string) {
  const ghost = findCopyMachineGhost(canvas, sourceId)
  if (ghost) canvas.remove(ghost)
}

export function removeCopyMachineCompanions(canvas: Canvas, sourceId: string) {
  removeCopyMachineRender(canvas, sourceId)
  removeCopyMachineGhost(canvas, sourceId)
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

export function isCopyMachineCompanionLayer(object: FabricObject): boolean {
  return Boolean(
    readCopyMachineProp(object, COPY_MACHINE_SOURCE_ID_KEY) ||
      readCopyMachineProp(object, COPY_GHOST_SOURCE_ID_KEY),
  )
}

/** Visible content layers eligible for a poster-scope Copy Machine pass (excludes companions / scrapes). */
export function isCopyMachinePosterTarget(object: FabricObject): boolean {
  if (object.visible === false) return false
  const record = object as unknown as Record<string, unknown>
  if (record.scrapeFragment) return false
  if (isCopyMachineCompanionLayer(object)) return false
  return Boolean(record.id)
}

export function listCopyMachinePosterTargets(canvas: Canvas): FabricObject[] {
  return canvas.getObjects().filter(isCopyMachinePosterTarget)
}

export function listCopyMachineSources(canvas: Canvas): FabricObject[] {
  return canvas.getObjects().filter((object) => {
    if (isCopyMachineCompanionLayer(object)) return false
    return readTreatments(object).some((item) => item.type === 'copy-machine')
  })
}

export function stripCopyMachineCompanions(canvas: Canvas) {
  for (const object of [...canvas.getObjects()]) {
    if (isCopyMachineCompanionLayer(object)) canvas.remove(object)
  }
}

/** Persist seed+params only — never the baked bitmap. Reload re-renders from seed. */
export function omitCopyMachineCompanionsFromCanvasJSON<T extends { objects?: unknown[] }>(json: T): T {
  if (!Array.isArray(json.objects)) return json
  return {
    ...json,
    objects: json.objects.filter((object) => {
      if (!object || typeof object !== 'object') return true
      const record = object as Record<string, unknown>
      return !record[COPY_MACHINE_SOURCE_ID_KEY] && !record[COPY_GHOST_SOURCE_ID_KEY]
    }),
  }
}

export async function rebakeCopyMachineTreatments(canvas: Canvas, exportScale = 1, tensionScale = 1) {
  const sources = listCopyMachineSources(canvas)
  for (const source of sources) {
    await renderCopyMachineTreatment(
      canvas,
      source,
      readTreatments(source).filter((item) => item.type === 'copy-machine'),
      exportScale,
      tensionScale,
    )
  }
}

function sourceToImageData(source: FabricObject, exportScale = 1): ImageData {
  const element = source.toCanvasElement({
    enableRetinaScaling: false,
    multiplier: copyMachinePixelScale(exportScale),
  })
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
  exportScale = 1,
  tensionScale = 1,
): ImageData {
  let imageData = sourceToImageData(source, exportScale)
  for (const treatment of treatments) {
    if (!treatment.enabled) continue
    const params = scaleCopyMachineParams(copyMachineParamsFromRecord(treatment.params), tensionScale)
    const random = createSeededRandom(treatment.seed)
    imageData = renderCopyMachinePass(imageData, params, random, exportScale)
  }
  return imageData
}

/** Prefer the last enabled treatment — stacking is generational; ghost is the final drum echo. */
export function resolveCopyMachineGhostParams(treatments: Treatment[]): {
  params: CopyMachineParams
  seed: number
} | null {
  const enabled = treatments.filter((item) => item.type === 'copy-machine' && item.enabled)
  for (let i = enabled.length - 1; i >= 0; i--) {
    const treatment = enabled[i]
    const params = copyMachineParamsFromRecord(treatment.params)
    if (params.ghost > 0) {
      return { params, seed: treatment.seed }
    }
  }
  return null
}

async function placeCompanionImage(
  canvas: Canvas,
  dataUrl: string,
  source: FabricObject,
  bounds: { left: number; top: number; width: number; height: number },
  options: {
    left: number
    top: number
    opacity: number
    tagKey: string
    sourceId: string
    insertIndex: number
  },
): Promise<FabricObject> {
  const image = await FabricImage.fromURL(dataUrl, { crossOrigin: 'anonymous' })
  image.set({
    left: options.left,
    top: options.top,
    angle: source.angle ?? 0,
    scaleX: bounds.width / Math.max(1, image.width),
    scaleY: bounds.height / Math.max(1, image.height),
    originX: 'left',
    originY: 'top',
    globalCompositeOperation: 'multiply',
    opacity: options.opacity,
    selectable: false,
    evented: false,
    [options.tagKey]: options.sourceId,
  } as Partial<FabricObject>)

  canvas.add(image)
  if (options.insertIndex >= 0) {
    canvas.moveObjectTo(image, options.insertIndex)
  }
  return image
}

export async function renderCopyMachineTreatment(
  canvas: Canvas,
  source: FabricObject,
  treatments: Treatment[],
  exportScale = 1,
  tensionScale = 1,
) {
  const sourceId = String(readCopyMachineProp(source, 'id') ?? 'layer')
  const enabled = treatments.some((item) => item.type === 'copy-machine' && item.enabled)
  removeCopyMachineCompanions(canvas, sourceId)

  if (!enabled) {
    restoreCopyMachineSource(source, readTransformBaselineOpacity(source))
    return
  }

  revealSourceForRaster(source)
  const chain = treatments.filter((item) => item.type === 'copy-machine')
  const imageData = renderCopyMachineChain(chain, source, exportScale, tensionScale)
  const dataUrl = imageDataToDataUrl(imageData)
  const bounds = source.getBoundingRect()
  const sourceIndex = canvas.getObjects().indexOf(source)

  const main = await placeCompanionImage(canvas, dataUrl, source, bounds, {
    left: bounds.left,
    top: bounds.top,
    opacity: 0.94,
    tagKey: COPY_MACHINE_SOURCE_ID_KEY,
    sourceId,
    insertIndex: sourceIndex,
  })

  const ghostSpec = resolveCopyMachineGhostParams(chain)
  if (ghostSpec) {
    const ghostParams = scaleCopyMachineParams(ghostSpec.params, tensionScale)
    const ghostOpacity = copyMachineGhostOpacity(ghostParams.ghost)
    if (ghostOpacity > 0.01) {
      const ghostRandom = createSeededRandom((ghostSpec.seed ^ GHOST_SEED_OFFSET) >>> 0)
      const ghostPixels = renderCopyMachineGhostPass(
        sourceToImageData(source, exportScale),
        ghostParams,
        ghostRandom,
      )
      const { dx, dy } = copyMachineGhostDelta(ghostParams.ghostOffset)
      const mainIndex = canvas.getObjects().indexOf(main)
      await placeCompanionImage(canvas, imageDataToDataUrl(ghostPixels), source, bounds, {
        left: bounds.left + dx,
        top: bounds.top + dy,
        opacity: ghostOpacity,
        tagKey: COPY_GHOST_SOURCE_ID_KEY,
        sourceId,
        insertIndex: mainIndex >= 0 ? mainIndex : sourceIndex,
      })
    }
  }

  hideCopyMachineSource(source)
}

function revealSourceForRaster(source: FabricObject) {
  const opacity = readTransformBaselineOpacity(source)
  source.set({
    opacity: opacity > 0.01 ? opacity : 1,
    evented: true,
  } as Partial<FabricObject>)
  source.setCoords()
}

function readTransformBaselineOpacity(source: FabricObject): number {
  const baseline = readTransformBaseline(source)
  return baseline?.opacity ?? source.opacity ?? 1
}
