import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { Path, Point, util, type Canvas, type FabricObject } from 'fabric'
import {
  applyPathData,
  getPathAnchorPoints,
  movePathPoint,
  pathAnchorWorldPosition,
  pathPointNear,
  type PathAnchorPoint,
} from '../lib/pathEditing'

type UsePathEditingOptions = {
  canvasRef: MutableRefObject<Canvas | null>
  pathEditMode: boolean
  selectedId: string | undefined
  penMode: boolean
  displayScaleRef: MutableRefObject<number>
  activeObjectRef: MutableRefObject<() => FabricObject | null>
  commitHistoryRef: MutableRefObject<(message: string) => void>
  restoreCanvasSelectionRef: MutableRefObject<() => void>
}

export function usePathEditing({
  canvasRef,
  pathEditMode,
  selectedId,
  penMode,
  displayScaleRef,
  activeObjectRef,
  commitHistoryRef,
  restoreCanvasSelectionRef,
}: UsePathEditingOptions) {
  const pathEditDragRef = useRef<{ point: PathAnchorPoint; path: Path } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !pathEditMode) {
      pathEditDragRef.current = null
      return
    }

    canvas.selection = false
    canvas.skipTargetFind = true

    const drawPathHandles = () => {
      const object = activeObjectRef.current()
      if (!object || object.type !== 'path') return
      const path = object as Path
      const ctx = canvas.contextTop
      if (!ctx) return
      canvas.clearContext(ctx)
      ctx.save()
      for (const point of getPathAnchorPoints(path.path as Parameters<typeof getPathAnchorPoints>[0])) {
        const world = pathAnchorWorldPosition(path, point)
        ctx.beginPath()
        ctx.fillStyle = point.role === 'anchor' ? '#e11d48' : '#05b6d4'
        ctx.arc(world.x, world.y, point.role === 'anchor' ? 5 : 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1
        ctx.stroke()
      }
      ctx.restore()
    }

    const pointerToPathLocal = (path: Path, event: MouseEvent | TouchEvent) => {
      const pointer = canvas.getScenePoint(event)
      const local = util.transformPoint(
        new Point(pointer.x, pointer.y),
        util.invertTransform(path.calcTransformMatrix()),
      )
      return {
        x: local.x + (path.pathOffset?.x ?? 0),
        y: local.y + (path.pathOffset?.y ?? 0),
      }
    }

    const onMouseDown = (event: { e: MouseEvent | TouchEvent }) => {
      const object = activeObjectRef.current()
      if (!object || object.type !== 'path') return
      const path = object as Path
      const pointer = canvas.getScenePoint(event.e)
      const hit = pathPointNear(path, pointer.x, pointer.y, 10 / displayScaleRef.current)
      if (hit) pathEditDragRef.current = { point: hit, path }
    }

    const onMouseMove = (event: { e: MouseEvent | TouchEvent }) => {
      const drag = pathEditDragRef.current
      if (!drag) return
      const local = pointerToPathLocal(drag.path, event.e)
      const next = movePathPoint(
        drag.path.path as Parameters<typeof movePathPoint>[0],
        drag.point,
        local.x,
        local.y,
      )
      applyPathData(drag.path, next)
      drag.path.setCoords()
      canvas.requestRenderAll()
    }

    const onMouseUp = () => {
      if (!pathEditDragRef.current) return
      pathEditDragRef.current = null
      commitHistoryRef.current('Edited path points')
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
      restoreSelection.current()
      canvas.requestRenderAll()
    }
  }, [
    pathEditMode,
    selectedId,
    penMode,
    canvasRef,
    displayScaleRef,
    activeObjectRef,
    commitHistoryRef,
    restoreCanvasSelectionRef,
  ])
}
