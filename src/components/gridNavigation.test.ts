import { describe, expect, it } from 'vitest'
import { nextGridIndex } from './gridNavigation'

describe('nextGridIndex', () => {
  // 5 tiles in 2 columns:  0 1 / 2 3 / 4
  it('moves along rows and clamps at the ends', () => {
    expect(nextGridIndex('ArrowRight', 0, 5, 2)).toBe(1)
    expect(nextGridIndex('ArrowRight', 4, 5, 2)).toBe(4)
    expect(nextGridIndex('ArrowLeft', 0, 5, 2)).toBe(0)
    expect(nextGridIndex('ArrowLeft', 3, 5, 2)).toBe(2)
  })

  it('moves by a full row vertically and stays put past the edge', () => {
    expect(nextGridIndex('ArrowDown', 1, 5, 2)).toBe(3)
    expect(nextGridIndex('ArrowDown', 3, 5, 2)).toBe(3)
    expect(nextGridIndex('ArrowUp', 4, 5, 2)).toBe(2)
    expect(nextGridIndex('ArrowUp', 1, 5, 2)).toBe(1)
  })

  it('jumps with Home and End and ignores other keys', () => {
    expect(nextGridIndex('Home', 3, 5, 2)).toBe(0)
    expect(nextGridIndex('End', 0, 5, 2)).toBe(4)
    expect(nextGridIndex('Enter', 0, 5, 2)).toBeNull()
    expect(nextGridIndex('ArrowRight', 0, 0, 2)).toBeNull()
  })
})
