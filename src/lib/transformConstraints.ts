export type PointDelta = { dx: number; dy: number }
export type ScalePair = { scaleX: number; scaleY: number }

/** Lock a drag to the dominant axis (Shift-move). */
export function constrainMoveDelta(dx: number, dy: number): PointDelta {
  if (Math.abs(dx) >= Math.abs(dy)) return { dx, dy: 0 }
  return { dx: 0, dy }
}

/** Keep scale proportional to the original pair (Shift-scale). */
export function constrainUniformScale(scaleX: number, scaleY: number, origin: ScalePair): ScalePair {
  const originX = origin.scaleX === 0 ? 1 : origin.scaleX
  const originY = origin.scaleY === 0 ? 1 : origin.scaleY
  const ratioX = scaleX / originX
  const ratioY = scaleY / originY
  const ratio = Math.abs(ratioX - 1) >= Math.abs(ratioY - 1) ? ratioX : ratioY
  return { scaleX: originX * ratio, scaleY: originY * ratio }
}

/** Snap rotation to 15° increments (Shift-rotate). */
export function snapRotation(angle: number, increment = 15): number {
  if (!Number.isFinite(angle) || increment <= 0) return angle
  return Math.round(angle / increment) * increment
}
