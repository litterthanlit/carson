/**
 * Pure snapping math for canvas-edge, canvas-center, and object-to-object
 * alignment. Returns the snap delta plus guide lines to render.
 */
export type SnapBounds = {
  left: number
  top: number
  width: number
  height: number
}

export type SnapResult = {
  dx: number
  dy: number
  vGuides: number[]
  hGuides: number[]
}

type Candidate = { position: number; distance: number }

function edges(bounds: SnapBounds) {
  return {
    xs: [bounds.left, bounds.left + bounds.width / 2, bounds.left + bounds.width],
    ys: [bounds.top, bounds.top + bounds.height / 2, bounds.top + bounds.height],
  }
}

function best(candidates: Candidate[]): Candidate | null {
  if (candidates.length === 0) return null
  return candidates.reduce((a, b) => (Math.abs(b.distance) < Math.abs(a.distance) ? b : a))
}

export function computeSnap(
  moving: SnapBounds,
  others: SnapBounds[],
  canvas: { width: number; height: number },
  threshold: number,
): SnapResult {
  const movingEdges = edges(moving)
  const targetXs = [0, canvas.width / 2, canvas.width]
  const targetYs = [0, canvas.height / 2, canvas.height]
  for (const other of others) {
    const e = edges(other)
    targetXs.push(...e.xs)
    targetYs.push(...e.ys)
  }

  const xCandidates: Candidate[] = []
  const yCandidates: Candidate[] = []
  for (const mx of movingEdges.xs) {
    for (const tx of targetXs) {
      const distance = tx - mx
      if (Math.abs(distance) <= threshold) xCandidates.push({ position: tx, distance })
    }
  }
  for (const my of movingEdges.ys) {
    for (const ty of targetYs) {
      const distance = ty - my
      if (Math.abs(distance) <= threshold) yCandidates.push({ position: ty, distance })
    }
  }

  const bx = best(xCandidates)
  const by = best(yCandidates)

  return {
    dx: bx?.distance ?? 0,
    dy: by?.distance ?? 0,
    vGuides: bx ? [bx.position] : [],
    hGuides: by ? [by.position] : [],
  }
}
