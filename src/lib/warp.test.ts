import { describe, expect, it } from 'vitest'
import {
  affineFromTriangles,
  applyHomography,
  identityDistort,
  identityMesh,
  isIdentityWarp,
  squareToQuad,
  tessellateWarp,
  warpBounds,
  warpPoint,
  withHandle,
  type Vec,
} from './warp'

const close = (a: Vec, b: Vec) => {
  expect(a.x).toBeCloseTo(b.x, 6)
  expect(a.y).toBeCloseTo(b.y, 6)
}

describe('homography', () => {
  it('maps the unit square corners onto the quad', () => {
    const quad: [Vec, Vec, Vec, Vec] = [
      { x: 0.1, y: 0.2 },
      { x: 0.9, y: 0 },
      { x: 1.2, y: 1 },
      { x: -0.1, y: 0.8 },
    ]
    const m = squareToQuad(quad)
    close(applyHomography(m, 0, 0), quad[0])
    close(applyHomography(m, 1, 0), quad[1])
    close(applyHomography(m, 1, 1), quad[2])
    close(applyHomography(m, 0, 1), quad[3])
  })

  it('keeps straight lines straight and foreshortens spacing', () => {
    // A trapezoid narrowing toward the top: classic receding floor.
    const warp = { type: 'distort' as const, corners: [{ x: 0.3, y: 0 }, { x: 0.7, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] as [Vec, Vec, Vec, Vec] }
    const a = warpPoint(warp, 0.5, 0)
    const b = warpPoint(warp, 0.5, 0.5)
    const c = warpPoint(warp, 0.5, 1)
    // Collinear along the center line.
    expect(a.x).toBeCloseTo(0.5)
    expect(b.x).toBeCloseTo(0.5)
    expect(c.x).toBeCloseTo(0.5)
    // Foreshortening: the plane's far half is compressed into less screen space, so
    // its midpoint lands nearer the far (narrow) edge.
    expect(b.y).toBeLessThan(0.5)
    expect(b.y).toBeCloseTo(2 / 7)
  })

  it('is the identity for an untouched distort', () => {
    close(warpPoint(identityDistort(), 0.3, 0.7), { x: 0.3, y: 0.7 })
    expect(isIdentityWarp(identityDistort())).toBe(true)
  })
})

describe('mesh', () => {
  it('passes through its control points and is identity when untouched', () => {
    const mesh = identityMesh()
    close(warpPoint(mesh, 0.37, 0.61), { x: 0.37, y: 0.61 })
    const bent = withHandle(mesh, 5, { x: 0.5, y: 0.1 }) // inner point (1,1)
    close(warpPoint(bent, 1 / 3, 1 / 3), { x: 0.5, y: 0.1 })
    expect(isIdentityWarp(bent)).toBe(false)
  })
})

describe('tessellation', () => {
  it('samples (cells+1)² points including padding', () => {
    const grid = tessellateWarp(identityDistort(), 4, 0.1, 0.1)
    expect(grid.source).toHaveLength(25)
    close(grid.source[0], { x: -0.1, y: -0.1 })
    close(grid.target[24], { x: 1.1, y: 1.1 })
  })

  it('computes exact affine maps between triangles', () => {
    const s: [Vec, Vec, Vec] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }]
    const d: [Vec, Vec, Vec] = [{ x: 5, y: 5 }, { x: 25, y: 5 }, { x: 5, y: 35 }]
    const [a, b, c, dd, e, f] = affineFromTriangles(s, d)!
    const map = (p: Vec) => ({ x: a * p.x + c * p.y + e, y: b * p.x + dd * p.y + f })
    s.forEach((point, index) => close(map(point), d[index]))
    expect(affineFromTriangles([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }], d)).toBeNull()
  })

  it('reports warped bounds', () => {
    const warp = withHandle(identityDistort(), 2, { x: 1.5, y: 1.2 })
    const bounds = warpBounds(warp)
    expect(bounds.right).toBeCloseTo(1.5)
    expect(bounds.bottom).toBeCloseTo(1.2)
  })
})

describe('aspect-aware tessellation', () => {
  it('supports different column and row counts', async () => {
    const { tessellateWarp, identityMesh } = await import('./warp')
    const grid = tessellateWarp(identityMesh(), 12, 0, 0, 3)
    expect(grid.rows).toBe(3)
    expect(grid.source).toHaveLength(13 * 4)
  })
})
