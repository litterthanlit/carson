/**
 * Letter break treatment — the source textbox stays editable; its letters are
 * re-cut into vector pieces (one-letter textboxes with a clip) every render.
 *
 * Pieces sit just above the source in the stack, so a broken word keeps its
 * place among the collage. If the source carries a hard-edged mask (a weave,
 * a torn edge), each piece is cut by that mask in poster space: a piece that
 * slides under a scrap is still hidden by it.
 */
import { Group, Path, Point, Rect, Textbox, util, type Canvas, type FabricObject, type TMat2D } from 'fabric'
import { diff, intersection, union, type Geometry, type MultiPolygon, type Polygon as MartinezPolygon } from 'martinez-polygon-clipping'
import { breakGlyph, letterBreakParamsFromRecord, type BreakPiece, type InkPlane } from './letterBreak'
import { hasMaskContent, objectUnscaledSize, readLayerMask } from './layerMask'
import { createSeededRandom } from './random'
import { readSliceProp } from './sliceTreatment'
import type { Treatment } from './treatments'

export const LETTER_BREAK_SOURCE_ID_KEY = 'letterBreakSourceId'
export const LETTER_BREAK_TREATMENT_ID_KEY = 'letterBreakTreatmentId'

/** Font size of the glyph raster the cuts are found on. */
const ANALYSIS_EM = 128

export type LetterBreakTagger = (object: FabricObject, glyphText: string) => void

export function isLetterBreakPiece(object: FabricObject | Record<string, unknown>): boolean {
  return Boolean((object as Record<string, unknown>)[LETTER_BREAK_SOURCE_ID_KEY])
}

export function letterBreakSourceIdOf(object: FabricObject): string | null {
  const value = readSliceProp(object, LETTER_BREAK_SOURCE_ID_KEY)
  return value ? String(value) : null
}

export function findLetterBreakPieces(canvas: Canvas, treatmentId: string): FabricObject[] {
  return canvas.getObjects().filter((object) => readSliceProp(object, LETTER_BREAK_TREATMENT_ID_KEY) === treatmentId)
}

export function removeLetterBreakPieces(canvas: Canvas, treatmentId: string) {
  for (const piece of findLetterBreakPieces(canvas, treatmentId)) canvas.remove(piece)
}

export function removeLetterBreakPiecesForSource(canvas: Canvas, sourceId: string) {
  for (const object of [...canvas.getObjects()]) {
    if (readSliceProp(object, LETTER_BREAK_SOURCE_ID_KEY) === sourceId) canvas.remove(object)
  }
}

export function stripLetterBreakPieces(canvas: Canvas) {
  for (const object of [...canvas.getObjects()]) if (isLetterBreakPiece(object)) canvas.remove(object)
}

/** Pieces are rebuilt from the source on load; don't store them. */
export function omitLetterBreakPiecesFromCanvasJSON<T extends { objects?: unknown[] }>(json: T): T {
  if (!Array.isArray(json.objects)) return json
  return {
    ...json,
    objects: json.objects.filter((object) => !object || typeof object !== 'object' || !isLetterBreakPiece(object as Record<string, unknown>)),
  }
}

type TextInternals = Textbox & {
  _textLines: string[][]
  __charBounds: { left: number; width: number }[][]
  _getLineLeftOffset: (lineIndex: number) => number
}

const GLYPH_PROPS = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'fill',
  'stroke',
  'strokeWidth',
  'paintFirst',
  'lineHeight',
  'charSpacing',
  'globalCompositeOperation',
] as const

function glyphOptions(source: Textbox): Record<string, unknown> {
  const options: Record<string, unknown> = {}
  for (const key of GLYPH_PROPS) options[key] = (source as unknown as Record<string, unknown>)[key]
  return options
}

/** The glyph's ink on a small raster, in the glyph's own top-left frame plus `pad`. */
function glyphInk(grapheme: string, source: Textbox, width: number, height: number) {
  const fontSize = Number(source.fontSize) || 80
  const k = ANALYSIS_EM / fontSize
  const pad = fontSize * 0.5
  const planeWidth = Math.max(4, Math.ceil((width + pad * 2) * k))
  const planeHeight = Math.max(4, Math.ceil((height + pad * 2) * k))
  const element = document.createElement('canvas')
  element.width = planeWidth
  element.height = planeHeight
  const context = element.getContext('2d')
  const alpha = new Float32Array(planeWidth * planeHeight)
  if (context) {
    const probe = new Textbox(grapheme, {
      ...glyphOptions(source),
      fill: '#000',
      stroke: source.stroke ? '#000' : null,
      width,
      textAlign: 'left',
      left: 0,
      top: 0,
      originX: 'left',
      originY: 'top',
      opacity: 1,
      globalCompositeOperation: 'source-over',
      objectCaching: false,
    })
    context.scale(k, k)
    context.translate(pad, pad)
    probe.render(context)
    const { data } = context.getImageData(0, 0, planeWidth, planeHeight)
    for (let p = 0; p < alpha.length; p++) alpha[p] = data[p * 4 + 3] / 255
  }
  const plane: InkPlane = { width: planeWidth, height: planeHeight, alpha }
  return { plane, k, pad, em: fontSize * k }
}

type Ring = [number, number][]

function toPoster(matrix: TMat2D, x: number, y: number): [number, number] {
  const point = util.transformPoint(new Point(x, y), matrix)
  return [point.x, point.y]
}

/**
 * The source's mask as poster-space polygons, when it is hard-edged: a kept
 * outline (torn edge) and concealed outlines (weave cuts, plain selections).
 * Painted or feathered masks return null — pieces then ignore the mask.
 */
function sourceMaskPolygons(source: FabricObject): { keep: Ring | null; conceal: Ring[] } | null {
  const mask = readLayerMask(source)
  if (!mask || !mask.enabled || !hasMaskContent(mask)) return null
  if (mask.inverted || mask.strokes.length > 0 || mask.clipJson) return null
  const size = objectUnscaledSize(source)
  const matrix = source.calcTransformMatrix()
  const ring = (points: { x: number; y: number }[]): Ring =>
    points.map((point) => toPoster(matrix, (point.x - 0.5) * size.width, (point.y - 0.5) * size.height))
  const keep = mask.clipGeom?.kind === 'polygon' && (mask.clipGeom.points?.length ?? 0) >= 3 ? ring(mask.clipGeom.points ?? []) : null
  const conceal = (mask.regions ?? [])
    .filter((region) => region.op === 'conceal' && !region.inverted && !region.feather && region.points.length >= 3)
    .map((region) => ring(region.points))
  if (!keep && conceal.length === 0) return null
  return { keep, conceal }
}

const close = (ring: Ring): Ring => (ring.length > 0 ? [...ring, ring[0]] : ring)

/** Rects (piece-local) cut by the poster-space mask, back as a piece-local evenodd path. */
function maskedClip(rects: { x0: number; y0: number; x1: number; y1: number }[], matrix: TMat2D, mask: { keep: Ring | null; conceal: Ring[] }): FabricObject | null {
  const rectPolygons: MartinezPolygon[] = rects.map((rect) => [
    close([
      toPoster(matrix, rect.x0, rect.y0),
      toPoster(matrix, rect.x1, rect.y0),
      toPoster(matrix, rect.x1, rect.y1),
      toPoster(matrix, rect.x0, rect.y1),
    ]),
  ])
  // Martinez hands back an empty list when nothing is left; treat that as gone.
  const solid = (geometry: Geometry | null | undefined): Geometry | null =>
    geometry && (geometry as unknown[]).length > 0 ? geometry : null
  let shape: Geometry | null = rectPolygons.length === 1 ? rectPolygons[0] : solid(union(rectPolygons[0], rectPolygons.slice(1) as MultiPolygon))
  if (shape && mask.keep) shape = solid(intersection(shape, [close(mask.keep)]))
  for (const conceal of mask.conceal) {
    if (!shape) break
    shape = solid(diff(shape, [close(conceal)]))
  }
  if (!shape) return null
  const polygons = (isMultiPolygon(shape) ? shape : [shape]) as MartinezPolygon[]
  const inverse = util.invertTransform(matrix)
  const commands: string[] = []
  for (const polygon of polygons) {
    for (const ring of polygon) {
      if (ring.length < 3) continue
      const local = ring.map(([x, y]) => util.transformPoint(new Point(x, y), inverse))
      commands.push(`M ${local.map((point) => `${point.x} ${point.y}`).join(' L ')} Z`)
    }
  }
  if (commands.length === 0) return null
  return new Path(commands.join(' '), { fill: '#000', fillRule: 'evenodd', strokeWidth: 0, objectCaching: false })
}

function isMultiPolygon(shape: Geometry): shape is MultiPolygon {
  const first = (shape as unknown[])[0] as unknown[] | undefined
  const inner = first?.[0] as unknown[] | undefined
  return Array.isArray(inner?.[0])
}

function rectClip(rects: { x0: number; y0: number; x1: number; y1: number }[]): FabricObject {
  const shapes = rects.map(
    (rect) =>
      new Rect({
        left: (rect.x0 + rect.x1) / 2,
        top: (rect.y0 + rect.y1) / 2,
        width: rect.x1 - rect.x0,
        height: rect.y1 - rect.y0,
        originX: 'center',
        originY: 'center',
        strokeWidth: 0,
        fill: '#000',
      }),
  )
  return shapes.length === 1 ? shapes[0] : new Group(shapes, { objectCaching: false })
}

export function renderLetterBreakTreatment(
  canvas: Canvas,
  source: FabricObject,
  treatment: Treatment,
  tag: LetterBreakTagger,
) {
  removeLetterBreakPieces(canvas, treatment.id)
  if (!treatment.enabled || source.type !== 'textbox' || typeof document === 'undefined') return

  const text = source as TextInternals
  text.initDimensions()
  const sourceId = String(readSliceProp(source, 'id') ?? 'type')
  const params = letterBreakParamsFromRecord(treatment.params)
  const random = createSeededRandom(treatment.seed)
  const sourceMatrix = source.calcTransformMatrix()
  const mask = sourceMaskPolygons(source)
  const baseline = readSliceProp(source, 'transformBaseline') as { opacity?: number } | undefined
  const opacity = baseline?.opacity ?? 1
  const fontSize = Number(text.fontSize) || 80
  const pieces: FabricObject[] = []

  let lineTop = -(text.height ?? 0) / 2
  text._textLines.forEach((line, lineIndex) => {
    const lineLeft = -(text.width ?? 0) / 2 + text._getLineLeftOffset(lineIndex)
    line.forEach((grapheme, charIndex) => {
      if (/^\s*$/.test(grapheme)) return
      const bounds = text.__charBounds[lineIndex]?.[charIndex]
      if (!bounds) return
      const glyph = new Textbox(grapheme, { ...glyphOptions(text), width: fontSize * 3, textAlign: 'left' })
      const width = glyph.width ?? fontSize
      const height = glyph.height ?? fontSize
      const ink = glyphInk(grapheme, text, width, height)
      const breaks = random() < params.letters / 100
      const cut: BreakPiece[] = breaks ? breakGlyph(ink.plane, ink.em, params, random) : []
      const whole: BreakPiece = {
        rect: { x0: 0, y0: 0, x1: ink.plane.width, y1: ink.plane.height },
        dx: 0,
        dy: 0,
        dropped: false,
      }
      const kept = (cut.length > 0 ? cut : [whole]).filter((piece) => !piece.dropped)

      // Pieces that moved together render together.
      const byOffset = new Map<string, BreakPiece[]>()
      for (const piece of kept) {
        const key = `${piece.dx.toFixed(2)},${piece.dy.toFixed(2)}`
        byOffset.set(key, [...(byOffset.get(key) ?? []), piece])
      }
      for (const group of byOffset.values()) {
        const dx = group[0].dx / ink.k
        const dy = group[0].dy / ink.k
        const centre = toPoster(sourceMatrix, lineLeft + bounds.left + width / 2 + dx, lineTop + height / 2 + dy)
        const piece = new Textbox(grapheme, {
          ...glyphOptions(text),
          width,
          textAlign: 'left',
          originX: 'center',
          originY: 'center',
          left: centre[0],
          top: centre[1],
          angle: source.angle ?? 0,
          scaleX: source.scaleX ?? 1,
          scaleY: source.scaleY ?? 1,
          skewX: source.skewX ?? 0,
          skewY: source.skewY ?? 0,
          flipX: source.flipX ?? false,
          flipY: source.flipY ?? false,
          opacity,
          selectable: false,
          evented: false,
          [LETTER_BREAK_SOURCE_ID_KEY]: sourceId,
          [LETTER_BREAK_TREATMENT_ID_KEY]: treatment.id,
        } as Partial<Textbox>)
        // Plane px → the piece's own centred frame.
        const rects = group.map((item) => ({
          x0: item.rect.x0 / ink.k - ink.pad - width / 2,
          y0: item.rect.y0 / ink.k - ink.pad - height / 2,
          x1: item.rect.x1 / ink.k - ink.pad - width / 2,
          y1: item.rect.y1 / ink.k - ink.pad - height / 2,
        }))
        const isWhole = cut.length === 0
        if (mask) {
          const clip = maskedClip(rects, piece.calcTransformMatrix(), mask)
          if (!clip) continue
          piece.set({ clipPath: clip })
        } else if (!isWhole) {
          piece.set({ clipPath: rectClip(rects) })
        }
        tag(piece, grapheme)
        piece.set({ selectable: false, evented: false } as Partial<FabricObject>)
        pieces.push(piece)
      }
    })
    lineTop += text.getHeightOfLine(lineIndex)
  })

  const index = canvas.getObjects().indexOf(source)
  pieces.forEach((piece, offset) => {
    if (index >= 0) canvas.insertAt(index + 1 + offset, piece)
    else canvas.add(piece)
  })

  // Hidden but still clickable: clicking the broken word selects its source to edit.
  source.set({ opacity: 0, evented: true } as Partial<FabricObject>)
  source.setCoords()
}
