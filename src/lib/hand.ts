/**
 * The hand — how a person, not a program, moves paper.
 *
 * A shove is mostly small and now and then large (a bell, not a flat range);
 * a piece pushed further turns further; paper never changes size because you
 * moved it. Distances are millimetres of the printed sheet.
 */

/** Seeded value in [-1, 1], bunched toward 0: three uniforms summed, a near-bell. */
export function handJitter(random: () => number): number {
  return (random() + random() + random() - 1.5) / 1.5
}

export type HandPose = {
  /** Poster px. */
  dx: number
  dy: number
  /** Degrees. */
  angle: number
}

/**
 * A shove across the table: drift up to `reachMm` (mostly much less), and a
 * turn up to `turnDeg` that grows with how far the piece travelled.
 */
export function handShove(random: () => number, reachMm: number, turnDeg: number, pxPerMm: number): HandPose {
  const reach = Math.max(0, reachMm) * Math.max(0.01, pxPerMm)
  const heading = random() * Math.PI * 2
  const travel = Math.abs(handJitter(random))
  const dx = Math.cos(heading) * travel * reach
  const dy = Math.sin(heading) * travel * reach
  // A piece shoved off-centre swings; a piece barely touched barely turns.
  const angle = handJitter(random) * Math.max(0, turnDeg) * (0.35 + 0.65 * travel)
  return { dx, dy, angle }
}

/**
 * The sheet went through the press twice and didn't land in the same place:
 * a shift of `offsetMm` (mostly along the feed) and a hair of rotation about
 * the gripper edge — the middle of the sheet's leading edge.
 */
export function pressMisfeed(
  random: () => number,
  point: { x: number; y: number },
  offsetMm: number,
  pxPerMm: number,
  sheetWidth: number,
): { x: number; y: number; angle: number } {
  const offset = Math.max(0, offsetMm) * Math.max(0.01, pxPerMm)
  const feed = (random() < 0.5 ? -1 : 1) * offset * (0.6 + random() * 0.4)
  const lateral = handJitter(random) * offset * 0.45
  const angle = handJitter(random) * Math.min(0.6, 0.05 + offsetMm * 0.25)
  const radians = (angle * Math.PI) / 180
  const pivot = { x: sheetWidth / 2, y: 0 }
  const rx = point.x - pivot.x
  const ry = point.y - pivot.y
  return {
    x: pivot.x + rx * Math.cos(radians) - ry * Math.sin(radians) + lateral,
    y: pivot.y + rx * Math.sin(radians) + ry * Math.cos(radians) + feed,
    angle,
  }
}
