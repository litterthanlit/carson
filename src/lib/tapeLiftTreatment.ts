/**
 * Tape lift treatment — the source stays editable; two companions are made
 * from it on every render:
 *
 *   print — the layer as it looks after the tape came off: ink pulled out of
 *           the taped band, fibre by fibre, and paper skin torn where the tape
 *           gripped too hard;
 *   strip — the tape itself, carrying exactly the ink the print lost (and the
 *           torn paper fibres), stuck back down nearby by hand.
 *
 * Companions are never stored (excludeFromExport keeps them out of saves and
 * undo snapshots); they're rebuilt from the seed whenever the source changes.
 */
import { FabricImage, Point, util, type Canvas, type FabricObject } from 'fabric'
import { isOpaqueSource } from './copyMachine'
import { paintFoundPaper, tapeOutline } from './foundPaper'
import { readSliceProp } from './sliceTreatment'
import {
  releaseField,
  liftMaps,
  pressureField,
  relaidPose,
  tapeBand,
  tapeLiftParamsFromRecord,
  tapeLiftRandom,
  type LayerFrame,
} from './tapeLift'
import type { Treatment } from './treatments'

export const TAPE_LIFT_SOURCE_ID_KEY = 'tapeLiftSourceId'
export const TAPE_LIFT_TREATMENT_ID_KEY = 'tapeLiftTreatmentId'

/** Longest side of the rasters. Poster-resolution for most layers, capped for giants. */
const MAX_RASTER = 3000

export type TapeLiftPart = 'print' | 'strip'
export type TapeLiftTagger = (object: FabricObject, part: TapeLiftPart) => void

export function isTapeLiftCompanion(object: FabricObject | Record<string, unknown>): boolean {
  return Boolean((object as Record<string, unknown>)[TAPE_LIFT_SOURCE_ID_KEY])
}

export function removeTapeLiftCompanions(canvas: Canvas, treatmentId: string) {
  for (const object of [...canvas.getObjects()]) {
    if (readSliceProp(object, TAPE_LIFT_TREATMENT_ID_KEY) === treatmentId) canvas.remove(object)
  }
}

export function removeTapeLiftCompanionsForSource(canvas: Canvas, sourceId: string) {
  for (const object of [...canvas.getObjects()]) {
    if (readSliceProp(object, TAPE_LIFT_SOURCE_ID_KEY) === sourceId) canvas.remove(object)
  }
}

export function stripTapeLiftCompanions(canvas: Canvas) {
  for (const object of [...canvas.getObjects()]) if (isTapeLiftCompanion(object)) canvas.remove(object)
}

function parseColor(color: string): [number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim())
  if (hex) {
    const value = parseInt(hex[1], 16)
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
  }
  return [246, 243, 236]
}

export function layerFrame(source: FabricObject): LayerFrame {
  const matrix = source.calcTransformMatrix()
  const at = (x: number, y: number) => util.transformPoint(new Point(x, y), matrix)
  const center = at(0, 0)
  const width = (source.width ?? 0) / 2
  const height = (source.height ?? 0) / 2
  const right = at(width, 0)
  const down = at(0, height)
  const halfW = Math.max(1, Math.hypot(right.x - center.x, right.y - center.y))
  const halfH = Math.max(1, Math.hypot(down.x - center.x, down.y - center.y))
  return {
    center: { x: center.x, y: center.y },
    ex: { x: (right.x - center.x) / halfW, y: (right.y - center.y) / halfW },
    ey: { x: (down.x - center.x) / halfH, y: (down.y - center.y) / halfH },
    halfW,
    halfH,
  }
}

/**
 * Shrink the layer frame to where the ink actually is — a text box is often
 * much wider than its words, and nobody tapes over empty paper.
 */
function inkFrame(
  frame: LayerFrame,
  image: ImageData,
  bounds: { left: number; top: number },
  kx: number,
  ky: number,
): LayerFrame {
  const { width, height, data } = image
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  const step = Math.max(1, Math.round(Math.max(width, height) / 600))
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (data[(y * width + x) * 4 + 3] < 24) continue
      const px = bounds.left + (x + 0.5) / kx - frame.center.x
      const py = bounds.top + (y + 0.5) / ky - frame.center.y
      const along = px * frame.ex.x + py * frame.ex.y
      const across = px * frame.ey.x + py * frame.ey.y
      minX = Math.min(minX, along)
      maxX = Math.max(maxX, along)
      minY = Math.min(minY, across)
      maxY = Math.max(maxY, across)
    }
  }
  if (!Number.isFinite(minX)) return frame
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2
  return {
    center: {
      x: frame.center.x + frame.ex.x * midX + frame.ey.x * midY,
      y: frame.center.y + frame.ex.y * midX + frame.ey.y * midY,
    },
    ex: frame.ex,
    ey: frame.ey,
    halfW: Math.max(1, (maxX - minX) / 2),
    halfH: Math.max(1, (maxY - minY) / 2),
  }
}

function newCanvas(width: number, height: number) {
  const element = document.createElement('canvas')
  element.width = width
  element.height = height
  return element
}

export function renderTapeLiftTreatment(
  canvas: Canvas,
  source: FabricObject,
  treatment: Treatment,
  tag: TapeLiftTagger,
  paperColor = '#f6f3ec',
  /** Poster px per millimetre, so the toner texture has a physical size. */
  pxPerMm = 11.8,
) {
  removeTapeLiftCompanions(canvas, treatment.id)
  if (!treatment.enabled || typeof document === 'undefined') return

  const sourceId = String(readSliceProp(source, 'id') ?? 'layer')
  const params = tapeLiftParamsFromRecord(treatment.params)
  const random = tapeLiftRandom(treatment.seed)
  const paper = parseColor(paperColor)

  // The print as it was before the tape: rasterise the source at its resting opacity.
  const baseline = readSliceProp(source, 'transformBaseline') as { opacity?: number } | undefined
  const restingOpacity = baseline?.opacity ?? 1
  const shownOpacity = source.opacity
  source.set({ opacity: restingOpacity > 0.01 ? restingOpacity : 1 })
  const bounds = source.getBoundingRect()
  const k = Math.min(1, MAX_RASTER / Math.max(1, bounds.width, bounds.height))
  const sourceElement = source.toCanvasElement({ multiplier: k, enableRetinaScaling: false })
  source.set({ opacity: shownOpacity })
  const sourceContext = sourceElement.getContext('2d')
  if (!sourceContext) return
  const sw = sourceElement.width
  const sh = sourceElement.height
  const original = sourceContext.getImageData(0, 0, sw, sh)
  const opaque = isOpaqueSource(original)
  const kx = sw / Math.max(1, bounds.width)
  const ky = sh / Math.max(1, bounds.height)

  // The tape: where it went down, how hard it was rubbed, what it pulled.
  const band = tapeBand(inkFrame(layerFrame(source), original, bounds, kx, ky), params, random)
  const tw = Math.max(8, Math.round(band.length * k))
  const th = Math.max(4, Math.round(band.width * k))
  const pressure = pressureField(tw, th, params, random)
  const fibre = releaseField(tw, th, pxPerMm * k, random)
  const { lift, tear } = liftMaps(pressure, fibre, tw, th, params, random)
  const style = params.tape >= 0.5 ? 'tape' : 'saw'
  const outline = tapeOutline(tw, th, treatment.seed, style)
  const footprintElement = newCanvas(tw, th)
  const footprintContext = footprintElement.getContext('2d')
  if (!footprintContext) return
  footprintContext.beginPath()
  outline.forEach((point, index) => (index === 0 ? footprintContext.moveTo(point.x, point.y) : footprintContext.lineTo(point.x, point.y)))
  footprintContext.closePath()
  footprintContext.fill()
  const footprintData = footprintContext.getImageData(0, 0, tw, th).data
  const under = (index: number) => footprintData[index * 4 + 3] / 255

  const origin = {
    x: band.center.x - band.dir.x * (band.length / 2) - band.normal.x * (band.width / 2),
    y: band.center.y - band.dir.y * (band.length / 2) - band.normal.y * (band.width / 2),
  }

  // 1. The print, with the band pulled out of it.
  const print = new ImageData(new Uint8ClampedArray(original.data), sw, sh)
  const out = print.data
  for (let y = 0; y < sh; y++) {
    const py = bounds.top + (y + 0.5) / ky
    for (let x = 0; x < sw; x++) {
      const px = bounds.left + (x + 0.5) / kx
      const rx = px - origin.x
      const ry = py - origin.y
      const u = Math.floor((rx * band.dir.x + ry * band.dir.y) * k)
      const v = Math.floor((rx * band.normal.x + ry * band.normal.y) * k)
      if (u < 0 || v < 0 || u >= tw || v >= th) continue
      const t = v * tw + u
      const cover = under(t)
      if (cover <= 0) continue
      const l = lift[t] * cover
      const torn = tear[t] * cover
      const i = (y * sw + x) * 4
      if (opaque) {
        // Printed paper: lifted ink leaves the stock's own white behind.
        for (let c = 0; c < 3; c++) out[i + c] = Math.round(out[i + c] + (paper[c] - out[i + c]) * l * 0.9)
      } else {
        out[i + 3] = Math.round(out[i + 3] * (1 - l))
      }
      if (torn > 0) {
        // Torn paper skin: rough, a shade brighter than the sheet around it.
        const fleck = 0.6 + Math.max(0, Math.min(1, fibre[t])) * 0.4
        for (let c = 0; c < 3; c++) out[i + c] = Math.round(out[i + c] + (Math.min(255, paper[c] + 6) * fleck + paper[c] * (1 - fleck) - out[i + c]) * torn)
        out[i + 3] = Math.max(out[i + 3], Math.round(255 * torn * 0.65))
      }
    }
  }
  const printElement = newCanvas(sw, sh)
  printElement.getContext('2d')?.putImageData(print, 0, 0)
  const printImage = new FabricImage(printElement, {
    originX: 'left',
    originY: 'top',
    left: bounds.left,
    top: bounds.top,
    scaleX: bounds.width / sw,
    scaleY: bounds.height / sh,
    angle: 0,
    globalCompositeOperation: source.globalCompositeOperation ?? 'source-over',
    selectable: false,
    evented: false,
    excludeFromExport: true,
    [TAPE_LIFT_SOURCE_ID_KEY]: sourceId,
    [TAPE_LIFT_TREATMENT_ID_KEY]: treatment.id,
  } as Partial<FabricImage>)
  tag(printImage, 'print')
  printImage.set({ selectable: false, evented: false } as Partial<FabricObject>)

  // 2. The strip, carrying what the print lost.
  const companions: FabricObject[] = [printImage]
  const pose = relaidPose(band, params, random)
  if (pose) {
    const ink = new ImageData(tw, th)
    const inkData = ink.data
    const src = original.data
    for (let v = 0; v < th; v++) {
      for (let u = 0; u < tw; u++) {
        const t = v * tw + u
        const cover = under(t)
        if (cover <= 0) continue
        const qx = origin.x + band.dir.x * ((u + 0.5) / k) + band.normal.x * ((v + 0.5) / k)
        const qy = origin.y + band.dir.y * ((u + 0.5) / k) + band.normal.y * ((v + 0.5) / k)
        const sx = Math.floor((qx - bounds.left) * kx)
        const sy = Math.floor((qy - bounds.top) * ky)
        const o = t * 4
        if (sx >= 0 && sy >= 0 && sx < sw && sy < sh) {
          const i = (sy * sw + sx) * 4
          const alpha = src[i + 3] / 255
          const inkness = opaque ? 1 - (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114) / 255 : 1
          // Transferred toner is never quite as dense as it was on the paper.
          const carried = alpha * inkness * lift[t] * cover * 0.9
          inkData[o] = src[i]
          inkData[o + 1] = src[i + 1]
          inkData[o + 2] = src[i + 2]
          inkData[o + 3] = Math.round(255 * carried)
        }
        const torn = tear[t] * cover
        if (torn > 0) {
          // Paper fibres that came away with the tape.
          const a = inkData[o + 3] / 255
          const fibres = torn * (0.55 + Math.max(0, Math.min(1, fibre[t])) * 0.35)
          const total = fibres + a * (1 - fibres)
          for (let c = 0; c < 3; c++) inkData[o + c] = Math.round((paper[c] * fibres + inkData[o + c] * a * (1 - fibres)) / Math.max(1e-6, total))
          inkData[o + 3] = Math.round(255 * total)
        }
      }
    }
    const inkElement = newCanvas(tw, th)
    inkElement.getContext('2d')?.putImageData(ink, 0, 0)

    const stripElement = newCanvas(tw, th)
    const strip = stripElement.getContext('2d')
    if (strip) {
      const material = params.tape >= 0.5 ? 'tape' : 'packing'
      if (pose.mirrored) {
        // Sticky side up: the ink sits on top of the tape.
        paintFoundPaper(strip, material, tw, th, treatment.seed)
        strip.drawImage(inkElement, 0, 0)
      } else {
        // Sticky side down: you see the ink through the tape.
        strip.drawImage(inkElement, 0, 0)
        paintFoundPaper(strip, material, tw, th, treatment.seed)
      }
      strip.globalCompositeOperation = 'destination-in'
      strip.drawImage(footprintElement, 0, 0)
      strip.globalCompositeOperation = 'source-over'
      const stripImage = new FabricImage(stripElement, {
        originX: 'center',
        originY: 'center',
        left: pose.center.x,
        top: pose.center.y,
        angle: pose.angle,
        scaleX: 1 / k,
        scaleY: 1 / k,
        flipY: pose.mirrored,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        [TAPE_LIFT_SOURCE_ID_KEY]: sourceId,
        [TAPE_LIFT_TREATMENT_ID_KEY]: treatment.id,
      } as Partial<FabricImage>)
      tag(stripImage, 'strip')
      stripImage.set({ selectable: false, evented: false } as Partial<FabricObject>)
      companions.push(stripImage)
    }
  }

  const index = canvas.getObjects().indexOf(source)
  companions.forEach((companion, offset) => {
    if (index >= 0) canvas.insertAt(index + 1 + offset, companion)
    else canvas.add(companion)
  })

  // Hidden but still clickable: clicking the lifted print selects its source.
  source.set({ opacity: 0, evented: true } as Partial<FabricObject>)
  source.setCoords()
}
