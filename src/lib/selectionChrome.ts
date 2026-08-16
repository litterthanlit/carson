import type { FabricObject } from 'fabric'

export const HANDLE_SCREEN_PX = 7
export const SELECTION_ACCENT = '#1473e6'

export type SelectionChrome = {
  cornerColor: string
  cornerStrokeColor: string
  borderColor: string
  transparentCorners: boolean
  cornerStyle: 'rect'
  cornerSize: number
  touchCornerSize: number
  padding: number
  borderScaleFactor: number
}

export function selectionChrome(displayScale: number): SelectionChrome {
  const scale = displayScale > 0 ? displayScale : 1
  const size = HANDLE_SCREEN_PX / scale
  return {
    cornerColor: '#ffffff',
    cornerStrokeColor: SELECTION_ACCENT,
    borderColor: SELECTION_ACCENT,
    transparentCorners: false,
    cornerStyle: 'rect',
    cornerSize: size,
    touchCornerSize: Math.max(size, 18 / scale),
    padding: 2 / scale,
    borderScaleFactor: 1,
  }
}

export function applySelectionChrome(object: FabricObject, displayScale: number) {
  object.set(selectionChrome(displayScale))
}
