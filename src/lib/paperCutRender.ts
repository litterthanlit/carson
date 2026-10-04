/**
 * Render a paper cut (Slice, Tear collage) on the canvas: the source stays
 * editable and clickable; each piece is the source's print with the piece's
 * outline as its clip, moved by hand. A tear through printed paper shows the
 * sheet's pale core along the torn edge.
 *
 * Pieces are never stored (excludeFromExport); they're rebuilt from the seed
 * whenever the source changes, like the other live artifacts.
 */
import { FabricImage, Polygon, type Canvas, type FabricObject } from 'fabric'
import { isOpaqueSource } from './copyMachine'
import { cutPaper, type CutDirection, type CutStyle, type Point } from './paperCuts'
import { createSeededRandom } from './random'
import { readSliceProp } from './sliceTreatment'
import { layerFrame } from './tapeLiftTreatment'
import type { Treatment } from './treatments'

const MAX_RASTER = 4000

export type PaperCutSpec = {
  style: CutStyle
  direction: CutDirection
  pieces: number
  separationMm: number
  slideMm: number
  turnDeg: number
}

export type PaperCutKeys = { sourceKey: string; treatmentKey: string }

export function renderPaperCut(
  canvas: Canvas,
  source: FabricObject,
  treatment: Treatment,
  spec: PaperCutSpec,
  keys: PaperCutKeys,
  tag: (object: FabricObject, index: number) => void,
  pxPerMm = 11.8,
  paperColor = '#f6f3ec',
) {
  if (!treatment.enabled || typeof document === 'undefined') return
  const sourceId = String(readSliceProp(source, 'id') ?? 'layer')
  const random = createSeededRandom(treatment.seed)

  // The print, at its resting opacity, axis-aligned in poster space.
  const baseline = readSliceProp(source, 'transformBaseline') as { opacity?: number } | undefined
  const resting = baseline?.opacity ?? 1
  const shown = source.opacity
  source.set({ opacity: resting > 0.01 ? resting : 1 })
  const bounds = source.getBoundingRect()
  const k = Math.min(1, MAX_RASTER / Math.max(1, bounds.width, bounds.height))
  const raster = source.toCanvasElement({ multiplier: k, enableRetinaScaling: false })
  source.set({ opacity: shown })
  const rw = raster.width
  const rh = raster.height
  const context = raster.getContext('2d')
  if (!context) return

  const frame = layerFrame(source)
  const width = frame.halfW * 2
  const height = frame.halfH * 2
  const toPoster = (p: Point) => ({
    x: frame.center.x + frame.ex.x * (p.x - frame.halfW) + frame.ey.x * (p.y - frame.halfH),
    y: frame.center.y + frame.ex.y * (p.x - frame.halfW) + frame.ey.y * (p.y - frame.halfH),
  })
  const toRaster = (p: { x: number; y: number }) => ({
    x: (p.x - bounds.left) * (rw / Math.max(1, bounds.width)),
    y: (p.y - bounds.top) * (rh / Math.max(1, bounds.height)),
  })

  const pieces = cutPaper(width, height, { ...spec, pxPerMm }, random)

  // A tear through printed paper bares the sheet's pale core along the edge.
  if (spec.style === 'tear' && isOpaqueSource(context.getImageData(0, 0, rw, rh))) {
    const rimRandom = createSeededRandom((treatment.seed ^ 0x51ed27) >>> 0)
    context.save()
    context.globalCompositeOperation = 'source-atop'
    context.strokeStyle = paperColor
    context.lineJoin = 'round'
    for (let p = 1; p < pieces.length; p++) {
      // The edge shared by pieces p-1 and p: the first half of piece p's outline.
      const half = pieces[p].polygon.slice(0, pieces[p].polygon.length / 2)
      for (let pass = 0; pass < 2; pass++) {
        context.globalAlpha = 0.55 + rimRandom() * 0.3
        context.lineWidth = Math.max(1, (0.5 + rimRandom() * 0.9) * pxPerMm * k)
        context.beginPath()
        half.forEach((point, index) => {
          const r = toRaster(toPoster(point))
          const jitter = 0.25 * pxPerMm * k
          const x = r.x + (rimRandom() - 0.5) * jitter
          const y = r.y + (rimRandom() - 0.5) * jitter
          if (index === 0) context.moveTo(x, y)
          else context.lineTo(x, y)
        })
        context.stroke()
      }
    }
    context.restore()
  }

  const shift = (p: { x: number; y: number }) => toPoster(p)
  const objects: FabricObject[] = pieces.map((piece, index) => {
    // Image-local (centred, unscaled) outline for the clip.
    const clipPoints = piece.polygon.map((point) => {
      const r = toRaster(toPoster(point))
      return { x: r.x - rw / 2, y: r.y - rh / 2 }
    })
    // Where the hand put it: turn about the piece's pivot, then move.
    const pivot = shift(piece.pivot)
    const moved = shift({ x: piece.pivot.x + piece.dx, y: piece.pivot.y + piece.dy })
    const centre = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
    const radians = (piece.angle * Math.PI) / 180
    const turned = {
      x: pivot.x + (centre.x - pivot.x) * Math.cos(radians) - (centre.y - pivot.y) * Math.sin(radians),
      y: pivot.y + (centre.x - pivot.x) * Math.sin(radians) + (centre.y - pivot.y) * Math.cos(radians),
    }
    const image = new FabricImage(raster, {
      originX: 'center',
      originY: 'center',
      left: turned.x + (moved.x - pivot.x),
      top: turned.y + (moved.y - pivot.y),
      angle: piece.angle,
      scaleX: bounds.width / rw,
      scaleY: bounds.height / rh,
      globalCompositeOperation: source.globalCompositeOperation ?? 'source-over',
      clipPath: new Polygon(clipPoints, { strokeWidth: 0, objectCaching: false }),
      selectable: false,
      evented: false,
      excludeFromExport: true,
      [keys.sourceKey]: sourceId,
      [keys.treatmentKey]: treatment.id,
    } as Partial<FabricImage>)
    tag(image, index)
    image.set({ selectable: false, evented: false } as Partial<FabricObject>)
    return image
  })

  const at = canvas.getObjects().indexOf(source)
  objects.forEach((object, offset) => {
    if (at >= 0) canvas.insertAt(at + 1 + offset, object)
    else canvas.add(object)
  })

  // Hidden but clickable: clicking the cut pieces selects the source.
  source.set({ opacity: 0, evented: true } as Partial<FabricObject>)
  source.setCoords()
}

