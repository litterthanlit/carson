/**
 * Copy Machine treatment render — companion bitmap layer, source stays editable.
 * CM-2 adds a misregistration ghost (tonal-only) behind the main bake.
 */
import { FabricImage, type Canvas, type FabricObject } from 'fabric'
import {
  applyCopyMachineChain,
  copyMachineGhostDelta,
  copyMachineGhostOpacity,
  copyMachineParamsFromRecord,
  copyMachinePixelScale,
  isOpaqueSource,
  renderCopyMachineGhostPass,
  scaleCopyMachineParams,
  type CopyMachineParams,
} from './copyMachine'
import { applyCopyMachineChainLatest } from './copyMachineWorkerClient'
import { inkLoadIsIdle } from './inkBleed'
import { copyMachineBleedPadding, solventTransferIsIdle } from './solventTransfer'
import { canvasPress, pressRegistration, pressSignature, type Press, type SheetPatch } from './press'
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
  if (record.pressCheckFragment) return false
  if (isCopyMachineCompanionLayer(object)) return false
  if (record.decayMarkSourceId) return false
  if (record.misprintSourceId) return false
  if (record.typeStripSourceId) return false
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

export type CopyMachineBakeCacheEntry = {
  imageData: ImageData
  dataUrl: string
  sourceImageData?: ImageData
}

const bakeCache = new Map<string, CopyMachineBakeCacheEntry>()
/** Latest render started per source layer — older bakes that finish late are dropped. */
const renderGenerations = new Map<string, number>()

function cloneImageData(imageData: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height)
}

export function copyMachineBakeCacheKey(
  sourceId: string,
  treatments: Treatment[],
  exportScale: number,
  tensionScale: number,
  sourceSignature = '',
): string {
  const payload = treatments
    .filter((item) => item.type === 'copy-machine')
    .map((item) => ({
      id: item.id,
      seed: item.seed,
      enabled: item.enabled,
      params: item.params,
    }))
  return `${sourceId}::${JSON.stringify({ exportScale, tensionScale, sourceSignature, payload })}`
}

export function copyMachineSourceSignature(source: FabricObject): string {
  const record = source as unknown as Record<string, unknown>
  return JSON.stringify({
    text: record.text ?? '',
    width: source.width ?? 0,
    height: source.height ?? 0,
    scaleX: source.scaleX ?? 1,
    scaleY: source.scaleY ?? 1,
    angle: source.angle ?? 0,
    fill: record.fill ?? '',
  })
}

export function clearCopyMachineBakeCache() {
  bakeCache.clear()
}

export function invalidateCopyMachineBakesForSource(sourceId: string) {
  const prefix = `${sourceId}::`
  for (const key of [...bakeCache.keys()]) {
    if (key.startsWith(prefix)) bakeCache.delete(key)
  }
}

export function readCopyMachineBakeCache(key: string): CopyMachineBakeCacheEntry | null {
  const cached = bakeCache.get(key)
  if (!cached) return null
  return {
    imageData: cloneImageData(cached.imageData),
    dataUrl: cached.dataUrl,
    sourceImageData: cached.sourceImageData ? cloneImageData(cached.sourceImageData) : undefined,
  }
}

export function writeCopyMachineBakeCache(key: string, entry: CopyMachineBakeCacheEntry) {
  bakeCache.set(key, {
    imageData: cloneImageData(entry.imageData),
    dataUrl: entry.dataUrl,
    sourceImageData: entry.sourceImageData ? cloneImageData(entry.sourceImageData) : undefined,
  })
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

function padImageData(imageData: ImageData, padPx: number): ImageData {
  if (padPx <= 0) return imageData
  const outW = imageData.width + padPx * 2
  const outH = imageData.height + padPx * 2
  const out = new ImageData(outW, outH)
  const src = imageData.data
  const dst = out.data
  const rowBytes = imageData.width * 4
  for (let y = 0; y < imageData.height; y++) {
    const srcStart = y * rowBytes
    const dstStart = ((y + padPx) * outW + padPx) * 4
    dst.set(src.subarray(srcStart, srcStart + rowBytes), dstStart)
  }
  return out
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

export { applyCopyMachineChain }

export function renderCopyMachineChain(
  treatments: Treatment[],
  source: FabricObject,
  exportScale = 1,
  tensionScale = 1,
): ImageData {
  return applyCopyMachineChain(sourceToImageData(source, exportScale), treatments, exportScale, tensionScale)
}

/** True when any enabled pass in the chain lays ink unevenly. */
export function copyMachineChainInks(chain: Pick<Treatment, 'enabled' | 'params'>[]): boolean {
  return chain.some((step) => step.enabled && !inkLoadIsIdle(copyMachineParamsFromRecord(step.params)))
}

/** True when any enabled pass in the chain runs the solvent / tape-transfer pass. */
export function copyMachineChainHasSolvent(chain: Pick<Treatment, 'enabled' | 'params'>[]): boolean {
  return chain.some((step) => step.enabled && !solventTransferIsIdle(copyMachineParamsFromRecord(step.params)))
}

/** Poster-px margin to reserve around a transparent layer so blotches, smears and debris aren't clipped. */
export function copyMachineChainPadding(
  chain: Pick<Treatment, 'enabled' | 'params'>[],
  layerShortSide: number,
  tensionScale = 1,
): number {
  let maxPad = 0
  for (const step of chain) {
    if (!step.enabled) continue
    const scaled = scaleCopyMachineParams(copyMachineParamsFromRecord(step.params), tensionScale)
    maxPad = Math.max(maxPad, copyMachineBleedPadding(scaled, layerShortSide))
  }
  return maxPad
}

/** Where a layer's raster lies on the press: its bounding box, in raster px per poster px. */
export function copyMachineSheetPatch(
  press: Press,
  bounds: { left: number; top: number; width: number },
  rasterWidth: number,
): SheetPatch {
  return {
    press,
    originX: bounds.left,
    originY: bounds.top,
    unit: bounds.width / Math.max(1, rasterWidth),
  }
}

/** Cache text for an inked bake on a press: the run, and the spot on the sheet. */
export function copyMachinePressSignature(press: Press | null, bounds: { left: number; top: number }): string {
  if (!press) return ''
  return `|press:${pressSignature(press)}@${bounds.left.toFixed(1)},${bounds.top.toFixed(1)}`
}

/**
 * What the ghost re-tones. The echo comes off the same drum as the copy, so
 * when the drum was inked unevenly it echoes the inked copy — flooded and
 * starved the same way — rather than inking the original a second time.
 */
export function copyMachineGhostInput(
  params: CopyMachineParams,
  sourcePixels: ImageData,
  bakedPixels: ImageData | undefined,
): { source: ImageData; params: CopyMachineParams } {
  if (!bakedPixels || (inkLoadIsIdle(params) && solventTransferIsIdle(params))) return { source: sourcePixels, params }
  return {
    source: bakedPixels,
    params: { ...params, bleed: 0, starve: 0, slur: 0, blot: 0, smear: 0, seams: 0, debris: 0 },
  }
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
  /** A copied sheet covers what's below; copied type overprints it. */
  blend: 'multiply' | 'source-over',
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
    // The raster already carries the layer's rotation (toCanvasElement renders it
    // into the axis-aligned bounds), so placing it rotated again would spin it twice.
    angle: 0,
    scaleX: bounds.width / Math.max(1, image.width),
    scaleY: bounds.height / Math.max(1, image.height),
    originX: 'left',
    originY: 'top',
    globalCompositeOperation: blend,
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
  const generation = (renderGenerations.get(sourceId) ?? 0) + 1
  renderGenerations.set(sourceId, generation)
  // A slider moved again while this bake was in the worker: the newer render owns the layer.
  const superseded = () => renderGenerations.get(sourceId) !== generation
  removeCopyMachineCompanions(canvas, sourceId)

  if (!enabled) {
    restoreCopyMachineSource(source, readTransformBaselineOpacity(source))
    return
  }

  const chain = treatments.filter((item) => item.type === 'copy-machine')
  const bounds = source.getBoundingRect()
  const hasSolvent = copyMachineChainHasSolvent(chain)
  const rawPad = copyMachineChainPadding(chain, Math.min(bounds.width, bounds.height), tensionScale)
  // On a press, uneven ink depends on where the layer sits on the sheet.
  const press = canvasPress(canvas)
  const inkPress = press && (copyMachineChainInks(chain) || hasSolvent) ? press : null
  const cacheKey = copyMachineBakeCacheKey(
    sourceId,
    chain,
    exportScale,
    tensionScale,
    copyMachineSourceSignature(source) + copyMachinePressSignature(inkPress, bounds),
  )
  const cached = readCopyMachineBakeCache(cacheKey)
  let sourcePixels = cached?.sourceImageData
  let dataUrl = cached?.dataUrl
  let bakedPixels = cached?.imageData

  let pad: number
  if (!cached || !dataUrl) {
    revealSourceForRaster(source)
    const rawPixels = sourceToImageData(source, exportScale)
    const opaque = isOpaqueSource(rawPixels)
    pad = opaque ? 0 : rawPad
    const padRaster = pad > 0 ? Math.max(1, Math.round(pad * (rawPixels.width / Math.max(1, bounds.width)))) : 0
    sourcePixels = padRaster > 0 ? padImageData(rawPixels, padRaster) : rawPixels
    const paddedBounds =
      pad > 0
        ? {
            left: bounds.left - pad,
            top: bounds.top - pad,
            width: bounds.width + pad * 2,
            height: bounds.height + pad * 2,
          }
        : bounds
    const sheet = inkPress ? copyMachineSheetPatch(inkPress, paddedBounds, sourcePixels.width) : undefined
    const baked = await applyCopyMachineChainLatest(
      `${sourceId}@${exportScale}`,
      sourcePixels,
      chain,
      exportScale,
      tensionScale,
      sheet,
    )
    if (!baked) return
    bakedPixels = baked
    dataUrl = imageDataToDataUrl(bakedPixels)
    writeCopyMachineBakeCache(cacheKey, { imageData: bakedPixels, dataUrl, sourceImageData: sourcePixels })
    if (superseded()) return
  } else {
    pad = sourcePixels && !isOpaqueSource(sourcePixels) ? rawPad : 0
  }

  const opaque = Boolean(sourcePixels && isOpaqueSource(sourcePixels))
  const blend = opaque ? 'source-over' : 'multiply'
  const placeBounds =
    pad > 0
      ? {
          left: bounds.left - pad,
          top: bounds.top - pad,
          width: bounds.width + pad * 2,
          height: bounds.height + pad * 2,
        }
      : bounds
  const sourceIndex = canvas.getObjects().indexOf(source)

  const main = await placeCompanionImage(canvas, dataUrl, blend, placeBounds, {
    left: placeBounds.left,
    top: placeBounds.top,
    opacity: blend === 'source-over' || hasSolvent ? 1 : 0.94,
    tagKey: COPY_MACHINE_SOURCE_ID_KEY,
    sourceId,
    insertIndex: sourceIndex,
  })
  if (superseded()) {
    canvas.remove(main)
    return
  }

  const ghostSpec = resolveCopyMachineGhostParams(chain)
  if (ghostSpec) {
    const ghostParams = scaleCopyMachineParams(ghostSpec.params, tensionScale)
    const ghostOpacity = copyMachineGhostOpacity(ghostParams.ghost)
    if (ghostOpacity > 0.01) {
      const ghostRandom = createSeededRandom((ghostSpec.seed ^ GHOST_SEED_OFFSET) >>> 0)
      const { source: ghostSource, params: ghostTonal } = copyMachineGhostInput(
        ghostParams,
        sourcePixels ?? sourceToImageData(source, exportScale),
        bakedPixels,
      )
      const ghostPixels = renderCopyMachineGhostPass(ghostSource, ghostTonal, ghostRandom)
      const { dx, dy } = copyMachineGhostDelta(ghostParams.ghostOffset, press ? pressRegistration(press) : undefined)
      const mainIndex = canvas.getObjects().indexOf(main)
      const ghost = await placeCompanionImage(canvas, imageDataToDataUrl(ghostPixels), 'multiply', placeBounds, {
        left: placeBounds.left + dx,
        top: placeBounds.top + dy,
        opacity: ghostOpacity,
        tagKey: COPY_GHOST_SOURCE_ID_KEY,
        sourceId,
        insertIndex: mainIndex >= 0 ? mainIndex : sourceIndex,
      })
      if (superseded()) {
        canvas.remove(main)
        canvas.remove(ghost)
        return
      }
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
