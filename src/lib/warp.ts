/**
 * Perspective (Distort) and mesh Warp geometry.
 *
 * Warps are defined in a layer's local normalized space: (0,0) is the top-left of
 * its unwarped box and (1,1) the bottom-right. A warp maps (u, v) in that square to
 * a destination point in the same normalized space, so warps follow the layer when
 * it moves, scales, or rotates.
 *
 * - `distort`: four free corners with a true projective (homography) mapping, so
 *   straight lines stay straight and spacing foreshortens like real perspective.
 * - `mesh`: a 4×4 grid of control points interpolated with a Catmull-Rom surface,
 *   passing through every handle (Photoshop's Warp).
 */

export type Vec = { x: number; y: number }

export type DistortWarp = { type: 'distort'; corners: [Vec, Vec, Vec, Vec] }
export type MeshWarp = { type: 'mesh'; points: Vec[] }
export type Warp = DistortWarp | MeshWarp

export const MESH_SIZE = 4

export function identityDistort(): DistortWarp {
  return {
    type: 'distort',
    corners: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
  }
}

export function identityMesh(): MeshWarp {
  const points: Vec[] = []
  for (let j = 0; j < MESH_SIZE; j += 1) {
    for (let i = 0; i < MESH_SIZE; i += 1) points.push({ x: i / (MESH_SIZE - 1), y: j / (MESH_SIZE - 1) })
  }
  return { type: 'mesh', points }
}

export function isIdentityWarp(warp: Warp | null | undefined): boolean {
  if (!warp) return true
  const reference = warp.type === 'distort' ? identityDistort().corners : identityMesh().points
  const points = warp.type === 'distort' ? warp.corners : warp.points
  return points.every((point, index) => Math.abs(point.x - reference[index].x) < 1e-6 && Math.abs(point.y - reference[index].y) < 1e-6)
}

/** Handles the editor shows for a warp. */
export function warpHandles(warp: Warp): Vec[] {
  return warp.type === 'distort' ? [...warp.corners] : [...warp.points]
}

export function withHandle(warp: Warp, index: number, point: Vec): Warp {
  if (warp.type === 'distort') {
    const corners = [...warp.corners] as DistortWarp['corners']
    corners[index] = point
    return { type: 'distort', corners }
  }
  const points = [...warp.points]
  points[index] = point
  return { type: 'mesh', points }
}

// ── Homography ─────────────────────────────────────────────────────────────

/** 3×3 projective matrix (row-major) mapping the unit square onto quad q0..q3 (TL, TR, BR, BL). */
export function squareToQuad(q: [Vec, Vec, Vec, Vec]): number[] {
  const [p0, p1, p2, p3] = q
  const dx1 = p1.x - p2.x
  const dx2 = p3.x - p2.x
  const dy1 = p1.y - p2.y
  const dy2 = p3.y - p2.y
  const sx = p0.x - p1.x + p2.x - p3.x
  const sy = p0.y - p1.y + p2.y - p3.y
  let g = 0
  let h = 0
  if (Math.abs(sx) > 1e-12 || Math.abs(sy) > 1e-12) {
    const det = dx1 * dy2 - dx2 * dy1
    if (Math.abs(det) > 1e-12) {
      g = (sx * dy2 - dx2 * sy) / det
      h = (dx1 * sy - sx * dy1) / det
    }
  }
  const a = p1.x - p0.x + g * p1.x
  const b = p3.x - p0.x + h * p3.x
  const c = p0.x
  const d = p1.y - p0.y + g * p1.y
  const e = p3.y - p0.y + h * p3.y
  const f = p0.y
  return [a, b, c, d, e, f, g, h, 1]
}

export function applyHomography(m: number[], u: number, v: number): Vec {
  const w = m[6] * u + m[7] * v + m[8]
  const safe = Math.abs(w) < 1e-9 ? 1e-9 : w
  return { x: (m[0] * u + m[1] * v + m[2]) / safe, y: (m[3] * u + m[4] * v + m[5]) / safe }
}

// ── Mesh ───────────────────────────────────────────────────────────────────

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

function meshPoint(points: Vec[], i: number, j: number): Vec {
  // Mirror past the border so the surface extends smoothly (no pinch at the edge).
  const n = MESH_SIZE - 1
  const ci = Math.min(n, Math.max(0, i))
  const cj = Math.min(n, Math.max(0, j))
  const base = points[cj * MESH_SIZE + ci]
  if (ci === i && cj === j) return base
  const inner = points[Math.min(n, Math.max(0, 2 * ci - i)) + Math.min(n, Math.max(0, 2 * cj - j)) * MESH_SIZE]
  return { x: 2 * base.x - inner.x, y: 2 * base.y - inner.y }
}

function evaluateMesh(points: Vec[], u: number, v: number): Vec {
  const n = MESH_SIZE - 1
  const fu = Math.min(n - 1e-9, Math.max(0, u * n))
  const fv = Math.min(n - 1e-9, Math.max(0, v * n))
  const i = Math.floor(fu)
  const j = Math.floor(fv)
  // Allow gentle extrapolation beyond the unit square (style padding) along the edge cell.
  const tu = u * n - i
  const tv = v * n - j
  const rows: Vec[] = []
  for (let r = -1; r <= 2; r += 1) {
    const p = [-1, 0, 1, 2].map((c) => meshPoint(points, i + c, j + r))
    rows.push({ x: catmullRom(p[0].x, p[1].x, p[2].x, p[3].x, tu), y: catmullRom(p[0].y, p[1].y, p[2].y, p[3].y, tu) })
  }
  return { x: catmullRom(rows[0].x, rows[1].x, rows[2].x, rows[3].x, tv), y: catmullRom(rows[0].y, rows[1].y, rows[2].y, rows[3].y, tv) }
}

/** Map a normalized source point through the warp. */
export function warpPoint(warp: Warp, u: number, v: number): Vec {
  if (warp.type === 'distort') return applyHomography(squareToQuad(warp.corners), u, v)
  return evaluateMesh(warp.points, u, v)
}

// ── Tessellation ───────────────────────────────────────────────────────────

export type WarpGrid = {
  /** Grid resolution (cells across). */
  cells: number
  /** Cells down (defaults to `cells`). */
  rows: number
  /** (cells+1)×(rows+1) source points in normalized space (may extend past 0–1 for padding). */
  source: Vec[]
  /** Matching warped destination points. */
  target: Vec[]
}

/**
 * Sample the warp on a grid spanning [-padU, 1+padU] × [-padV, 1+padV] so effects
 * that bleed past the layer box (shadows, glows) warp along with it.
 */
export function tessellateWarp(warp: Warp, cells: number, padU = 0, padV = 0, rows = cells): WarpGrid {
  const source: Vec[] = []
  const target: Vec[] = []
  const matrix = warp.type === 'distort' ? squareToQuad(warp.corners) : null
  for (let j = 0; j <= rows; j += 1) {
    for (let i = 0; i <= cells; i += 1) {
      const u = -padU + (i / cells) * (1 + 2 * padU)
      const v = -padV + (j / rows) * (1 + 2 * padV)
      source.push({ x: u, y: v })
      target.push(matrix ? applyHomography(matrix, u, v) : evaluateMesh((warp as MeshWarp).points, u, v))
    }
  }
  return { cells, rows, source, target }
}

/** Affine [a, b, c, d, e, f] (canvas setTransform order) mapping triangle s → triangle d. */
export function affineFromTriangles(s: [Vec, Vec, Vec], d: [Vec, Vec, Vec]): [number, number, number, number, number, number] | null {
  const [s0, s1, s2] = s
  const [d0, d1, d2] = d
  const den = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y)
  if (Math.abs(den) < 1e-12) return null
  const a = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / den
  const c = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / den
  const b = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / den
  const d_ = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / den
  const e = d0.x - a * s0.x - c * s0.y
  const f = d0.y - b * s0.x - d_ * s0.y
  return [a, b, c, d_, e, f]
}

/** Bounding box of the warped unit square (normalized space). */
export function warpBounds(warp: Warp) {
  const grid = tessellateWarp(warp, 8)
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const point of grid.target) {
    left = Math.min(left, point.x)
    top = Math.min(top, point.y)
    right = Math.max(right, point.x)
    bottom = Math.max(bottom, point.y)
  }
  return { left, top, right, bottom }
}
