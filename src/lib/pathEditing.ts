import { Point, util, type Path as FabricPath } from 'fabric'
import { computeSnap } from './snapping'
import { SNAP_SCREEN_THRESHOLD } from './editorConstants'

export type PathAnchorPoint = {
  commandIndex: number
  x: number
  y: number
  role: 'anchor' | 'control-in' | 'control-out'
}

export type PathCommand = [string, ...number[]]
export type PathData = PathCommand[]

export type PathSegmentHit = {
  commandIndex: number
  t: number
  x: number
  y: number
}

type XY = { x: number; y: number }

function commandXY(command: PathCommand): XY | null {
  const token = command[0]
  if (token === 'M' || token === 'L') {
    return { x: command[1], y: command[2] }
  }
  if (token === 'Q') {
    return { x: command[3], y: command[4] }
  }
  if (token === 'C') {
    return { x: command[5], y: command[6] }
  }
  return null
}

function clonePathData(pathData: PathData): PathData {
  return pathData.map((command) => [...command] as PathCommand)
}

function getPreviousAnchor(pathData: PathData, beforeIndex: number): XY | null {
  for (let index = beforeIndex; index >= 0; index -= 1) {
    const anchor = commandXY(pathData[index])
    if (anchor) return anchor
  }
  return null
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function cubicPointAt(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  t: number,
) {
  const u = 1 - t
  const tt = t * t
  const uu = u * u
  const uuu = uu * u
  const ttt = tt * t
  return {
    x: uuu * x0 + 3 * uu * t * x1 + 3 * u * tt * x2 + ttt * x3,
    y: uuu * y0 + 3 * uu * t * y1 + 3 * u * tt * y2 + ttt * y3,
  }
}

function splitCubicAt(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  t: number,
) {
  const p01 = { x: lerp(x0, x1, t), y: lerp(y0, y1, t) }
  const p12 = { x: lerp(x1, x2, t), y: lerp(y1, y2, t) }
  const p23 = { x: lerp(x2, x3, t), y: lerp(y2, y3, t) }
  const p012 = { x: lerp(p01.x, p12.x, t), y: lerp(p01.y, p12.y, t) }
  const p123 = { x: lerp(p12.x, p23.x, t), y: lerp(p12.y, p23.y, t) }
  const point = { x: lerp(p012.x, p123.x, t), y: lerp(p012.y, p123.y, t) }
  return { p01, p12, p23, p012, p123, point }
}

function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 === 0) {
    return { distance: Math.hypot(px - x1, py - y1), t: 0, x: x1, y: y1 }
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const x = x1 + t * dx
  const y = y1 + t * dy
  return { distance: Math.hypot(px - x, py - y), t, x, y }
}

function distanceToCubic(
  px: number,
  py: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
) {
  let best = { distance: Number.POSITIVE_INFINITY, t: 0, x: x0, y: y0 }
  for (let index = 0; index <= 24; index += 1) {
    const t = index / 24
    const point = cubicPointAt(x0, y0, x1, y1, x2, y2, x3, y3, t)
    const distance = Math.hypot(px - point.x, py - point.y)
    if (distance < best.distance) best = { distance, t, x: point.x, y: point.y }
  }
  return best
}

export function getPathAnchorPoints(pathData: PathData): PathAnchorPoint[] {
  const points: PathAnchorPoint[] = []
  pathData.forEach((command, commandIndex) => {
    const token = command[0]
    if (token === 'M' || token === 'L') {
      points.push({ commandIndex, x: command[1], y: command[2], role: 'anchor' })
      return
    }
    if (token === 'Q') {
      points.push({ commandIndex, x: command[1], y: command[2], role: 'control-in' })
      points.push({ commandIndex, x: command[3], y: command[4], role: 'anchor' })
      return
    }
    if (token === 'C') {
      points.push({ commandIndex, x: command[1], y: command[2], role: 'control-out' })
      points.push({ commandIndex, x: command[3], y: command[4], role: 'control-in' })
      points.push({ commandIndex, x: command[5], y: command[6], role: 'anchor' })
    }
  })
  return points
}

export function isPathClosed(pathData: PathData): boolean {
  if (pathData.some((command) => command[0] === 'Z')) return true
  const anchors = getPathAnchorPoints(pathData).filter((point) => point.role === 'anchor')
  if (anchors.length < 2) return false
  const first = anchors[0]
  const last = anchors[anchors.length - 1]
  return Math.hypot(first.x - last.x, first.y - last.y) < 0.5
}

export function closePath(pathData: PathData): PathData {
  if (isPathClosed(pathData)) return pathData
  const first = getPathAnchorPoints(pathData).find((point) => point.role === 'anchor')
  if (!first) return pathData
  const next = clonePathData(pathData)
  next.push(['L', first.x, first.y])
  return next
}

export function deletePathAnchor(pathData: PathData, point: PathAnchorPoint): PathData | null {
  if (point.role !== 'anchor') return null
  const command = pathData[point.commandIndex]
  if (!command) return null
  const anchors = getPathAnchorPoints(pathData).filter((item) => item.role === 'anchor')
  if (anchors.length <= 2) return null
  if (point.commandIndex === 0 && command[0] === 'M') return null

  const next = clonePathData(pathData)
  const token = command[0]

  if (token === 'L') {
    next.splice(point.commandIndex, 1)
    return next
  }

  if (token === 'C' && point.x === command[5] && point.y === command[6]) {
    const following = next[point.commandIndex + 1]
    next.splice(point.commandIndex, 1)
    const previous = getPreviousAnchor(next, point.commandIndex - 1)
    const followingAnchor = following ? commandXY(following) : null
    if (previous && followingAnchor) {
      next.splice(point.commandIndex, 0, ['L', followingAnchor.x, followingAnchor.y])
    }
    return next
  }

  if (token === 'Q' && point.x === command[3] && point.y === command[4]) {
    const following = next[point.commandIndex + 1]
    next.splice(point.commandIndex, 1)
    const previous = getPreviousAnchor(next, point.commandIndex - 1)
    const followingAnchor = following ? commandXY(following) : null
    if (previous && followingAnchor) {
      next.splice(point.commandIndex, 0, ['L', followingAnchor.x, followingAnchor.y])
    }
    return next
  }

  return null
}

export function insertPointOnSegment(
  pathData: PathData,
  commandIndex: number,
  t: number,
  x: number,
  y: number,
): PathData {
  const command = pathData[commandIndex]
  if (!command) return pathData
  const next = clonePathData(pathData)

  if (command[0] === 'L') {
    const endX = command[1]
    const endY = command[2]
    next[commandIndex] = ['L', x, y]
    next.splice(commandIndex + 1, 0, ['L', endX, endY])
    return next
  }

  if (command[0] === 'C') {
    const previous = getPreviousAnchor(pathData, commandIndex - 1)
    if (!previous) return pathData
    const split = splitCubicAt(
      previous.x,
      previous.y,
      command[1],
      command[2],
      command[3],
      command[4],
      command[5],
      command[6],
      t,
    )
    next[commandIndex] = [
      'C',
      split.p01.x,
      split.p01.y,
      split.p012.x,
      split.p012.y,
      split.point.x,
      split.point.y,
    ]
    next.splice(commandIndex + 1, 0, [
      'C',
      split.p123.x,
      split.p123.y,
      split.p23.x,
      split.p23.y,
      command[5],
      command[6],
    ])
    return next
  }

  return pathData
}

export function segmentHitInPathLocal(
  pathData: PathData,
  localX: number,
  localY: number,
  threshold: number,
): PathSegmentHit | null {
  let best: (PathSegmentHit & { distance: number }) | null = null

  for (let commandIndex = 1; commandIndex < pathData.length; commandIndex += 1) {
    const command = pathData[commandIndex]
    if (!command || command[0] === 'Z') continue
    const previous = getPreviousAnchor(pathData, commandIndex - 1)
    if (!previous) continue

    const hit =
      command[0] === 'L'
        ? distanceToSegment(localX, localY, previous.x, previous.y, command[1], command[2])
        : command[0] === 'C'
          ? distanceToCubic(
              localX,
              localY,
              previous.x,
              previous.y,
              command[1],
              command[2],
              command[3],
              command[4],
              command[5],
              command[6],
            )
          : null

    if (!hit || hit.distance > threshold) continue
    if (!best || hit.distance < best.distance) {
      best = { commandIndex, t: hit.t, x: hit.x, y: hit.y, distance: hit.distance }
    }
  }

  if (!best) return null
  return { commandIndex: best.commandIndex, t: best.t, x: best.x, y: best.y }
}

export function movePathPoint(pathData: PathData, point: PathAnchorPoint, x: number, y: number): PathData {
  const next = clonePathData(pathData)
  const command = next[point.commandIndex]
  if (!command) return pathData

  if (point.role === 'anchor') {
    if (command[0] === 'M' || command[0] === 'L') {
      command[1] = x
      command[2] = y
    } else if (command[0] === 'Q') {
      command[3] = x
      command[4] = y
    } else if (command[0] === 'C') {
      command[5] = x
      command[6] = y
    }
    return next
  }

  if (point.role === 'control-out' && command[0] === 'C') {
    command[1] = x
    command[2] = y
    return next
  }

  if (point.role === 'control-in') {
    if (command[0] === 'Q') {
      command[1] = x
      command[2] = y
    } else if (command[0] === 'C') {
      command[3] = x
      command[4] = y
    }
  }

  return next
}

export function worldToPathLocal(path: FabricPath, canvasX: number, canvasY: number) {
  const local = util.transformPoint(
    new Point(canvasX, canvasY),
    util.invertTransform(path.calcTransformMatrix()),
  )
  return {
    x: local.x + (path.pathOffset?.x ?? 0),
    y: local.y + (path.pathOffset?.y ?? 0),
  }
}

export function pathLocalToWorld(path: FabricPath, localX: number, localY: number) {
  const offsetX = path.pathOffset?.x ?? 0
  const offsetY = path.pathOffset?.y ?? 0
  const matrix = path.calcTransformMatrix()
  const origin = path.getPointByOrigin('left', 'top')
  const x = localX - offsetX
  const y = localY - offsetY
  return {
    x: matrix[4] + x * matrix[0] + y * matrix[2] + (origin.x ?? 0),
    y: matrix[5] + x * matrix[1] + y * matrix[3] + (origin.y ?? 0),
  }
}

export function snapPathLocalPoint(
  path: FabricPath,
  localX: number,
  localY: number,
  otherBounds: { left: number; top: number; width: number; height: number }[],
  canvasSize: { width: number; height: number },
  displayScale: number,
) {
  const world = pathLocalToWorld(path, localX, localY)
  const threshold = SNAP_SCREEN_THRESHOLD / displayScale
  const snap = computeSnap(
    { left: world.x, top: world.y, width: 0, height: 0 },
    otherBounds,
    canvasSize,
    threshold,
  )
  const snappedWorld = { x: world.x + snap.dx, y: world.y + snap.dy }
  return {
    ...worldToPathLocal(path, snappedWorld.x, snappedWorld.y),
    vGuides: snap.vGuides,
    hGuides: snap.hGuides,
  }
}

export function pathPointNear(
  path: FabricPath,
  canvasX: number,
  canvasY: number,
  threshold: number,
): PathAnchorPoint | null {
  for (const point of getPathAnchorPoints(path.path as PathData)) {
    const world = pathAnchorWorldPosition(path, point)
    const dx = world.x - canvasX
    const dy = world.y - canvasY
    if (Math.hypot(dx, dy) <= threshold) {
      return point
    }
  }

  return null
}

export function pathSegmentNear(
  path: FabricPath,
  canvasX: number,
  canvasY: number,
  threshold: number,
): PathSegmentHit | null {
  const local = worldToPathLocal(path, canvasX, canvasY)
  const matrix = path.calcTransformMatrix()
  const scale = Math.max(Math.hypot(matrix[0], matrix[1]), 0.0001)
  const localThreshold = threshold / scale
  return segmentHitInPathLocal(path.path as PathData, local.x, local.y, localThreshold)
}

export function applyPathData(path: FabricPath, pathData: PathData) {
  path._setPath(pathData as FabricPath['path'], true)
  path.setCoords()
}

export function pathAnchorWorldPosition(path: FabricPath, point: PathAnchorPoint) {
  return pathLocalToWorld(path, point.x, point.y)
}

function perpendicularDistance(point: XY, lineStart: XY, lineEnd: XY) {
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(point.x - lineStart.x, point.y - lineStart.y)
  const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / len2))
  return Math.hypot(point.x - (lineStart.x + t * dx), point.y - (lineStart.y + t * dy))
}

function douglasPeucker(points: XY[], tolerance: number): XY[] {
  if (points.length <= 2) return points

  const start = points[0]
  const end = points[points.length - 1]
  let maxDistance = 0
  let maxIndex = 0

  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = perpendicularDistance(points[index], start, end)
    if (distance > maxDistance) {
      maxDistance = distance
      maxIndex = index
    }
  }

  if (maxDistance > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIndex + 1), tolerance)
    const right = douglasPeucker(points.slice(maxIndex), tolerance)
    return [...left.slice(0, -1), ...right]
  }

  return [start, end]
}

/** Reduce noisy freehand pen strokes while preserving shape. */
export function simplifyPathData(pathData: PathData, tolerance = 2): PathData {
  const anchors = getPathAnchorPoints(pathData).filter((point) => point.role === 'anchor')
  if (anchors.length <= 2) return pathData

  const simplified = douglasPeucker(
    anchors.map((anchor) => ({ x: anchor.x, y: anchor.y })),
    tolerance,
  )
  if (simplified.length >= anchors.length) return pathData

  const next: PathData = [['M', simplified[0].x, simplified[0].y]]
  for (let index = 1; index < simplified.length; index += 1) {
    next.push(['L', simplified[index].x, simplified[index].y])
  }
  if (pathData.some((command) => command[0] === 'Z') || isPathClosed(pathData)) {
    next.push(['Z'])
  }
  return next
}
