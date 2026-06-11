/**
 * Non-destructive treatment stacks — Horizon 2.1 core.
 * Treatments persist on Fabric objects and render via filters + transforms.
 */
import { filters } from 'fabric'
import type { FabricImage, FabricObject } from 'fabric'
import { getLayerDecayProfile, getPrintScanProfile } from './editorModel'
import { createSeededRandom } from './random'

export type TreatmentType = 'xerox' | 'decay' | 'distress' | 'scatter'

export type Treatment = {
  id: string
  type: TreatmentType
  seed: number
  enabled: boolean
  params: Record<string, number>
}

export type TransformBaseline = {
  left: number
  top: number
  angle: number
  scaleX: number
  scaleY: number
  opacity: number
}

const TREATMENT_FILTER_PREFIX = 'carson-'

export function newTreatmentId(): string {
  return `tx-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export function readTreatments(object: FabricObject | null): Treatment[] {
  if (!object) return []
  const raw = (object as unknown as Record<string, unknown>).treatments
  if (!Array.isArray(raw)) return []
  return raw as Treatment[]
}

export function writeTreatments(object: FabricObject, treatments: Treatment[]) {
  object.set({ treatments } as Partial<FabricObject>)
}

export function readTransformBaseline(object: FabricObject | null): TransformBaseline | null {
  if (!object) return null
  const raw = (object as unknown as Record<string, unknown>).transformBaseline
  if (!raw || typeof raw !== 'object') return null
  return raw as TransformBaseline
}

export function captureTransformBaseline(object: FabricObject): TransformBaseline {
  const baseline: TransformBaseline = {
    left: object.left ?? 0,
    top: object.top ?? 0,
    angle: object.angle ?? 0,
    scaleX: object.scaleX ?? 1,
    scaleY: object.scaleY ?? 1,
    opacity: object.opacity ?? 1,
  }
  object.set({ transformBaseline: baseline } as Partial<FabricObject>)
  return baseline
}

export function addTreatment(
  object: FabricObject,
  type: TreatmentType,
  params: Record<string, number>,
  seed: number,
): Treatment {
  const baseline = readTransformBaseline(object) ?? captureTransformBaseline(object)
  void baseline
  const treatment: Treatment = {
    id: newTreatmentId(),
    type,
    seed,
    enabled: true,
    params,
  }
  const stack = [...readTreatments(object), treatment]
  writeTreatments(object, stack)
  return treatment
}

export function removeTreatment(object: FabricObject, treatmentId: string) {
  writeTreatments(
    object,
    readTreatments(object).filter((item) => item.id !== treatmentId),
  )
}

export function updateTreatment(
  object: FabricObject,
  treatmentId: string,
  patch: Partial<Pick<Treatment, 'params' | 'enabled' | 'seed'>>,
) {
  writeTreatments(
    object,
    readTreatments(object).map((item) => (item.id === treatmentId ? { ...item, ...patch } : item)),
  )
}

export function reorderTreatment(object: FabricObject, treatmentId: string, direction: 'up' | 'down') {
  const stack = [...readTreatments(object)]
  const index = stack.findIndex((item) => item.id === treatmentId)
  if (index < 0) return
  const swap = direction === 'up' ? index - 1 : index + 1
  if (swap < 0 || swap >= stack.length) return
  ;[stack[index], stack[swap]] = [stack[swap], stack[index]]
  writeTreatments(object, stack)
}

export function treatmentLabel(treatment: Treatment): string {
  switch (treatment.type) {
    case 'xerox':
      return `Xerox·${treatment.params.generation ?? 5}`
    case 'decay':
      return `Decay·${treatment.params.amount ?? 55}`
    case 'distress':
      return `Distress·${treatment.params.intensity ?? 70}`
    case 'scatter':
      return `Scatter·#${treatment.seed}`
    default:
      return treatment.type
  }
}

/** Build Fabric filters from enabled treatments (non-destructive). */
export function buildTreatmentFilters(treatments: Treatment[]): filters.BaseFilter<string, Record<string, unknown>>[] {
  const output: filters.BaseFilter<string, Record<string, unknown>>[] = []
  for (const treatment of treatments.filter((item) => item.enabled)) {
    if (treatment.type === 'xerox') {
      const profile = getPrintScanProfile(treatment.params.generation ?? 5)
      output.push(new filters.Grayscale())
      output.push(new filters.Contrast({ contrast: profile.contrast }))
      output.push(new filters.Noise({ noise: profile.noise }))
      output.push(new filters.Blur({ blur: profile.blur }))
    } else if (treatment.type === 'decay') {
      const profile = getLayerDecayProfile(treatment.params.amount ?? 55)
      output.push(new filters.Contrast({ contrast: profile.contrast }))
      output.push(new filters.Noise({ noise: profile.noise }))
      output.push(new filters.Blur({ blur: profile.blur }))
    } else if (treatment.type === 'distress') {
      const intensity = (treatment.params.intensity ?? 70) / 100
      output.push(new filters.Contrast({ contrast: 0.2 + intensity * 0.5 }))
      output.push(new filters.Noise({ noise: 40 + intensity * 180 }))
      output.push(new filters.Blur({ blur: 0.05 + intensity * 0.12 }))
    }
  }
  return output
}

/** Apply scatter transform from baseline + seed. */
export function applyScatterTransform(object: FabricObject, treatment: Treatment) {
  const baseline = readTransformBaseline(object) ?? captureTransformBaseline(object)
  const random = createSeededRandom(treatment.seed)
  const distance = treatment.params.distance ?? 46
  const rotation = treatment.params.rotation ?? 18
  const scale = treatment.params.scale ?? 0.14
  const dx = (random() - 0.5) * distance * 2
  const dy = (random() - 0.5) * distance * 2
  const da = (random() - 0.5) * rotation * 2
  const ds = 1 + (random() - 0.5) * scale * 2
  object.set({
    left: baseline.left + dx,
    top: baseline.top + dy,
    angle: baseline.angle + da,
    scaleX: baseline.scaleX * ds,
    scaleY: baseline.scaleY * ds,
  })
}

/** Re-render all treatments on an object without rasterizing. */
export function renderTreatmentStack(object: FabricObject) {
  const stack = readTreatments(object).filter((item) => item.enabled)
  const filterTreatments = stack.filter((item) => item.type !== 'scatter')
  const scatter = stack.find((item) => item.type === 'scatter')

  const baseline = readTransformBaseline(object)
  if (baseline) {
    object.set({
      left: baseline.left,
      top: baseline.top,
      angle: baseline.angle,
      scaleX: baseline.scaleX,
      scaleY: baseline.scaleY,
      opacity: baseline.opacity,
    })
  }
  if (scatter) applyScatterTransform(object, scatter)

  const built = buildTreatmentFilters(filterTreatments)
  const filterable = object as FabricImage
  if (typeof filterable.applyFilters === 'function') {
    const existing = (filterable.filters ?? []).filter(
      (filter) => !String(filter?.type ?? '').startsWith(TREATMENT_FILTER_PREFIX),
    )
    filterable.filters = [...existing, ...built]
    filterable.applyFilters()
  }

  for (const treatment of filterTreatments) {
    if (treatment.type === 'xerox') {
      const profile = getPrintScanProfile(treatment.params.generation ?? 5)
      object.set({ opacity: profile.opacity, globalCompositeOperation: 'multiply' })
    } else if (treatment.type === 'decay') {
      const profile = getLayerDecayProfile(treatment.params.amount ?? 55)
      object.set({ opacity: profile.opacity, globalCompositeOperation: 'multiply' })
    }
  }

  object.setCoords()
}

export const TREATMENT_SERIALIZE_KEY = 'treatments'
export const BASELINE_SERIALIZE_KEY = 'transformBaseline'
