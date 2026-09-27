export type HudBounds = {
  left: number
  top: number
  width: number
  height: number
}

type BoundsSource = {
  getBoundingRect?: () => HudBounds
}

export function readHudBounds(object: BoundsSource | null | undefined): HudBounds | null {
  if (!object || typeof object.getBoundingRect !== 'function') return null
  const bounds = object.getBoundingRect()
  if (!bounds) return null
  return {
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
  }
}

export function hudBoundsEqual(a: HudBounds, b: HudBounds): boolean {
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height
}

export type HudPlacement = { left: number; top: number; side: 'above' | 'below' }

/** Estimated HUD height in screen px (one row of 24px controls plus padding). */
export const HUD_HEIGHT = 34
const HUD_GAP = 10

/**
 * Dock the contextual HUD above the selection so it never covers the artwork being
 * judged; flip below only when there is no room at the top of the poster.
 */
export function hudPlacement(bounds: HudBounds, displayScale: number, hudHeight = HUD_HEIGHT): HudPlacement {
  const scale = displayScale > 0 ? displayScale : 1
  const left = Math.max(0, bounds.left * scale)
  const above = bounds.top * scale - HUD_GAP - hudHeight
  if (above >= 0) return { left, top: above, side: 'above' }
  return { left, top: (bounds.top + bounds.height) * scale + HUD_GAP, side: 'below' }
}
