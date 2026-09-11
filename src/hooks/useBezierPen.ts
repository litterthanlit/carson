import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { Path, type Canvas, type FabricObject } from 'fabric'
import {
  addAnchor,
  canCommitDraft,
  closeDraft,
  dragLastHandle,
  draftToSvgPath,
  emptyBezierDraft,
  endHandleDrag,
  isCloseHit,
  moveCursor,
  previewSvgPath,
  removeLastAnchor,
  type BezierPenDraft,
} from '../lib/bezierPen'
import type { LayerKind } from '../types/editor'

export type BezierPenActions = {
  finish: () => boolean
  cancel: () => boolean
  undoPoint: () => boolean
  isDrawing: () => boolean
}

type UseBezierPenOptions = {
  canvasRef: MutableRefObject<Canvas | null>
  active: boolean
  strokeColorRef: MutableRefObject<string>
  strokeWidthRef: MutableRefObject<number>
  displayScaleRef: MutableRefObject<number>
  tagObject: (object: FabricObject, kind: LayerKind, name: string) => void
  commitHistory: (message: string) => void
  syncSelected: () => void
  syncLayers: () => void
  setStatus: (message: string) => void
  actionsRef: MutableRefObject<BezierPenActions>
}

const CLOSE_HIT_PX = 12
const DRAG_HANDLE_PX = 4

function drawDraft(canvas: Canvas, draft: BezierPenDraft, closeHit: boolean) {
  const ctx = canvas.contextTop
  if (!ctx) return
  canvas.clearContext(ctx)
  if (draft.points.length === 0 && !draft.cursor) return

  ctx.save()
  ctx.strokeStyle = '#111111'
  ctx.fillStyle = '#111111'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 3])

  const svg = previewSvgPath(draft)
  if (svg) {
    const path = new Path2D(svg)
    ctx.stroke(path)
  }

  ctx.setLineDash([])
  const first = draft.points[0]
  for (const point of draft.points) {
    if (hasHandleLine(point)) {
      ctx.beginPath()
      ctx.strokeStyle = '#2563eb'
      ctx.moveTo(point.x + point.inX, point.y + point.inY)
      ctx.lineTo(point.x, point.y)
      ctx.lineTo(point.x + point.outX, point.y + point.outY)
      ctx.stroke()
      drawDot(ctx, point.x + point.outX, point.y + point.outY, 3, '#2563eb')
      drawDot(ctx, point.x + point.inX, point.y + point.inY, 3, '#2563eb')
    }
    const isStart = point === first
    drawSquare(ctx, point.x, point.y, isStart && closeHit ? 7 : 5, isStart ? '#e11d48' : '#111111')
  }
  ctx.restore()
}

function hasHandleLine(point: { inX: number; inY: number; outX: number; outY: number }) {
  return Math.hypot(point.outX, point.outY) > 0.5 || Math.hypot(point.inX, point.inY) > 0.5
}

function drawSquare(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  ctx.fillStyle = '#f6f1e6'
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.fillRect(x - size / 2, y - size / 2, size, size)
  ctx.strokeRect(x - size / 2, y - size / 2, size, size)
}

function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
}

export function useBezierPen({
  canvasRef,
  active,
  strokeColorRef,
  strokeWidthRef,
  displayScaleRef,
  tagObject,
  commitHistory,
  syncSelected,
  syncLayers,
  setStatus,
  actionsRef,
}: UseBezierPenOptions) {
  const draftRef = useRef<BezierPenDraft>(emptyBezierDraft())
  const pointerDownRef = useRef<{ x: number; y: number; at: number } | null>(null)
  const lastClickRef = useRef<{ x: number; y: number; at: number } | null>(null)
  const tagObjectRef = useRef(tagObject)
  const commitHistoryRef = useRef(commitHistory)
  const syncSelectedRef = useRef(syncSelected)
  const syncLayersRef = useRef(syncLayers)
  const setStatusRef = useRef(setStatus)
  tagObjectRef.current = tagObject
  commitHistoryRef.current = commitHistory
  syncSelectedRef.current = syncSelected
  syncLayersRef.current = syncLayers
  setStatusRef.current = setStatus

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !active) {
      draftRef.current = emptyBezierDraft()
      pointerDownRef.current = null
      if (canvas?.contextTop) canvas.clearContext(canvas.contextTop)
      actionsRef.current = {
        finish: () => false,
        cancel: () => false,
        undoPoint: () => false,
        isDrawing: () => false,
      }
      return
    }

    const closeThreshold = () => CLOSE_HIT_PX / Math.max(0.01, displayScaleRef.current)
    const dragThreshold = () => DRAG_HANDLE_PX / Math.max(0.01, displayScaleRef.current)

    const redraw = () => {
      const draft = draftRef.current
      const cursor = draft.cursor
      const closeHit = Boolean(cursor && isCloseHit(draft, cursor.x, cursor.y, closeThreshold()))
      drawDraft(canvas, draft, closeHit)
    }

    const commitDraft = (closed: boolean) => {
      let draft = closed ? closeDraft(draftRef.current) : draftRef.current
      draft = endHandleDrag(draft)
      if (!canCommitDraft(draft)) {
        draftRef.current = emptyBezierDraft()
        if (canvas.contextTop) canvas.clearContext(canvas.contextTop)
        setStatusRef.current('Pen — click to place, drag for handles, Enter to finish')
        return false
      }
      const path = new Path(draftToSvgPath(draft), {
        fill: '',
        stroke: strokeColorRef.current,
        strokeWidth: strokeWidthRef.current,
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
      })
      tagObjectRef.current(path, 'shape', 'Pen stroke')
      canvas.add(path)
      canvas.setActiveObject(path)
      draftRef.current = emptyBezierDraft()
      pointerDownRef.current = null
      if (canvas.contextTop) canvas.clearContext(canvas.contextTop)
      canvas.requestRenderAll()
      syncSelectedRef.current()
      syncLayersRef.current()
      commitHistoryRef.current(closed ? 'Drew closed bezier path' : 'Drew bezier path')
      setStatusRef.current(closed ? 'Closed bezier path' : 'Drew bezier path — Edit points to refine')
      return true
    }

    const cancelDraft = () => {
      if (draftRef.current.points.length === 0) return false
      draftRef.current = emptyBezierDraft()
      pointerDownRef.current = null
      if (canvas.contextTop) canvas.clearContext(canvas.contextTop)
      canvas.requestRenderAll()
      setStatusRef.current('Cancelled bezier path')
      return true
    }

    actionsRef.current = {
      finish: () => {
        if (draftRef.current.points.length === 0) return false
        return commitDraft(false)
      },
      cancel: () => cancelDraft(),
      undoPoint: () => {
        if (draftRef.current.points.length === 0) return false
        draftRef.current = removeLastAnchor(draftRef.current)
        redraw()
        canvas.requestRenderAll()
        setStatusRef.current(
          draftRef.current.points.length === 0
            ? 'Pen — click to place, drag for handles, Enter to finish'
            : 'Removed last anchor',
        )
        return true
      },
      isDrawing: () => draftRef.current.points.length > 0,
    }

    const onMouseDown = (event: { e: MouseEvent | TouchEvent }) => {
      const pointer = canvas.getScenePoint(event.e)
      const draft = draftRef.current
      const lastClick = lastClickRef.current
      if (
        lastClick &&
        Date.now() - lastClick.at < 320 &&
        Math.hypot(pointer.x - lastClick.x, pointer.y - lastClick.y) <= closeThreshold() &&
        canCommitDraft(draft)
      ) {
        commitDraft(false)
        return
      }
      if (isCloseHit(draft, pointer.x, pointer.y, closeThreshold())) {
        commitDraft(true)
        return
      }
      pointerDownRef.current = { x: pointer.x, y: pointer.y, at: Date.now() }
      draftRef.current = addAnchor(draft, pointer.x, pointer.y)
      redraw()
    }

    const onMouseMove = (event: { e: MouseEvent | TouchEvent }) => {
      const pointer = canvas.getScenePoint(event.e)
      const down = pointerDownRef.current
      if (down && draftRef.current.dragging) {
        const moved = Math.hypot(pointer.x - down.x, pointer.y - down.y)
        if (moved >= dragThreshold()) {
          draftRef.current = dragLastHandle(draftRef.current, pointer.x, pointer.y)
        }
      } else {
        draftRef.current = moveCursor(draftRef.current, pointer.x, pointer.y)
      }
      redraw()
    }

    const onMouseUp = (event: { e: MouseEvent | TouchEvent }) => {
      if (!pointerDownRef.current) return
      const pointer = canvas.getScenePoint(event.e)
      if (draftRef.current.dragging) {
        const moved = Math.hypot(pointer.x - pointerDownRef.current.x, pointer.y - pointerDownRef.current.y)
        if (moved >= dragThreshold()) {
          draftRef.current = dragLastHandle(draftRef.current, pointer.x, pointer.y)
        }
      }
      draftRef.current = endHandleDrag(draftRef.current)
      lastClickRef.current = { x: pointer.x, y: pointer.y, at: Date.now() }
      pointerDownRef.current = null
      redraw()
    }

    canvas.on('mouse:down', onMouseDown)
    canvas.on('mouse:move', onMouseMove)
    canvas.on('mouse:up', onMouseUp)
    canvas.on('after:render', redraw)
    setStatusRef.current('Pen — click to place, drag for handles, Enter to finish, click start to close')
    canvas.requestRenderAll()

    return () => {
      canvas.off('mouse:down', onMouseDown)
      canvas.off('mouse:move', onMouseMove)
      canvas.off('mouse:up', onMouseUp)
      canvas.off('after:render', redraw)
      draftRef.current = emptyBezierDraft()
      pointerDownRef.current = null
      if (canvas.contextTop) canvas.clearContext(canvas.contextTop)
      actionsRef.current = {
        finish: () => false,
        cancel: () => false,
        undoPoint: () => false,
        isDrawing: () => false,
      }
    }
  }, [active, actionsRef, canvasRef, displayScaleRef, strokeColorRef, strokeWidthRef])
}
