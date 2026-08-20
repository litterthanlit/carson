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
