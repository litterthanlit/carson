/**
 * Poster-wide scrape as a real eraser mask (Horizon 2.5).
 * Rasterizes seeded bands into an alpha clip on the canvas — source layers
 * stay intact, bypass/re-roll just rebuilds the clipPath.
 */
import { FabricImage, type Canvas, type FabricObject } from 'fabric'
import { createPhotocopyNoise, createScrapeMasks, type NoiseMark, type PosterPreset, type ScrapeMask } from './editorModel'
import { createSeededRandom } from './random'
import type { Treatment } from './treatments'

export const SCRAPE_TREATMENT_ID_KEY = 'scrapeTreatmentId'
export const SCRAPE_FRAGMENT_KEY = 'scrapeFragment'
export const SCRAPE_CLIP_KEY = 'scrapeClip'

const MAX_SCRAPE_RASTER = 1024

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

function isScrapeClip(clipPath: FabricObject | undefined | null): boolean {
  if (!clipPath) return false
  return Boolean((clipPath as unknown as Record<string, unknown>)[SCRAPE_CLIP_KEY])
}

export function clearScrapeClipPath(canvas: Canvas) {
  if (isScrapeClip(canvas.clipPath as FabricObject | undefined)) {
    canvas.clipPath = undefined
  }
}

function createMaskImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  if (typeof ImageData === 'function') {
    try {
      return new ImageData(data, width, height)
    } catch {
      /* jsdom */
    }
  }
  return { width, height, data, colorSpace: 'srgb' } as ImageData
}

function insideRotatedRect(
  px: number,
  py: number,
  left: number,
  top: number,
  width: number,
  height: number,
  angleDeg: number,
): boolean {
  const cx = left + width / 2
  const cy = top + height / 2
  const angle = (angleDeg * Math.PI) / 180
  const cos = Math.cos(-angle)
  const sin = Math.sin(-angle)
  const dx = px - cx
  const dy = py - cy
  const lx = dx * cos - dy * sin
  const ly = dx * sin + dy * cos
  return Math.abs(lx) <= width / 2 && Math.abs(ly) <= height / 2
}

function punchRect(
  image: ImageData,
  poster: Pick<PosterPreset, 'width' | 'height'>,
  left: number,
  top: number,
  width: number,
  height: number,
  angle: number,
  opacity: number,
) {
  const coverage = Math.min(1, Math.max(0, opacity))
  const { data } = image
  const scaleX = image.width / poster.width
  const scaleY = image.height / poster.height
  const x0 = Math.max(0, Math.floor((left - height) * scaleX))
  const x1 = Math.min(image.width - 1, Math.ceil((left + width + height) * scaleX))
  const y0 = Math.max(0, Math.floor((top - height) * scaleY))
  const y1 = Math.min(image.height - 1, Math.ceil((top + height + width) * scaleY))
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const px = (x + 0.5) / scaleX
      const py = (y + 0.5) / scaleY
      if (!insideRotatedRect(px, py, left, top, width, height, angle)) continue
      const i = (y * image.width + x) * 4
      data[i + 3] = data[i + 3] * (1 - coverage)
    }
  }
}

export function rasterizeScrapeMask(
  poster: Pick<PosterPreset, 'width' | 'height'>,
  bands: ScrapeMask[],
  grit: NoiseMark[],
  rasterWidth: number,
  rasterHeight: number,
): ImageData {
  const image = createMaskImageData(Math.max(1, Math.round(rasterWidth)), Math.max(1, Math.round(rasterHeight)))
  const { data } = image
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255
    data[i + 1] = 255
    data[i + 2] = 255
    data[i + 3] = 255
  }
  for (const band of bands) {
    punchRect(image, poster, band.left, band.top, band.width, band.height, band.angle, band.opacity)
  }
  for (const chip of grit) {
    if (chip.kind === 'speck') {
      punchRect(image, poster, chip.left, chip.top, chip.size, chip.size, 0, chip.opacity * 0.7)
    } else {
      punchRect(
        image,
        poster,
        chip.left,
        chip.top,
        chip.width,
        chip.height,
        chip.angle,
        chip.opacity * 0.55,
      )
    }
  }
  return image
}

function scrapeRasterSize(poster: Pick<PosterPreset, 'width' | 'height'>) {
  const scale = Math.min(1, MAX_SCRAPE_RASTER / Math.max(poster.width, poster.height))
  return {
    width: Math.max(1, Math.round(poster.width * scale)),
    height: Math.max(1, Math.round(poster.height * scale)),
  }
}

function applyScrapeClipPath(
  canvas: Canvas,
  image: ImageData,
  poster: Pick<PosterPreset, 'width' | 'height'>,
) {
  if (typeof document === 'undefined') return
  const element = document.createElement('canvas')
  element.width = image.width
  element.height = image.height
  const ctx = element.getContext('2d')
  if (!ctx) return
  ctx.putImageData(image, 0, 0)
  const clip = new FabricImage(element, {
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    absolutePositioned: true,
    scaleX: poster.width / image.width,
    scaleY: poster.height / image.height,
    selectable: false,
    evented: false,
  })
  clip.set({ [SCRAPE_CLIP_KEY]: true } as Partial<FabricObject>)
  canvas.clipPath = clip
}

export function renderScrapeTreatment(
  canvas: Canvas,
  treatment: Treatment,
  poster: Pick<PosterPreset, 'width' | 'height'>,
  _tagObject: (object: FabricObject, name: string) => void,
) {
  removeScrapeFragments(canvas, treatment.id)
  if (!treatment.enabled) {
    clearScrapeClipPath(canvas)
    return
  }

  const random = createSeededRandom(treatment.seed)
  const count = Math.max(1, Math.min(10, Math.round(treatment.params.count ?? 7)))
  const bands = createScrapeMasks(poster, { count, random })
  const grit: NoiseMark[] = []
  for (const band of bands) {
    grit.push(
      ...createPhotocopyNoise(
        { width: band.width, height: band.height },
        { specks: 9, scratches: 2, scanlines: 0, random },
      ).map((chip) =>
        chip.kind === 'speck'
          ? { ...chip, left: band.left + chip.left, top: band.top + chip.top }
          : { ...chip, left: band.left + chip.left, top: band.top + chip.top },
      ),
    )
  }
  const raster = scrapeRasterSize(poster)
  const image = rasterizeScrapeMask(poster, bands, grit, raster.width, raster.height)
  applyScrapeClipPath(canvas, image, poster)
}
