import { useEffect, useState, type RefObject } from 'react'
import type { Canvas, FabricObject } from 'fabric'
import { hudBoundsEqual, readHudBounds, type HudBounds } from '../lib/hudBounds'
import { SelectionHud } from './SelectionHud'
import type { SelectedState } from '../types/editor'

const EMPTY_BOUNDS: HudBounds = { left: 0, top: 0, width: 0, height: 0 }

function findObjectById(canvas: Canvas, id: string): FabricObject | undefined {
  return canvas.getObjects().find((object) => String((object as unknown as { id?: unknown }).id ?? '') === id)
}

type LiveSelectionHudProps = {
  canvasRef: RefObject<Canvas | null>
  selected: SelectedState
  displayScale: number
  customFonts: string[]
  onLoadGoogleFont: (family: string) => Promise<void>
  onUpdateActive: (values: Partial<SelectedState>) => void
  onFinalizeActive: (message: string) => void
}

export function LiveSelectionHud({
  canvasRef,
  selected,
  displayScale,
  customFonts,
  onLoadGoogleFont,
  onUpdateActive,
  onFinalizeActive,
}: LiveSelectionHudProps) {
  const [bounds, setBounds] = useState<HudBounds>(() => {
    const canvas = canvasRef.current
    const object = canvas ? findObjectById(canvas, selected.id) : undefined
    return readHudBounds(object) ?? EMPTY_BOUNDS
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const refresh = () => {
      const object = findObjectById(canvas, selected.id) ?? canvas.getActiveObject() ?? undefined
      const next = readHudBounds(object)
      if (!next) return
      setBounds((prev) => (hudBoundsEqual(prev, next) ? prev : next))
    }

    refresh()
    canvas.on('object:moving', refresh)
    canvas.on('object:scaling', refresh)
    canvas.on('object:rotating', refresh)
    canvas.on('object:modified', refresh)
    canvas.on('selection:created', refresh)
    canvas.on('selection:updated', refresh)
    return () => {
      canvas.off('object:moving', refresh)
      canvas.off('object:scaling', refresh)
      canvas.off('object:rotating', refresh)
      canvas.off('object:modified', refresh)
      canvas.off('selection:created', refresh)
      canvas.off('selection:updated', refresh)
    }
  }, [canvasRef, selected.id, selected.left, selected.top, selected.angle, selected.scaleX, selected.scaleY, selected.fontSize])

  return (
    <SelectionHud
      selected={selected}
      bounds={bounds}
      displayScale={displayScale}
      customFonts={customFonts}
      onLoadGoogleFont={onLoadGoogleFont}
      onUpdateActive={onUpdateActive}
      onFinalizeActive={onFinalizeActive}
    />
  )
}
