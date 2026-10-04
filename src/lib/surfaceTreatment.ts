/**
 * Surface treatment — Age, Distress and Ink loss as one physical pipeline.
 * The source's print is rendered once and every enabled surface process runs
 * on it in stack order (aged, then rubbed, then chipped compose like they
 * would on a real sheet). The source stays editable and clickable; the
 * companion is never stored and is rebuilt from the seeds when anything
 * changes.
 */
import { FabricImage, type Canvas, type FabricObject } from 'fabric'
import { isOpaqueSource } from './copyMachine'
import { scaleTreatmentParams } from './instruments'
import { createSeededRandom } from './random'
import { readSliceProp } from './sliceTreatment'
import { abradeSurface, ageSurface, erodeInk, type SurfaceRaster } from './surface'
import type { Treatment } from './treatments'

export const SURFACE_SOURCE_ID_KEY = 'surfaceSourceId'
export const SURFACE_TREATMENT_ID_KEY = 'surfaceTreatmentId'

const MAX_RASTER = 3000

export type SurfaceTagger = (object: FabricObject) => void

type SurfaceStep = { process: 'age' | 'abrade' | 'erode'; amount: number; seed: number }

/** The surface processes a stack asks for, in order. */
export function surfaceSteps(treatments: Treatment[], tensionScale = 1): SurfaceStep[] {
  const steps: SurfaceStep[] = []
  for (const treatment of treatments) {
    if (!treatment.enabled) continue
    const params = scaleTreatmentParams(treatment.type, treatment.params, tensionScale)
    if (treatment.type === 'decay') steps.push({ process: 'age', amount: (params.amount ?? 55) / 100, seed: treatment.seed })
    else if (treatment.type === 'distress') steps.push({ process: 'abrade', amount: (params.intensity ?? 70) / 100, seed: treatment.seed })
    else if (treatment.type === 'decay-marks' && (params.kind ?? 0) !== 1) {
      // Ink loss (and the ink half of Wear); folds stay with the marks renderer.
      steps.push({ process: 'erode', amount: (params.amount ?? 55) / 100, seed: treatment.seed })
    }
  }
  return steps
}

export function isSurfaceCompanion(object: FabricObject | Record<string, unknown>): boolean {
  return Boolean((object as Record<string, unknown>)[SURFACE_SOURCE_ID_KEY])
}

export function removeSurfaceCompanionForSource(canvas: Canvas, sourceId: string) {
  for (const object of [...canvas.getObjects()]) {
    if (readSliceProp(object, SURFACE_SOURCE_ID_KEY) === sourceId) canvas.remove(object)
  }
}

export function stripSurfaceCompanions(canvas: Canvas) {
  for (const object of [...canvas.getObjects()]) if (isSurfaceCompanion(object)) canvas.remove(object)
}

function parseColor(color: string | undefined): [number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec((color ?? '').trim())
  if (!hex) return [246, 243, 236]
  const value = parseInt(hex[1], 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/** Render the surface companion; returns false when the stack has no surface steps. */
export function renderSurfaceTreatment(
  canvas: Canvas,
  source: FabricObject,
  treatments: Treatment[],
  tag: SurfaceTagger,
  tensionScale = 1,
  pxPerMm = 11.8,
  paperColor?: string,
): boolean {
  const sourceId = String(readSliceProp(source, 'id') ?? 'layer')
  removeSurfaceCompanionForSource(canvas, sourceId)
  const steps = surfaceSteps(treatments, tensionScale)
  if (steps.length === 0 || typeof document === 'undefined') return false
  const first = treatments.find((item) => item.enabled && (item.type === 'decay' || item.type === 'distress' || item.type === 'decay-marks'))

  const baseline = readSliceProp(source, 'transformBaseline') as { opacity?: number } | undefined
  const resting = baseline?.opacity ?? 1
  const shown = source.opacity
  source.set({ opacity: resting > 0.01 ? resting : 1 })
  const bounds = source.getBoundingRect()
  const k = Math.min(1, MAX_RASTER / Math.max(1, bounds.width, bounds.height))
  const raster = source.toCanvasElement({ multiplier: k, enableRetinaScaling: false })
  source.set({ opacity: shown })
  const context = raster.getContext('2d')
  if (!context) return false
  const image = context.getImageData(0, 0, raster.width, raster.height)
  const surface: SurfaceRaster = {
    data: image.data,
    width: raster.width,
    height: raster.height,
    opaque: isOpaqueSource(image),
    pxPerMm: pxPerMm * k,
    paper: parseColor(paperColor),
  }
  for (const step of steps) {
    const random = createSeededRandom((step.seed ^ 0x2b7e1516) >>> 0)
    if (step.process === 'age') ageSurface(surface, step.amount, random)
    else if (step.process === 'abrade') abradeSurface(surface, step.amount, random)
    else erodeInk(surface, step.amount, random)
  }
  context.putImageData(image, 0, 0)

  const companion = new FabricImage(raster, {
    originX: 'left',
    originY: 'top',
    left: bounds.left,
    top: bounds.top,
    scaleX: bounds.width / raster.width,
    scaleY: bounds.height / raster.height,
    globalCompositeOperation: source.globalCompositeOperation ?? 'source-over',
    selectable: false,
    evented: false,
    excludeFromExport: true,
    [SURFACE_SOURCE_ID_KEY]: sourceId,
    [SURFACE_TREATMENT_ID_KEY]: first?.id ?? 'surface',
  } as Partial<FabricImage>)
  tag(companion)
  companion.set({ selectable: false, evented: false } as Partial<FabricObject>)
  const at = canvas.getObjects().indexOf(source)
  if (at >= 0) canvas.insertAt(at + 1, companion)
  else canvas.add(companion)
  source.set({ opacity: 0, evented: true } as Partial<FabricObject>)
  source.setCoords()
  return true
}
