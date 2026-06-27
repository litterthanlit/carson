import { useCallback } from 'react'
import type { Canvas, FabricObject } from 'fabric'
import type { MutableRefObject } from 'react'
import { SNAP_SCREEN_THRESHOLD } from '../lib/editorConstants'
import { baselineGridLines, buildColumnGrid, type GridOverlay } from '../lib/grid'
import { buildPrintGuides } from '../lib/print'
import { computeSnap } from '../lib/snapping'
import type { LayerKind } from '../types/editor'

type UseCanvasEventsOptions = {
  guidesRef: MutableRefObject<{ v: number[]; h: number[] }>
  displayScaleRef: MutableRefObject<number>
  showLayoutGridRef: MutableRefObject<boolean>
  showBaselineGridRef: MutableRefObject<boolean>
  showPrintGuidesRef: MutableRefObject<boolean>
  gridOverlayRef: MutableRefObject<GridOverlay>
  printDpiRef: MutableRefObject<number>
  bleedMmRef: MutableRefObject<number>
  penStrokeColorRef: MutableRefObject<string>
  penStrokeWidthRef: MutableRefObject<number>
  syncSelected: () => void
  syncLayers: () => void
  commitHistory: (message: string) => void
  tagObject: (object: FabricObject, kind: LayerKind, name: string) => void
}

export function useCanvasEvents({
  guidesRef,
  displayScaleRef,
  showLayoutGridRef,
  showBaselineGridRef,
  showPrintGuidesRef,
  gridOverlayRef,
  printDpiRef,
  bleedMmRef,
  penStrokeColorRef,
  penStrokeWidthRef,
  syncSelected,
  syncLayers,
  commitHistory,
  tagObject,
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
      canvas.on('object:added', syncLayers)
      canvas.on('object:removed', syncLayers)

      canvas.on('path:created', (event) => {
        const path = event.path
        if (!path) return
        tagObject(path, 'shape', 'Pen stroke')
        path.set({
          stroke: penStrokeColorRef.current,
          strokeWidth: penStrokeWidthRef.current,
          fill: '',
        } as Partial<FabricObject>)
        commitHistory('Drew pen stroke')
      })

      // Snapping v1: canvas edges, centers, and object-to-object. Hold Cmd/Ctrl to suspend.
      canvas.on('object:moving', (event) => {
        const target = event.target
        guidesRef.current = { v: [], h: [] }
        if (!target) return
        const pointerEvent = event.e as MouseEvent | TouchEvent | undefined
        const suspended = pointerEvent && 'metaKey' in pointerEvent && (pointerEvent.metaKey || pointerEvent.ctrlKey)
        if (suspended) {
          canvas.requestRenderAll()
          return
        }
        const bounds = target.getBoundingRect()
        const others = canvas
          .getObjects()
          .filter((object) => object !== target && object.visible !== false && !canvas.getActiveObjects().includes(object))
          .map((object) => object.getBoundingRect())
        const threshold = SNAP_SCREEN_THRESHOLD / displayScaleRef.current
        const snap = computeSnap(bounds, others, { width: canvas.getWidth(), height: canvas.getHeight() }, threshold)
        if (snap.dx !== 0 || snap.dy !== 0) {
          target.set({ left: (target.left ?? 0) + snap.dx, top: (target.top ?? 0) + snap.dy })
          target.setCoords()
        }
        guidesRef.current = { v: snap.vGuides, h: snap.hGuides }
        canvas.requestRenderAll()
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
          const overlay = gridOverlayRef.current
          const columns = buildColumnGrid(
            { width: canvas.getWidth(), height: canvas.getHeight() },
            overlay,
            () => 0.5,
          )
          ctx.strokeStyle = 'rgba(5, 182, 212, 0.35)'
          ctx.setLineDash([4, 8])
          for (const column of columns) {
            ctx.strokeRect(column.left, column.top, column.width, column.height)
          }
        }

        if (showBaselineGridRef.current) {
          const step = Math.max(12, Math.round(canvas.getHeight() / (gridOverlayRef.current.rows || 8)))
          const lines = baselineGridLines({ width: canvas.getWidth(), height: canvas.getHeight() }, step)
          ctx.strokeStyle = 'rgba(17, 17, 17, 0.12)'
          ctx.setLineDash([2, 10])
          for (const line of lines) {
            ctx.beginPath()
            ctx.moveTo(line.x1, line.y1)
            ctx.lineTo(line.x2, line.y2)
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
          ctx.strokeStyle = '#e11d48'
          ctx.setLineDash([6, 4])
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
    ],
  )

  return { registerCanvasEvents }
}
