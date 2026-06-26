/**
 * Poster-wide scrape mask treatment — non-destructive eraser bands with grit (Horizon 2.5).
 */
import { Rect, type Canvas, type FabricObject } from 'fabric'
import { createPhotocopyNoise, createScrapeMasks, type PosterPreset } from './editorModel'
import { createSeededRandom } from './random'
import type { Treatment } from './treatments'

export const SCRAPE_TREATMENT_ID_KEY = 'scrapeTreatmentId'
export const SCRAPE_FRAGMENT_KEY = 'scrapeFragment'

export function removeScrapeFragments(canvas: Canvas, treatmentId: string) {
  for (const object of [...canvas.getObjects()]) {
    const record = object as unknown as Record<string, unknown>
    if (record[SCRAPE_TREATMENT_ID_KEY] === treatmentId) {
      canvas.remove(object)
    }
  }
}

export function removeAllScrapeFragments(canvas: Canvas) {
  for (const object of [...canvas.getObjects()]) {
    const record = object as unknown as Record<string, unknown>
    if (record[SCRAPE_FRAGMENT_KEY]) {
      canvas.remove(object)
    }
  }
}

export function renderScrapeTreatment(
  canvas: Canvas,
  treatment: Treatment,
  poster: Pick<PosterPreset, 'width' | 'height'>,
  tagObject: (object: FabricObject, name: string) => void,
) {
  removeScrapeFragments(canvas, treatment.id)
  if (!treatment.enabled) return

  const random = createSeededRandom(treatment.seed)
  const count = Math.max(1, Math.min(10, Math.round(treatment.params.count ?? 7)))
  const masks = createScrapeMasks(poster, { count, random })

  masks.forEach((mask, index) => {
    const scrape = new Rect({
      left: mask.left,
      top: mask.top,
      width: mask.width,
      height: mask.height,
      fill: '#000000',
      opacity: mask.opacity,
      angle: mask.angle,
      globalCompositeOperation: 'destination-out',
      selectable: false,
      evented: false,
    })
    scrape.set({
      [SCRAPE_TREATMENT_ID_KEY]: treatment.id,
      [SCRAPE_FRAGMENT_KEY]: true,
    } as Partial<FabricObject>)
    tagObject(scrape, `Scrape band ${index + 1}`)
    canvas.add(scrape)

    const chips = createPhotocopyNoise(
      { width: mask.width, height: mask.height },
      { specks: 9, scratches: 2, scanlines: 0, random },
    )
    chips.forEach((chip) => {
      const chipObject = new Rect({
        left: mask.left + chip.left,
        top: mask.top + chip.top,
        width: chip.kind === 'speck' ? chip.size : chip.width,
        height: chip.kind === 'speck' ? chip.size : chip.height,
        fill: '#000000',
        opacity: chip.opacity * 0.55,
        angle: chip.kind === 'speck' ? mask.angle : chip.angle,
        globalCompositeOperation: 'destination-out',
        selectable: false,
        evented: false,
      })
      chipObject.set({
        [SCRAPE_TREATMENT_ID_KEY]: treatment.id,
        [SCRAPE_FRAGMENT_KEY]: true,
      } as Partial<FabricObject>)
      tagObject(chipObject, 'Scrape grit')
      canvas.add(chipObject)
    })
  })

  const fragments = canvas
    .getObjects()
    .filter((object) => (object as unknown as Record<string, unknown>)[SCRAPE_TREATMENT_ID_KEY] === treatment.id)
  for (const fragment of fragments) {
    canvas.bringObjectToFront(fragment)
  }
}
