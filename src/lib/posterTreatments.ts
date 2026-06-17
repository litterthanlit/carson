/**
 * Canvas-wide poster treatments (scrape masks, etc.) stored per artboard.
 */
import type { Canvas } from 'fabric'
import type { PosterPreset } from './editorModel'
import { newTreatmentId, type Treatment } from './treatments'
import { removeAllScrapeFragments, removeScrapeFragments, renderScrapeTreatment } from './scrapeTreatment'
import type { Artboard } from './document'
import type { FabricObject } from 'fabric'

export type PosterTreatmentType = 'scrape'

export function readPosterTreatments(artboard: Artboard | undefined): Treatment[] {
  return artboard?.posterTreatments ?? []
}

export function writePosterTreatments(artboard: Artboard, treatments: Treatment[]): Artboard {
  return { ...artboard, posterTreatments: treatments }
}

export function addPosterTreatment(
  artboard: Artboard,
  type: PosterTreatmentType,
  params: Record<string, number>,
  seed: number,
): { artboard: Artboard; treatment: Treatment } {
  const treatment: Treatment = {
    id: newTreatmentId(),
    type,
    seed,
    enabled: true,
    params,
  }
  const stack = [...readPosterTreatments(artboard).filter((item) => item.type !== type), treatment]
  return { artboard: writePosterTreatments(artboard, stack), treatment }
}

export function removePosterTreatment(artboard: Artboard, treatmentId: string): Artboard {
  return writePosterTreatments(
    artboard,
    readPosterTreatments(artboard).filter((item) => item.id !== treatmentId),
  )
}

export function updatePosterTreatment(
  artboard: Artboard,
  treatmentId: string,
  patch: Partial<Pick<Treatment, 'params' | 'enabled' | 'seed'>>,
): Artboard {
  return writePosterTreatments(
    artboard,
    readPosterTreatments(artboard).map((item) => (item.id === treatmentId ? { ...item, ...patch } : item)),
  )
}

export function reorderPosterTreatment(artboard: Artboard, treatmentId: string, direction: 'up' | 'down'): Artboard {
  const stack = [...readPosterTreatments(artboard)]
  const index = stack.findIndex((item) => item.id === treatmentId)
  if (index < 0) return artboard
  const swap = direction === 'up' ? index - 1 : index + 1
  if (swap < 0 || swap >= stack.length) return artboard
  ;[stack[index], stack[swap]] = [stack[swap], stack[index]]
  return writePosterTreatments(artboard, stack)
}

export function posterTreatmentLabel(treatment: Treatment): string {
  if (treatment.type === 'scrape') {
    return `Scrape·${treatment.params.count ?? 7}`
  }
  return treatment.type
}

export function renderPosterTreatments(
  canvas: Canvas,
  treatments: Treatment[],
  poster: Pick<PosterPreset, 'width' | 'height'>,
  tagObject: (object: FabricObject, name: string) => void,
) {
  const activeIds = new Set(treatments.map((item) => item.id))
  for (const object of [...canvas.getObjects()]) {
    const treatmentId = (object as unknown as Record<string, unknown>).scrapeTreatmentId
    if (treatmentId && !activeIds.has(String(treatmentId))) {
      canvas.remove(object)
    }
  }

  for (const treatment of treatments) {
    if (treatment.type === 'scrape') {
      renderScrapeTreatment(canvas, treatment, poster, tagObject)
    } else {
      removeScrapeFragments(canvas, treatment.id)
    }
  }
}

export function reconcilePosterTreatments(canvas: Canvas) {
  removeAllScrapeFragments(canvas)
}
