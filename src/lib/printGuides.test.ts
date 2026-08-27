import { describe, expect, it } from 'vitest'
import { buildPrintGuides } from './printGuides'

describe('print guides', () => {
  it('builds bleed outside trim and a 5mm safe inset', () => {
    const guides = buildPrintGuides({ width: 3508, height: 4961 }, 300, 3)
    const bleed = guides.find((guide) => guide.kind === 'bleed')
    const trim = guides.find((guide) => guide.kind === 'trim')
    const safe = guides.find((guide) => guide.kind === 'safe')
    expect(trim).toEqual({ kind: 'trim', left: 0, top: 0, width: 3508, height: 4961 })
    expect(bleed?.left).toBeLessThan(0)
    expect(bleed?.width).toBeGreaterThan(3508)
    expect(safe?.left).toBeGreaterThan(0)
    expect((safe?.width ?? 0) + (safe?.left ?? 0) * 2).toBe(3508)
  })
})
