/**
 * Non-destructive layer masks (Horizon 2.5).
 * White / opaque = reveal, transparent = conceal. Strokes and clip shapes
 * stay on the object so invert / bypass / undo never flatten the source.
 */
import { classRegistry, FabricImage, Point, util, type FabricObject } from 'fabric'

export const LAYER_MASK_KEY = 'layerMask'

export type MaskStroke = {
  x: number
  y: number
  radius: number
  hardness: number
  reveal: boolean
}

export type ClipGeom = {
  kind: 'ellipse' | 'rect' | 'polygon'
  cx: number
  cy: number
  rx: number
  ry: number
  angle: number
  points?: { x: number; y: number }[]
}

export type LayerMask = {
  enabled: boolean
  inverted: boolean
  clipJson?: Record<string, unknown> | null
  clipGeom?: ClipGeom | null
  strokes: MaskStroke[]
}

const MAX_RASTER = 512

export function emptyLayerMask(): LayerMask {
  return { enabled: true, inverted: false, clipJson: null, clipGeom: null, strokes: [] }
}

export function readLayerMask(object: FabricObject | null): LayerMask | null {
  if (!object) return null
  const raw = (object as unknown as Record<string, unknown>)[LAYER_MASK_KEY]
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Partial<LayerMask>
  return {
    enabled: record.enabled !== false,
    inverted: Boolean(record.inverted),
    clipJson: record.clipJson ?? null,
    clipGeom: record.clipGeom ?? null,
    strokes: Array.isArray(record.strokes) ? record.strokes : [],
  }
}

export function writeLayerMask(object: FabricObject, mask: LayerMask | null) {
  object.set({ [LAYER_MASK_KEY]: mask } as Partial<FabricObject>)
}

export function hasMaskContent(mask: LayerMask | null): mask is LayerMask {
  if (!mask) return false
  return Boolean(mask.clipJson || mask.clipGeom || mask.strokes.length > 0)
}

export function layerMaskLabel(mask: LayerMask): string {
  if (mask.clipGeom || mask.clipJson) {
    return mask.strokes.length > 0 ? `Mask·clip·${mask.strokes.length}` : 'Mask·clip'
  }
  return mask.strokes.length > 0 ? `Mask·${mask.strokes.length}` : 'Mask'
}

export function objectUnscaledSize(object: FabricObject): { width: number; height: number } {
  const rx = Number((object as unknown as { rx?: number }).rx)
  const ry = Number((object as unknown as { ry?: number }).ry)
  const width = Number(object.width) || (Number.isFinite(rx) ? rx * 2 : 0)
  const height = Number(object.height) || (Number.isFinite(ry) ? ry * 2 : 0)
  return { width: Math.max(1, width), height: Math.max(1, height) }
}

export function canvasPointToMaskLocal(
  object: FabricObject,
  canvasX: number,
  canvasY: number,
): { x: number; y: number } {
  const local = util.transformPoint(
    new Point(canvasX, canvasY),
    util.invertTransform(object.calcTransformMatrix()),
  )
  const size = objectUnscaledSize(object)
  return { x: local.x / size.width + 0.5, y: local.y / size.height + 0.5 }
}

export function brushRadiusForSize(size: number): number {
  const clamped = Math.min(100, Math.max(4, size))
  return 0.03 + (clamped / 100) * 0.28
}

export function stampsAlongSegment(
  from: { x: number; y: number },
  to: { x: number; y: number },
  spacing: number,
): { x: number; y: number }[] {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.hypot(dx, dy)
  const gap = Math.max(0.004, spacing)
  if (dist < gap) return [to]
  const steps = Math.max(1, Math.ceil(dist / gap))
  const stamps: { x: number; y: number }[] = []
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps
    stamps.push({ x: from.x + dx * t, y: from.y + dy * t })
  }
  return stamps
}

function createMaskImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  if (typeof ImageData === 'function') {
    try {
      return new ImageData(data, width, height)
    } catch {
      /* jsdom ImageData may reject a buffer */
    }
  }
  return { width, height, data, colorSpace: 'srgb' } as ImageData
}

function fillOpaque(image: ImageData) {
  const { data } = image
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255
    data[i + 1] = 255
    data[i + 2] = 255
    data[i + 3] = 255
  }
}

function pixelInsideClip(nx: number, ny: number, clip: ClipGeom): boolean {
  if (clip.kind === 'polygon' && clip.points && clip.points.length >= 3) {
    return pointInPolygon(nx, ny, clip.points)
  }
  const dx = nx - clip.cx
  const dy = ny - clip.cy
  const angle = (clip.angle * Math.PI) / 180
  const cos = Math.cos(-angle)
  const sin = Math.sin(-angle)
  const lx = dx * cos - dy * sin
  const ly = dx * sin + dy * cos
  const rx = Math.max(0.001, clip.rx)
  const ry = Math.max(0.001, clip.ry)
  if (clip.kind === 'rect') {
    return Math.abs(lx) <= rx && Math.abs(ly) <= ry
  }
  return (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) <= 1
}

function pointInPolygon(x: number, y: number, points: { x: number; y: number }[]): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const pi = points[i]
    const pj = points[j]
    if (!pi || !pj) continue
    const intersect = pi.y > y !== pj.y > y && x < ((pj.x - pi.x) * (y - pi.y)) / (pj.y - pi.y + 1e-8) + pi.x
    if (intersect) inside = !inside
  }
  return inside
}

function applyClipShape(image: ImageData, clip: ClipGeom) {
  const { width, height, data } = image
  for (let y = 0; y < height; y += 1) {
    const ny = (y + 0.5) / height
    for (let x = 0; x < width; x += 1) {
      const nx = (x + 0.5) / width
      const i = (y * width + x) * 4
      if (pixelInsideClip(nx, ny, clip)) {
        data[i] = 255
        data[i + 1] = 255
        data[i + 2] = 255
        data[i + 3] = 255
      } else {
        data[i] = 0
        data[i + 1] = 0
        data[i + 2] = 0
        data[i + 3] = 0
      }
    }
  }
}

function stampStroke(image: ImageData, stroke: MaskStroke) {
  const { width, height, data } = image
  const radiusPx = Math.max(1, stroke.radius * Math.min(width, height))
  const cx = stroke.x * width
  const cy = stroke.y * height
  const x0 = Math.max(0, Math.floor(cx - radiusPx - 1))
  const x1 = Math.min(width - 1, Math.ceil(cx + radiusPx + 1))
  const y0 = Math.max(0, Math.floor(cy - radiusPx - 1))
  const y1 = Math.min(height - 1, Math.ceil(cy + radiusPx + 1))
  const hardness = Math.min(0.95, Math.max(0, stroke.hardness))

  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / radiusPx
      if (d > 1) continue
      const t = d <= hardness ? 1 : 1 - (d - hardness) / (1 - hardness)
      const coverage = t * t
      const i = (y * width + x) * 4
      const alpha = data[i + 3]
      if (stroke.reveal) {
        const next = alpha + (255 - alpha) * coverage
        data[i] = 255
        data[i + 1] = 255
        data[i + 2] = 255
        data[i + 3] = next
      } else {
        data[i + 3] = alpha * (1 - coverage)
      }
    }
  }
}

function invertAlpha(image: ImageData) {
  const { data } = image
  for (let i = 3; i < data.length; i += 4) {
    data[i] = 255 - data[i]
  }
}

export function rasterizeLayerMask(mask: LayerMask, width: number, height: number): ImageData {
  const image = createMaskImageData(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)))
  if (mask.clipGeom) applyClipShape(image, mask.clipGeom)
  else fillOpaque(image)
  for (const stroke of mask.strokes) stampStroke(image, stroke)
  if (mask.inverted) invertAlpha(image)
  return image
}

export function captureClipGeom(mask: FabricObject, content: FabricObject): ClipGeom {
  const contentSize = objectUnscaledSize(content)
  const toLocal = (x: number, y: number) => canvasPointToMaskLocal(content, x, y)
  const center = mask.getCenterPoint()
  const localCenter = toLocal(center.x, center.y)
  const maskSize = objectUnscaledSize(mask)
  const scaledW = maskSize.width * Math.abs(mask.scaleX ?? 1)
  const scaledH = maskSize.height * Math.abs(mask.scaleY ?? 1)
  const rx = scaledW / 2 / contentSize.width
  const ry = scaledH / 2 / contentSize.height
  const angle = (mask.angle ?? 0) - (content.angle ?? 0)

  if (mask.type === 'polygon') {
    const points = ((mask as unknown as { points?: { x: number; y: number }[] }).points ?? []).map((point) =>
      toLocal((mask.left ?? 0) + point.x, (mask.top ?? 0) + point.y),
    )
    return { kind: 'polygon', cx: localCenter.x, cy: localCenter.y, rx, ry, angle, points }
  }
  if (mask.type === 'ellipse') {
    return { kind: 'ellipse', cx: localCenter.x, cy: localCenter.y, rx, ry, angle }
  }
  return { kind: 'rect', cx: localCenter.x, cy: localCenter.y, rx, ry, angle }
}

async function reviveClipObject(json: Record<string, unknown>): Promise<FabricObject | null> {
  const type = String(json.type ?? '')
  if (!type) return null
  try {
    const klass = classRegistry.getClass(type) as {
      fromObject?: (serialized: Record<string, unknown>) => Promise<FabricObject>
    }
    if (!klass?.fromObject) return null
    return await klass.fromObject(json)
  } catch {
    return null
  }
}

function imageDataToElement(image: ImageData): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const element = document.createElement('canvas')
  element.width = image.width
  element.height = image.height
  const ctx = element.getContext('2d')
  if (!ctx) return null
  ctx.putImageData(image, 0, 0)
  return element
}

function rasterSize(width: number, height: number) {
  const scale = Math.min(1, MAX_RASTER / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export async function applyLayerMask(object: FabricObject): Promise<void> {
  const mask = readLayerMask(object)
  if (!mask || !mask.enabled || !hasMaskContent(mask)) {
    object.set({ clipPath: undefined } as Partial<FabricObject>)
    return
  }

  if (mask.strokes.length === 0 && mask.clipJson) {
    const clip = await reviveClipObject(mask.clipJson)
    if (clip) {
      clip.set({
        absolutePositioned: true,
        inverted: mask.inverted,
        selectable: false,
        evented: false,
      } as Partial<FabricObject>)
      object.set({ clipPath: clip, objectCaching: true } as Partial<FabricObject>)
      object.dirty = true
      return
    }
  }

  const size = objectUnscaledSize(object)
  const raster = rasterSize(size.width, size.height)
  const image = rasterizeLayerMask(mask, raster.width, raster.height)
  const element = imageDataToElement(image)
  if (!element) return
  const clipImage = new FabricImage(element, {
    originX: 'center',
    originY: 'center',
    scaleX: size.width / raster.width,
    scaleY: size.height / raster.height,
    selectable: false,
    evented: false,
  })
  object.set({ clipPath: clipImage, objectCaching: true } as Partial<FabricObject>)
  object.dirty = true
}

export async function applyAllLayerMasks(objects: FabricObject[]): Promise<void> {
  for (const object of objects) {
    if (readLayerMask(object)) await applyLayerMask(object)
  }
}
