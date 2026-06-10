import { describe, expect, it } from 'vitest'
import { createSeededRandom, newSeed } from './random'

describe('createSeededRandom', () => {
  it('produces a deterministic sequence for the same seed', () => {
    const a = createSeededRandom(4719)
    const b = createSeededRandom(4719)
    const sequenceA = Array.from({ length: 8 }, () => a())
    const sequenceB = Array.from({ length: 8 }, () => b())
    expect(sequenceA).toEqual(sequenceB)
  })

  it('produces different sequences for different seeds', () => {
    const a = createSeededRandom(1)
    const b = createSeededRandom(2)
    const sequenceA = Array.from({ length: 8 }, () => a())
    const sequenceB = Array.from({ length: 8 }, () => b())
    expect(sequenceA).not.toEqual(sequenceB)
  })

  it('stays within [0, 1)', () => {
    const random = createSeededRandom(99999)
    for (let index = 0; index < 1000; index += 1) {
      const value = random()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('newSeed', () => {
  it('returns a readable integer seed', () => {
    for (let index = 0; index < 50; index += 1) {
      const seed = newSeed()
      expect(Number.isInteger(seed)).toBe(true)
      expect(seed).toBeGreaterThanOrEqual(1000)
      expect(seed).toBeLessThan(100000)
    }
  })
})
