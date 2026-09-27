import { describe, expect, it } from 'vitest'
import { niceStep, posterPxPerUnit, rulerTicks } from './rulerTicks'

describe('niceStep', () => {
  it('rounds up to a 1/2/5 progression', () => {
    expect(niceStep(0.7)).toBe(1)
    expect(niceStep(1.3)).toBe(2)
    expect(niceStep(3)).toBe(5)
    expect(niceStep(7)).toBe(10)
    expect(niceStep(180)).toBe(200)
  })
})

describe('rulerTicks', () => {
  it('labels mm on a 300dpi poster with readable spacing', () => {
    const ticks = rulerTicks({ start: 0, end: 3508, displayScale: 0.126, unit: 'mm', dpi: 300 })
    const labels = ticks.filter((tick) => tick.major)
    expect(labels[0].label).toBe('0')
    // 64 screen px at 0.126 zoom ≈ 43mm → 50mm steps.
    expect(labels[1].label).toBe('50')
    const spacing = (labels[1].position - labels[0].position) * 0.126
    expect(spacing).toBeGreaterThanOrEqual(64)
    expect(labels.at(-1)!.position).toBeLessThanOrEqual(3508)
  })

  it('tightens labels as you zoom in', () => {
    const far = rulerTicks({ start: 0, end: 1000, displayScale: 0.25, unit: 'px' }).filter((t) => t.major)
    const near = rulerTicks({ start: 0, end: 1000, displayScale: 4, unit: 'px' }).filter((t) => t.major)
    expect(near[1].position - near[0].position).toBeLessThan(far[1].position - far[0].position)
  })

  it('handles visible ranges that start before the poster', () => {
    const ticks = rulerTicks({ start: -300, end: 300, displayScale: 1, unit: 'px' })
    expect(ticks.some((tick) => tick.label === '-200')).toBe(true)
    expect(ticks.some((tick) => tick.label === '0')).toBe(true)
  })

  it('converts mm at document dpi', () => {
    expect(posterPxPerUnit('mm', 300)).toBeCloseTo(11.811, 3)
    expect(posterPxPerUnit('px')).toBe(1)
  })

  it('returns nothing for empty ranges', () => {
    expect(rulerTicks({ start: 10, end: 10, displayScale: 1, unit: 'px' })).toEqual([])
  })
})
