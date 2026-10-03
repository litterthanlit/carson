import { describe, expect, it } from 'vitest'
import { createSeededRandom } from './random'
import {
  breakGlyph,
  findCut,
  inkBounds,
  LETTER_BREAK_DEFAULTS,
  letterBreakParamsFromRecord,
  type InkPlane,
} from './letterBreak'

/** A blocky "h": a full-height stem, an arch at x-height, a right leg. */
function glyphH(): InkPlane {
  const width = 100
  const height = 120
  const alpha = new Float32Array(width * height)
  const fill = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) alpha[y * width + x] = 1
  }
  fill(10, 10, 28, 110) // stem
  fill(28, 45, 72, 60) // arch
  fill(58, 45, 76, 110) // leg
  return { width, height, alpha }
}

const coverage = (plane: InkPlane, pieces: ReturnType<typeof breakGlyph>) => {
  let covered = 0
  let ink = 0
  for (let y = 0; y < plane.height; y++) {
    for (let x = 0; x < plane.width; x++) {
      if (plane.alpha[y * plane.width + x] < 0.5) continue
      ink++
      if (pieces.some((piece) => x >= piece.rect.x0 && x < piece.rect.x1 && y >= piece.rect.y0 && y < piece.rect.y1)) covered++
    }
  }
  return covered / ink
}

describe('letter break', () => {
  it('finds the ink bounds of a glyph', () => {
    expect(inkBounds(glyphH())).toEqual({ x0: 10, y0: 10, x1: 76, y1: 110 })
    expect(inkBounds({ width: 4, height: 4, alpha: new Float32Array(16) })).toBeNull()
  })

  it('cuts an h at the edge of its stem, where the arch leaves it', () => {
    const cut = findCut(glyphH(), { x0: 9, y0: 9, x1: 77, y1: 111 }, 100, 0, createSeededRandom(1))
    expect(cut?.axis).toBe('x')
    expect(cut!.at).toBeGreaterThanOrEqual(26)
    expect(cut!.at).toBeLessThanOrEqual(32)
  })

  it('cuts along the line when asked for horizontal cuts only', () => {
    const cut = findCut(glyphH(), { x0: 9, y0: 9, x1: 77, y1: 111 }, 100, 100, createSeededRandom(1))
    expect(cut?.axis).toBe('y')
  })

  it('partitions the glyph: with no gap and nothing dropped, every bit of ink is kept', () => {
    const plane = glyphH()
    const pieces = breakGlyph(plane, 100, { ...LETTER_BREAK_DEFAULTS, depth: 3, gap: 0, drop: 0 }, createSeededRandom(4))
    expect(pieces.length).toBeGreaterThan(1)
    expect(coverage(plane, pieces)).toBe(1)
  })

  it('slides pieces only along the cut that freed them', () => {
    const pieces = breakGlyph(glyphH(), 100, { ...LETTER_BREAK_DEFAULTS, depth: 1, axis: 0, shift: 100, drop: 0 }, createSeededRandom(5))
    expect(pieces).toHaveLength(2)
    for (const piece of pieces) expect(piece.dx).toBe(0)
    expect(pieces.some((piece) => piece.dy !== 0)).toBe(true)
  })

  it('opens a kerf at each cut', () => {
    const pieces = breakGlyph(glyphH(), 100, { ...LETTER_BREAK_DEFAULTS, depth: 1, axis: 0, gap: 100, shift: 0, drop: 0 }, createSeededRandom(6))
    const [left, right] = [...pieces].sort((a, b) => a.rect.x0 - b.rect.x0)
    expect(right.rect.x0 - left.rect.x1).toBeCloseTo(7, 5)
  })

  it('never drops every piece of a letter', () => {
    for (let seed = 1; seed < 30; seed++) {
      const pieces = breakGlyph(glyphH(), 100, { ...LETTER_BREAK_DEFAULTS, depth: 3, drop: 100 }, createSeededRandom(seed))
      expect(pieces.some((piece) => !piece.dropped)).toBe(true)
    }
  })

  it('is deterministic per seed', () => {
    const run = () => breakGlyph(glyphH(), 100, LETTER_BREAK_DEFAULTS, createSeededRandom(77))
    expect(run()).toEqual(run())
  })

  it('reads saved params with defaults and clamps depth', () => {
    expect(letterBreakParamsFromRecord({ depth: 9 }).depth).toBe(4)
    expect(letterBreakParamsFromRecord({}).gap).toBe(LETTER_BREAK_DEFAULTS.gap)
  })
})
