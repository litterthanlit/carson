import { describe, expect, it } from 'vitest'
import { crumpleCreases, crumpleHeight, shadeFromGradient } from './materials'

describe('crumple', () => {
  it('is the same sheet for the same seed', () => {
    expect(crumpleCreases(4, 800, 1100)).toEqual(crumpleCreases(4, 800, 1100))
    expect(crumpleCreases(4, 800, 1100)).not.toEqual(crumpleCreases(5, 800, 1100))
  })

  it('crumples harder with more creases', () => {
    expect(crumpleCreases(1, 800, 1100, 100).length).toBeGreaterThan(crumpleCreases(1, 800, 1100, 0).length)
  })

  it('folds into a sharp ridge along a crease line', () => {
    const crease = { nx: 1, ny: 0, cx: 100, cy: 100, slope: 0.1, length: 1000, width: 1000 }
    const onLine = crumpleHeight([crease], 100, 100)
    expect(crumpleHeight([crease], 90, 100)).toBeLessThan(onLine)
    expect(crumpleHeight([crease], 110, 100)).toBeLessThan(onLine)
    // Symmetric tent either side of the crease.
    expect(crumpleHeight([crease], 90, 100)).toBeCloseTo(crumpleHeight([crease], 110, 100), 6)
  })

  it('lights faces turned to the upper-left and shades the others', () => {
    expect(shadeFromGradient(0, 0)).toBeCloseTo(0, 6)
    // Surface rising to the right faces left, toward the light.
    expect(shadeFromGradient(0.3, 0.3)).toBeGreaterThan(0)
    expect(shadeFromGradient(-0.3, -0.3)).toBeLessThan(0)
  })
})
