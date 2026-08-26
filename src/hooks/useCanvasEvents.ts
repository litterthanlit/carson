import { useCallback } from 'react'
import type { Canvas, FabricObject, Path as FabricPath } from 'fabric'
import type { MutableRefObject } from 'react'
import { SNAP_SCREEN_THRESHOLD } from '../lib/editorConstants'
import { buildLayoutGrid, layoutSnapLines, type GridOverlay, type LayoutGuide } from '../lib/grid'
import { buildPrintGuides } from '../lib/printGuides'
import { SELECTION_ACCENT } from '../lib/selectionChrome'
import { computeSnap } from '../lib/snapping'
import { constrainMoveDelta, constrainUniformScale, snapRotation } from '../lib/transformConstraints'
import { applyPathData, simplifyPathData, type PathData } from '../lib/pathEditing'
import { isLayerSyncSuppressed } from '../lib/layerSync'
import type { EditorTool, LayerKind, TextSelectionRange } from '../types/editor'

type UseCanvasEventsOptions = {
  guidesRef: MutableRefObject<{ v: number[]; h: number[] }>
  displayScaleRef: MutableRefObject<number>
  showLayoutGridRef: MutableRefObject<boolean>
  showBaselineGridRef: MutableRefObject<boolean>
  showPrintGuidesRef: MutableRefObject<boolean>
  gridOverlayRef: MutableRefObject<GridOverlay>
  layoutGuidesRef: MutableRefObject<LayoutGuide[]>
  snapToGridRef: MutableRefObject<boolean>
  printDpiRef: MutableRefObject<number>
  bleedMmRef: MutableRefObject<number>
  penStrokeColorRef: MutableRefObject<string>
  penStrokeWidthRef: MutableRefObject<number>
  syncSelected: () => void
  syncLayers: () => void
  commitHistory: (message: string) => void
  tagObject: (object: FabricObject, kind: LayerKind, name: string) => void
  onTextSelectionChange?: (range: TextSelectionRange | null) => void
  onLiveTransform?: () => void
  editorToolRef?: MutableRefObject<EditorTool>
  onPlaceText?: (point: { left: number; top: number }) => void
  onMaskPaint?: (
    phase: 'down' | 'move' | 'up',
    point: { x: number; y: number },
    reveal: boolean,
  ) => void
}

export function useCanvasEvents({
  guidesRef,
  displayScaleRef,
  showLayoutGridRef,
  showBaselineGridRef,
  showPrintGuidesRef,
  gridOverlayRef,
  layoutGuidesRef,
  snapToGridRef,
  printDpiRef,
  bleedMmRef,
  penStrokeColorRef,
  penStrokeWidthRef,
  syncSelected,
  syncLayers,
  commitHistory,
  tagObject,
  onTextSelectionChange,
  onLiveTransform,
  editorToolRef,
  onPlaceText,
  onMaskPaint,
}: UseCanvasEventsOptions) {
  const registerCanvasEvents = useCallback(
    (canvas: Canvas) => {
      const sync = () => {
        syncSelected()
        syncLayers()
      }

      canvas.on('selection:created', sync)
      canvas.on('selection:updated', sync)
      canvas.on('selection:cleared', sync)
      canvas.on('object:modified', () => commitHistory('Changed layer'))
      const syncLayersIfAllowed = () => {
        if (!isLayerSyncSuppressed()) syncLayers()
      }
      canvas.on('object:added', syncLayersIfAllowed)
      canvas.on('object:removed', syncLayersIfAllowed)

      const syncTextSelection = (event: { target?: FabricObject }) => {
        const target = event.target
        if (!target || target.type !== 'textbox') {
          onTextSelectionChange?.(null)
          return
        }
        const text = target as FabricObject & { selectionStart?: number; selectionEnd?: number; isEditing?: boolean }
        if (!text.isEditing) {
          onTextSelectionChange?.(null)
          return
        }
        const start = text.selectionStart ?? 0
        const end = text.selectionEnd ?? 0
        onTextSelectionChange?.(end > start ? { start, end } : null)
      }

      canvas.on('text:selection:changed', syncTextSelection)
      canvas.on('text:editing:exited', () => onTextSelectionChange?.(null))

      canvas.on('mouse:down', (event) => {
        const native = event.e as MouseEvent
        const point = canvas.getScenePoint(native)
        if (editorToolRef?.current === 'mask') {
          onMaskPaint?.('down', { x: point.x, y: point.y }, Boolean(native.altKey))
          return
        }
        if (editorToolRef?.current !== 'text') return
        if (canvas.isDrawingMode || canvas.skipTargetFind) return
        if (event.target) return
        onPlaceText?.({ left: point.x, top: point.y })
      })

      canvas.on('mouse:move', (event) => {
        if (editorToolRef?.current !== 'mask') return
        const native = event.e as MouseEvent
        if (!native.buttons) return
        const point = canvas.getScenePoint(native)
        onMaskPaint?.('move', { x: point.x, y: point.y }, Boolean(native.altKey))
      })

      canvas.on('mouse:up', (event) => {
        if (editorToolRef?.current !== 'mask') return
        const native = event.e as MouseEvent
        const point = canvas.getScenePoint(native)
        onMaskPaint?.('up', { x: point.x, y: point.y }, Boolean(native.altKey))
      })

      canvas.on('path:created', (event) => {
        const path = event.path as FabricPath | undefined
        if (!path) return
        const pathData = path.path as PathData | undefined
        if (pathData) {
          applyPathData(path, simplifyPathData(pathData))
        }
        tagObject(path, 'shape', 'Pen stroke')
        path.set({
          stroke: penStrokeColorRef.current,
          strokeWidth: penStrokeWidthRef.current,
          fill: '',
        } as Partial<FabricObject>)
        commitHistory('Drew pen stroke')
      })

      const shiftHeld = (event: { transform?: { shiftKey?: boolean; original?: { left?: number; top?: number; scaleX?: number; scaleY?: number } }; e?: Event }) => {
        const pointerEvent = event.e as MouseEvent | TouchEvent | undefined
        return Boolean(event.transform?.shiftKey || (pointerEvent && 'shiftKey' in pointerEvent && pointerEvent.shiftKey))
      }

      canvas.on('object:moving', (event) => {
        const target = event.target
        guidesRef.current = { v: [], h: [] }
        if (!target) return
        const pointerEvent = event.e as MouseEvent | TouchEvent | undefined
        const original = event.transform?.original
        if (shiftHeld(event) && original) {
          const originLeft = original.left ?? 0
          const originTop = original.top ?? 0
          const locked = constrainMoveDelta((target.left ?? 0) - originLeft, (target.top ?? 0) - originTop)
          target.set({ left: originLeft + locked.dx, top: originTop + locked.dy })
          target.setCoords()
        }
        const suspended = pointerEvent && 'metaKey' in pointerEvent && (pointerEvent.metaKey || pointerEvent.ctrlKey)
        if (suspended) {
          onLiveTransform?.()
          canvas.requestRenderAll()
          return
        }
        const bounds = target.getBoundingRect()
        const others = canvas
          .getObjects()
          .filter((object) => object !== target && object.visible !== false && !canvas.getActiveObjects().includes(object))
          .map((object) => object.getBoundingRect())
        const threshold = SNAP_SCREEN_THRESHOLD / displayScaleRef.current
        const layout = buildLayoutGrid(
          { width: canvas.getWidth(), height: canvas.getHeight() },
          gridOverlayRef.current,
        )
        const extras = layoutSnapLines(layout, layoutGuidesRef.current, {
          includeGrid: snapToGridRef.current && gridOverlayRef.current.tension < 96,
          includeGuides: true,
        })
        const snap = computeSnap(
          bounds,
          others,
          { width: canvas.getWidth(), height: canvas.getHeight() },
          threshold,
          extras,
        )
        if (snap.dx !== 0 || snap.dy !== 0) {
          target.set({ left: (target.left ?? 0) + snap.dx, top: (target.top ?? 0) + snap.dy })
          target.setCoords()
        }
        guidesRef.current = { v: snap.vGuides, h: snap.hGuides }
        onLiveTransform?.()
        canvas.requestRenderAll()
      })

      canvas.on('object:scaling', (event) => {
        const target = event.target
        const original = event.transform?.original
        if (!target || !shiftHeld(event) || !original) {
          onLiveTransform?.()
          return
        }
        target.set(
          constrainUniformScale(target.scaleX ?? 1, target.scaleY ?? 1, {
            scaleX: original.scaleX,
            scaleY: original.scaleY,
          }),
        )
        target.setCoords()
        onLiveTransform?.()
      })

      canvas.on('object:rotating', (event) => {
        const target = event.target
        if (target && shiftHeld(event)) {
          target.set({ angle: snapRotation(target.angle ?? 0) })
          target.setCoords()
        }
        onLiveTransform?.()
      })

      canvas.on('mouse:up', () => {
        if (guidesRef.current.v.length > 0 || guidesRef.current.h.length > 0) {
          guidesRef.current = { v: [], h: [] }
          canvas.requestRenderAll()
        }
      })

      canvas.on('after:render', () => {
        const { v, h } = guidesRef.current
        const ctx = canvas.contextTop
        if (!ctx) return
        canvas.clearContext(ctx)
        ctx.save()
        ctx.lineWidth = 1 / displayScaleRef.current

        if (showLayoutGridRef.current) {
          const layout = buildLayoutGrid(
            { width: canvas.getWidth(), height: canvas.getHeight() },
            gridOverlayRef.current,
          )
          ctx.setLineDash([])
          ctx.fillStyle = 'rgba(5, 182, 212, 0.07)'
          for (const column of layout.columns) {
            ctx.fillRect(column.left, column.top, column.width, column.height)
          }
          ctx.strokeStyle = 'rgba(5, 182, 212, 0.55)'
          ctx.strokeRect(layout.marginRect.left, layout.marginRect.top, layout.marginRect.width, layout.marginRect.height)
          ctx.setLineDash([5, 7])
          ctx.strokeStyle = 'rgba(5, 182, 212, 0.38)'
          for (const column of layout.columns) {
            ctx.beginPath()
            ctx.moveTo(column.left, column.top)
            ctx.lineTo(column.left, column.top + column.height)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(column.left + column.width, column.top)
            ctx.lineTo(column.left + column.width, column.top + column.height)
            ctx.stroke()
          }
        }

        if (showBaselineGridRef.current) {
          const layout = buildLayoutGrid(
            { width: canvas.getWidth(), height: canvas.getHeight() },
            gridOverlayRef.current,
          )
          ctx.strokeStyle = 'rgba(17, 17, 17, 0.16)'
          ctx.setLineDash([2, 10])
          for (const y of layout.hLines) {
            if (y <= 0 || y >= canvas.getHeight()) continue
            ctx.beginPath()
            ctx.moveTo(0, y)
            ctx.lineTo(canvas.getWidth(), y)
            ctx.stroke()
          }
        }

        if (showPrintGuidesRef.current) {
          const guides = buildPrintGuides(
            { width: canvas.getWidth(), height: canvas.getHeight() },
            printDpiRef.current,
            bleedMmRef.current,
          )
          for (const guide of guides) {
            ctx.strokeStyle =
              guide.kind === 'bleed'
                ? 'rgba(225, 29, 72, 0.55)'
                : guide.kind === 'safe'
                  ? 'rgba(17, 17, 17, 0.35)'
                  : 'rgba(17, 17, 17, 0.7)'
            ctx.setLineDash(guide.kind === 'bleed' ? [10, 6] : [])
            ctx.strokeRect(guide.left, guide.top, guide.width, guide.height)
          }
        }

        if (v.length > 0 || h.length > 0) {
          ctx.strokeStyle = SELECTION_ACCENT
          ctx.setLineDash([])
          for (const x of v) {
            ctx.beginPath()
            ctx.moveTo(x, 0)
            ctx.lineTo(x, canvas.getHeight())
            ctx.stroke()
          }
          for (const y of h) {
            ctx.beginPath()
            ctx.moveTo(0, y)
            ctx.lineTo(canvas.getWidth(), y)
            ctx.stroke()
          }
        }
        ctx.restore()
      })
    },
    [
      bleedMmRef,
      commitHistory,
      displayScaleRef,
      gridOverlayRef,
      layoutGuidesRef,
      snapToGridRef,
      guidesRef,
      penStrokeColorRef,
      penStrokeWidthRef,
      printDpiRef,
      showBaselineGridRef,
      showLayoutGridRef,
      showPrintGuidesRef,
      syncLayers,
      syncSelected,
      tagObject,
      onTextSelectionChange,
      onLiveTransform,
      editorToolRef,
      onPlaceText,
      onMaskPaint,
    ],
  )

  return { registerCanvasEvents }
}
