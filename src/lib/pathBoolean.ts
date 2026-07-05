/**
 * Vector boolean ops via martinez-polygon-clipping (polygon-only MVP).
 * Fabric shapes are sampled to rings in canvas space, then merged back to Path data.
 */
import { Point, util, type Ellipse, type FabricObject, type Polygon as FabricPolygon, type Path as FabricPath, type Rect } from 'fabric'
import { diff, union, type Geometry, type MultiPolygon, type Polygon, type Ring } from 'martinez-polygon-clipping'
import { getPathAnchorPoints, isPathClosed, pathLocalToWorld, type PathData } from './pathEditing'

const ELLIPSE_SEGMENTS = 48

type XY = { x: number; y: number }

const BOOLEAN_TYPES = new Set(['path', 'rect', 'ellipse', 'circle', 'polygon', 'triangle'])

export function isBooleanCapable(object: FabricObject): boolean {
  return BOOLEAN_TYPES.has(object.type ?? '')
}

function isRing(value: unknown): value is Ring {
  return Array.isArray(value) && Array.isArray(value[0]) && typeof value[0][0] === 'number'
}

export function normalizeToMultiPolygon(geometry: Geometry | null): MultiPolygon {
  if (!geometry || geometry.length === 0) return []
  if (isRing(geometry[0])) return [geometry as Polygon]
  return geometry as MultiPolygon
}

function sanitizeRing(ring: Ring): Ring {
  if (ring.length < 3) return ring
  const [firstX, firstY] = ring[0]
  const [lastX, lastY] = ring[ring.length - 1]
  if (firstX === lastX && firstY === lastY) return ring.slice(0, -1)
  return ring
}

function transformLocalPoints(object: FabricObject, localPoints: XY[]): XY[] {
  const matrix = object.calcTransformMatrix()
  return localPoints.map(({ x, y }) => {
    const point = util.transformPoint(new Point(x, y), matrix)
    return { x: point.x, y: point.y }
  })
}

function rectToRing(object: FabricObject): Ring {
  const rect = object as Rect
  const width = rect.width ?? 0
  const height = rect.height ?? 0
  const corners = transformLocalPoints(object, [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ])
  return sanitizeRing(corners.map((point) => [point.x, point.y]))
}

function ellipseToRing(object: FabricObject): Ring {
  const ellipse = object as Ellipse
  const rx = ellipse.rx ?? 0
  const ry = ellipse.ry ?? 0
  const local: XY[] = []
  for (let index = 0; index < ELLIPSE_SEGMENTS; index += 1) {
    const theta = (index / ELLIPSE_SEGMENTS) * Math.PI * 2
    local.push({ x: rx * Math.cos(theta), y: ry * Math.sin(theta) })
  }
  const ring = transformLocalPoints(object, local).map((point) => [point.x, point.y] as [number, number])
  return sanitizeRing(ring)
}

function polygonToRing(object: FabricObject): Ring {
  const polygon = object as FabricPolygon
  const points = polygon.points ?? []
  const ring = transformLocalPoints(
    object,
    points.map((point) => ({ x: point.x, y: point.y })),
  ).map((point) => [point.x, point.y] as [number, number])
  return sanitizeRing(ring)
}

function pathToRing(object: FabricObject): Ring | null {
  const path = object as FabricPath
  const pathData = path.path as PathData | undefined
  if (!pathData || !isPathClosed(pathData)) return null
  const anchors = getPathAnchorPoints(pathData).filter((point) => point.role === 'anchor')
  if (anchors.length < 3) return null
  const ring = anchors.map((anchor) => {
    const world = pathLocalToWorld(path, anchor.x, anchor.y)
    return [world.x, world.y] as [number, number]
  })
  return sanitizeRing(ring)
}

export function fabricObjectToPolygon(object: FabricObject): Polygon | null {
  let ring: Ring | null = null
  if (object.type === 'rect') ring = rectToRing(object)
  else if (object.type === 'ellipse' || object.type === 'circle') ring = ellipseToRing(object)
  else if (object.type === 'polygon' || object.type === 'triangle') ring = polygonToRing(object)
  else if (object.type === 'path') ring = pathToRing(object)
  if (!ring || ring.length < 3) return null
  return [ring]
}

export function booleanUnion(polygons: Polygon[]): MultiPolygon {
  if (polygons.length === 0) return []
  let result: Geometry = polygons[0]
  for (let index = 1; index < polygons.length; index += 1) {
    const next = union(result, polygons[index])
    if (!next) return []
    result = next
  }
  return normalizeToMultiPolygon(result)
}

/** Second polygon punches the first (minuend − subtrahend). */
export function booleanSubtract(minuend: Polygon, subtrahend: Polygon): MultiPolygon {
  return normalizeToMultiPolygon(diff(minuend, subtrahend))
}

export function multiPolygonToPathData(multiPolygon: MultiPolygon): {
  pathData: PathData
  left: number
  top: number
} {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY

  for (const polygon of multiPolygon) {
    for (const ring of polygon) {
      for (const [x, y] of ring) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
      }
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { pathData: [], left: 0, top: 0 }
  }

  const pathData: PathData = []
  for (const polygon of multiPolygon) {
    for (const ring of polygon) {
      if (ring.length < 3) continue
      pathData.push(['M', ring[0][0] - minX, ring[0][1] - minY])
      for (let index = 1; index < ring.length; index += 1) {
        pathData.push(['L', ring[index][0] - minX, ring[index][1] - minY])
      }
      pathData.push(['Z'])
    }
  }

  return { pathData, left: minX, top: minY }
}

export function booleanUnionObjects(objects: FabricObject[]): MultiPolygon {
  const polygons = objects.map(fabricObjectToPolygon).filter((polygon): polygon is Polygon => polygon !== null)
  if (polygons.length !== objects.length) {
    throw new Error('Boolean needs closed shapes')
  }
  return booleanUnion(polygons)
}

export function booleanSubtractObjects(minuend: FabricObject, subtrahend: FabricObject): MultiPolygon {
  const base = fabricObjectToPolygon(minuend)
  const punch = fabricObjectToPolygon(subtrahend)
  if (!base || !punch) throw new Error('Boolean needs closed shapes')
  return booleanSubtract(base, punch)
}
