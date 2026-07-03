import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { Path, type Canvas, type FabricObject } from 'fabric'
import { readObjectProp } from '../lib/canvasUtils'
import { capturePathEditPatch } from '../lib/historyObject'
import {
  applyPathData,
  closePath,
  deletePathAnchor,
  getPathAnchorPoints,
  insertPointOnSegment,
  isPathClosed,
  movePathPoint,
  pathAnchorWorldPosition,
  pathPointNear,
  pathSegmentNear,
  snapPathLocalPoint,
  worldToPathLocal,
  type PathAnchorPoint,
  type PathData,
} from '../lib/pathEditing'

export type PathEditActions = {
  deleteSelectedAnchor: () => boolean
  closePath: () => boolean
  isPathClosed: () => boolean
}

type UsePathEditingOptions = {
  canvasRef: MutableRefObject<Canvas | null>
  pathEditMode: boolean
  pathAddPointMode: boolean
  selectedId: string | undefined
  penMode: boolean
  displayScaleRef: MutableRefObject<number>
  guidesRef: MutableRefObject<{ v: number[]; h: number[] }>
  activeObjectRef: MutableRefObject<() => FabricObject | null>
  commitObjectPatchHistoryRef: MutableRefObject<
    (objectId: string, label: string, before: string, after: string) => void
  >
  restoreCanvasSelectionRef: MutableRefObject<() => void>
  pathEditActionsRef: MutableRefObject<PathEditActions>
  selectedPathAnchorRef: MutableRefObject<PathAnchorPoint | null>
  notifyPathGeometryChangeRef: MutableRefObject<() => void>
}

export function usePathEditing({
  canvasRef,
  pathEditMode,
  pathAddPointMode,
  selectedId,
  penMode,
  displayScaleRef,
  guidesRef,
  activeObjectRef,
  commitObjectPatchHistoryRef,
  restoreCanvasSelectionRef,
  pathEditActionsRef,
  selectedPathAnchorRef,
  notifyPathGeometryChangeRef,
}: UsePathEditingOptions) {
  const pathEditDragRef = useRef<{ point: PathAnchorPoint; path: Path } | null>(null)
  const pathEditSessionRef = useRef<{ objectId: string; before: string } | null>(null)

  function activePath(): Path | null {
    const object = activeObjectRef.current()
    return object?.type === 'path' ? (object as Path) : null
  }

  function beginPathEditSession(path: Path) {
    const objectId = String(readObjectProp(path, 'id') ?? '')
    if (!objectId) return
    if (pathEditSessionRef.current?.objectId === objectId) return
    pathEditSessionRef.current = { objectId, before: capturePathEditPatch(path) }
  }

  function commitPathEditSession(label: string) {
    const session = pathEditSessionRef.current
    const path = activePath()
    if (!session || !path) {
      pathEditSessionRef.current = null
      return
    }
    const objectId = String(readObjectProp(path, 'id') ?? '')
    if (objectId !== session.objectId) {
      pathEditSessionRef.current = null
      return
    }
    const after = capturePathEditPatch(path)
    pathEditSessionRef.current = null
    if (session.before === after) return
    commitObjectPatchHistoryRef.current(objectId, label, session.before, after)
  }

  function applyPathMutation(path: Path, nextPathData: PathData, label: string) {
    const objectId = String(readObjectProp(path, 'id') ?? '')
    if (!objectId) return
    const before = capturePathEditPatch(path)
    applyPathData(path, nextPathData)
    path.setCoords()
    const after = capturePathEditPatch(path)
    canvasRef.current?.requestRenderAll()
    if (before !== after) {
      commitObjectPatchHistoryRef.current(objectId, label, before, after)
    }
    notifyPathGeometryChangeRef.current()
  }

  function otherSnapBounds(canvas: Canvas, path: Path) {
    return canvas
      .getObjects()
      .filter((object) => object !== path && object.visible !== false)
      .map((object) => object.getBoundingRect())
  }

  pathEditActionsRef.current = {
    deleteSelectedAnchor: () => {
      const path = activePath()
      const selected = selectedPathAnchorRef.current
      if (!path || !selected) return false
      const next = deletePathAnchor(path.path as PathData, selected)
      if (!next) return false
      applyPathMutation(path, next, 'Deleted path point')
      selectedPathAnchorRef.current = null
      return true
    },
    closePath: () => {
      const path = activePath()
      if (!path || isPathClosed(path.path as PathData)) return false
      applyPathMutation(path, closePath(path.path as PathData), 'Closed path')
      return true
    },
    isPathClosed: () => {
      const path = activePath()
      return path ? isPathClosed(path.path as PathData) : false
    },
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !pathEditMode) {
      pathEditDragRef.current = null
      pathEditSessionRef.current = null
      selectedPathAnchorRef.current = null
      guidesRef.current = { v: [], h: [] }
      return
    }

    canvas.selection = false
    canvas.skipTargetFind = true

    const drawPathHandles = () => {
      const path = activePath()
      if (!path) return
      const ctx = canvas.contextTop
      if (!ctx) return
      canvas.clearContext(ctx)
      ctx.save()
      const selected = selectedPathAnchorRef.current
      for (const point of getPathAnchorPoints(path.path as PathData)) {
        const world = pathAnchorWorldPosition(path, point)
        const isSelected =
          selected &&
          selected.commandIndex === point.commandIndex &&
          selected.role === point.role &&
          selected.x === point.x &&
          selected.y === point.y
        ctx.beginPath()
        ctx.fillStyle = isSelected ? '#fbbf24' : point.role === 'anchor' ? '#e11d48' : '#05b6d4'
        ctx.arc(world.x, world.y, isSelected ? 6 : point.role === 'anchor' ? 5 : 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1
        ctx.stroke()
      }
      ctx.restore()
    }

    const onMouseDown = (event: { e: MouseEvent | TouchEvent }) => {
      const path = activePath()
      if (!path) return
      const pointer = canvas.getScenePoint(event.e)
      const threshold = 10 / displayScaleRef.current
      const anchorHit = pathPointNear(path, pointer.x, pointer.y, threshold)
      if (anchorHit) {
        selectedPathAnchorRef.current = anchorHit
        pathEditDragRef.current = { point: anchorHit, path }
        beginPathEditSession(path)
        return
      }

      selectedPathAnchorRef.current = null
      if (!pathAddPointMode) return

      const segmentHit = pathSegmentNear(path, pointer.x, pointer.y, threshold)
      if (!segmentHit) return
      const next = insertPointOnSegment(
        path.path as PathData,
        segmentHit.commandIndex,
        segmentHit.t,
        segmentHit.x,
        segmentHit.y,
      )
      applyPathMutation(path, next, 'Added path point')
    }

    const onMouseMove = (event: { e: MouseEvent | TouchEvent }) => {
      const drag = pathEditDragRef.current
      if (!drag) return
      const pointer = canvas.getScenePoint(event.e)
      const local = worldToPathLocal(drag.path, pointer.x, pointer.y)
      const snapped = snapPathLocalPoint(
        drag.path,
        local.x,
        local.y,
        otherSnapBounds(canvas, drag.path),
        { width: canvas.getWidth(), height: canvas.getHeight() },
        displayScaleRef.current,
      )
      guidesRef.current = { v: snapped.vGuides, h: snapped.hGuides }
      const next = movePathPoint(drag.path.path as PathData, drag.point, snapped.x, snapped.y)
      applyPathData(drag.path, next)
      drag.path.setCoords()
      canvas.requestRenderAll()
    }

    const onMouseUp = () => {
      if (!pathEditDragRef.current) return
      pathEditDragRef.current = null
      guidesRef.current = { v: [], h: [] }
      commitPathEditSession('Edited path points')
      notifyPathGeometryChangeRef.current()
      canvas.requestRenderAll()
    }

    canvas.on('after:render', drawPathHandles)
    canvas.on('mouse:down', onMouseDown)
    canvas.on('mouse:move', onMouseMove)
    canvas.on('mouse:up', onMouseUp)
    canvas.requestRenderAll()

    const restoreSelection = restoreCanvasSelectionRef

    return () => {
      canvas.off('after:render', drawPathHandles)
      canvas.off('mouse:down', onMouseDown)
      canvas.off('mouse:move', onMouseMove)
      canvas.off('mouse:up', onMouseUp)
      guidesRef.current = { v: [], h: [] }
      pathEditSessionRef.current = null
      restoreSelection.current()
      canvas.requestRenderAll()
    }
  }, [
    pathEditMode,
    pathAddPointMode,
    selectedId,
    penMode,
    canvasRef,
    displayScaleRef,
    guidesRef,
    activeObjectRef,
    commitObjectPatchHistoryRef,
    restoreCanvasSelectionRef,
    pathEditActionsRef,
    selectedPathAnchorRef,
    notifyPathGeometryChangeRef,
  ])
}
