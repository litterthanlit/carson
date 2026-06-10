/**
 * Seeded pseudo-random number generation for re-rollable chaos operations.
 * Mulberry32: tiny, fast, good distribution for visual jitter.
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Human-friendly seed: 4-5 digits, easy to read aloud or copy. */
export function newSeed(): number {
  return Math.floor(1000 + Math.random() * 99000)
}
