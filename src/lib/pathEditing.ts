import type { Path as FabricPath } from 'fabric'

export type PathAnchorPoint = {
  commandIndex: number
  x: number
  y: number
  role: 'anchor' | 'control-in' | 'control-out'
}

type PathCommand = [string, ...number[]]
type PathData = PathCommand[]

function commandXY(command: PathCommand): { x: number; y: number } | null {
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

export function movePathPoint(pathData: PathData, point: PathAnchorPoint, x: number, y: number): PathData {
  const next = pathData.map((command) => [...command] as PathCommand)
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

export function pathPointNear(
  path: FabricPath,
  canvasX: number,
  canvasY: number,
  threshold: number,
): PathAnchorPoint | null {
  const matrix = path.calcTransformMatrix()
  const local = path.getPointByOrigin('left', 'top')
  const offsetX = path.pathOffset?.x ?? 0
  const offsetY = path.pathOffset?.y ?? 0

  for (const point of getPathAnchorPoints(path.path)) {
    const worldX = matrix[4] + (point.x - offsetX) * matrix[0] + (point.y - offsetY) * matrix[2] + (local.x ?? 0)
    const worldY = matrix[5] + (point.x - offsetX) * matrix[1] + (point.y - offsetY) * matrix[3] + (local.y ?? 0)
    const dx = worldX - canvasX
    const dy = worldY - canvasY
    if (Math.hypot(dx, dy) <= threshold) {
      return point
    }
  }

  return null
}

export function applyPathData(path: FabricPath, pathData: PathData) {
  path._setPath(pathData as FabricPath['path'], true)
  path.setCoords()
}

export function pathAnchorWorldPosition(path: FabricPath, point: PathAnchorPoint) {
  const anchor = commandXY(path.path[point.commandIndex])
  if (!anchor) return { x: 0, y: 0 }
  const matrix = path.calcTransformMatrix()
  const offsetX = path.pathOffset?.x ?? 0
  const offsetY = path.pathOffset?.y ?? 0
  const local = path.getPointByOrigin('left', 'top')
  return {
    x: matrix[4] + (anchor.x - offsetX) * matrix[0] + (anchor.y - offsetY) * matrix[2] + (local.x ?? 0),
    y: matrix[5] + (anchor.x - offsetX) * matrix[1] + (anchor.y - offsetY) * matrix[3] + (local.y ?? 0),
  }
}
