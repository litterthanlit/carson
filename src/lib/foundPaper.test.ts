import { describe, expect, it } from 'vitest'
import { FOUND_PAPER_RASTER, FOUND_PAPERS, foundPaperSize, foundPaperSpec } from './foundPaper'

describe('found paper', () => {
  it('has one spec per kind', () => {
    const kinds = FOUND_PAPERS.map((paper) => paper.kind)
    expect(new Set(kinds).size).toBe(kinds.length)
    expect(foundPaperSpec('receipt').label).toBe('Receipt')
  })

  it('sizes a scrap deterministically from its seed, within its range', () => {
    for (const paper of FOUND_PAPERS) {
      const size = foundPaperSize(paper.kind, 42, 3508)
      expect(foundPaperSize(paper.kind, 42, 3508)).toEqual(size)
      expect(size.width).toBeGreaterThanOrEqual(3508 * paper.width[0])
      expect(size.width).toBeLessThanOrEqual(3508 * paper.width[1])
      expect(size.height).toBeGreaterThanOrEqual(3508 * paper.height[0])
      expect(size.height).toBeLessThanOrEqual(3508 * paper.height[1])
    }
  })

  it('caps the painted raster but keeps the scrap’s proportions', () => {
    const size = foundPaperSize('kraft', 7, 7016)
    expect(Math.max(size.rasterWidth, size.rasterHeight)).toBeLessThanOrEqual(FOUND_PAPER_RASTER)
    expect(size.rasterWidth / size.rasterHeight).toBeCloseTo(size.width / size.height, 1)
  })

  it('keeps receipts tall and tape long and thin', () => {
    const receipt = foundPaperSize('receipt', 3, 3508)
    const tape = foundPaperSize('tape', 3, 3508)
    expect(receipt.height).toBeGreaterThan(receipt.width)
    expect(tape.width / tape.height).toBeGreaterThan(3)
  })
})
