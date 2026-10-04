import { describe, expect, it } from 'vitest'
import { createSeededRandom } from './random'
import { cutLines, cutPaper, type PaperCutOptions } from './paperCuts'

const options: PaperCutOptions = {
  style: 'scalpel',
  direction: 'horizontal',
  pieces: 5,
  separationMm: 0,
  slideMm: 0,
  turnDeg: 0,
  pxPerMm: 4,
}

function inside(x: number, y: number, polygon: { x: number; y: number }[]) {
  let hit = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit
  }
  return hit
}

describe('paper cuts', () => {
  it('cuts the layer into pieces that cover it exactly once — nothing lost, nothing doubled', () => {
    for (const style of ['scalpel', 'tear'] as const) {
      for (const direction of ['horizontal', 'vertical'] as const) {
        const pieces = cutPaper(400, 300, { ...options, style, direction }, createSeededRandom(3))
        expect(pieces).toHaveLength(5)
        for (let y = 2; y < 300; y += 13) {
          for (let x = 2; x < 400; x += 17) {
            const owners = pieces.filter((piece) => inside(x + 0.5, y + 0.5, piece.polygon)).length
            expect(owners).toBe(1)
          }
        }
      }
    }
  })

  it('never lets two cuts cross', () => {
    const { lines } = cutLines(500, 120, 8, 'tear', 4, createSeededRandom(9))
    for (let c = 1; c < lines.length; c++) {
      lines[c].forEach((value, i) => expect(value).toBeGreaterThan(lines[c - 1][i]))
    }
  })

  it('tears wander, scalpel cuts stay nearly straight', () => {
    const roughness = (style: 'scalpel' | 'tear') => {
      const { lines } = cutLines(600, 300, 2, style, 4, createSeededRandom(5))
      const line = lines[0]
      let wander = 0
      for (let i = 1; i < line.length - 1; i++) wander += Math.abs(line[i + 1] - 2 * line[i] + line[i - 1])
      return wander / line.length
    }
    expect(roughness('tear')).toBeGreaterThan(roughness('scalpel') * 4)
  })

  it('moves pieces by hand in millimetres', () => {
    for (const pxPerMm of [4, 12]) {
      const pieces = cutPaper(400, 300, { ...options, slideMm: 10, separationMm: 2, turnDeg: 2, pxPerMm }, createSeededRandom(4))
      for (const piece of pieces) {
        // Slides along the cut (x for horizontal strips) by at most the reach…
        expect(Math.abs(piece.dx)).toBeLessThanOrEqual(10 * pxPerMm + 1e-6)
        // …parts across it by up to ~2 mm per step from the middle…
        expect(Math.abs(piece.dy)).toBeLessThanOrEqual(2 * 2 * pxPerMm + 1e-6)
        // …and turns no more than the hand's reach.
        expect(Math.abs(piece.angle)).toBeLessThanOrEqual(2)
      }
      // Pieces part outward from the middle of the stack.
      expect(pieces[0].dy).toBeLessThan(0)
      expect(pieces[pieces.length - 1].dy).toBeGreaterThan(0)
    }
  })

  it('is the same cut for the same seed', () => {
    expect(cutPaper(300, 200, options, createSeededRandom(1))).toEqual(cutPaper(300, 200, options, createSeededRandom(1)))
  })
})
