import { describe, expect, it } from 'vitest'
import { describeResolution, effectiveResolution, resolutionUnits } from './imageResolution'
import { getPosterPreset } from './editorModel'
import { createResolutionStore } from './resolutionStore'

describe('resolutionUnits', () => {
  it('measures print presets in ppi at the document dpi and screen presets in px', () => {
    expect(resolutionUnits(getPosterPreset('a3'), 300)).toEqual({ kind: 'print', dpi: 300 })
    expect(resolutionUnits(getPosterPreset('a3'), 150)).toEqual({ kind: 'print', dpi: 150 })
    expect(resolutionUnits(getPosterPreset('instagram'), 72)).toEqual({ kind: 'screen' })
    expect(resolutionUnits(getPosterPreset('custom'))).toEqual({ kind: 'screen' })
  })
})

describe('effectiveResolution', () => {
  const print = { kind: 'print', dpi: 300 } as const

  it('is the document dpi when a photo shows one source pixel per poster pixel', () => {
    expect(effectiveResolution({ shown: { width: 2000, height: 1500 }, onPoster: { width: 2000, height: 1500 }, units: print })).toEqual({
      kind: 'print',
      ppi: 300,
      low: false,
    })
  })

  it('drops as the photo is enlarged, warning under 150 ppi', () => {
    // 900 px over 2000 poster px = 6.67 in at 300 dpi → 135 ppi.
    const low = effectiveResolution({ shown: { width: 900, height: 600 }, onPoster: { width: 2000, height: 1333.33 }, units: print })
    expect(low).toEqual({ kind: 'print', ppi: 135, low: true })
    // Exactly 150 is fine.
    expect(effectiveResolution({ shown: { width: 1000, height: 1000 }, onPoster: { width: 2000, height: 2000 }, units: print })?.low).toBe(false)
  })

  it('counts the worse axis of a stretched photo', () => {
    const stretched = effectiveResolution({ shown: { width: 1000, height: 1000 }, onPoster: { width: 1000, height: 3000 }, units: print })
    expect(stretched).toEqual({ kind: 'print', ppi: 100, low: true })
  })

  it('reports screen presets as a share of the photo’s own pixels, warning past 133%', () => {
    expect(effectiveResolution({ shown: { width: 600, height: 400 }, onPoster: { width: 840, height: 560 }, units: { kind: 'screen' } })).toEqual({
      kind: 'screen',
      percent: 140,
      low: true,
    })
    expect(effectiveResolution({ shown: { width: 600, height: 400 }, onPoster: { width: 798, height: 532 }, units: { kind: 'screen' } })?.low).toBe(false)
    expect(effectiveResolution({ shown: { width: 2000, height: 1000 }, onPoster: { width: 1000, height: 500 }, units: { kind: 'screen' } })).toEqual({
      kind: 'screen',
      percent: 50,
      low: false,
    })
  })

  it('has nothing to say about an empty image', () => {
    expect(effectiveResolution({ shown: { width: 0, height: 10 }, onPoster: { width: 10, height: 10 }, units: print })).toBeNull()
  })
})

describe('describeResolution', () => {
  it('puts the number in plain words, and words the warning (not colour alone)', () => {
    expect(describeResolution({ kind: 'print', ppi: 212, low: false })).toEqual({ text: '212 ppi at print size', warning: null })
    expect(describeResolution({ kind: 'print', ppi: 90, low: true }).warning).toMatch(/Low resolution/)
    expect(describeResolution({ kind: 'screen', percent: 140, low: true })).toMatchObject({ text: 'Shown at 140% of its pixels' })
    expect(describeResolution({ kind: 'screen', percent: 140, low: true }).warning).toMatch(/133%/)
  })
})

describe('resolution store', () => {
  it('changes the low-resolution set only when a layer crosses the threshold', () => {
    const store = createResolutionStore()
    let notified = 0
    store.subscribe(() => {
      notified += 1
    })
    store.set('a', { kind: 'print', ppi: 300, low: false })
    const first = store.lowIds()
    store.set('a', { kind: 'print', ppi: 300, low: false })
    expect(notified).toBe(1)
    store.set('a', { kind: 'print', ppi: 200, low: false })
    expect(store.lowIds()).toBe(first)
    store.set('a', { kind: 'print', ppi: 120, low: true })
    expect(store.lowIds().has('a')).toBe(true)
    const low = store.lowIds()
    store.set('a', { kind: 'print', ppi: 110, low: true })
    expect(store.lowIds()).toBe(low)
    store.replaceAll([])
    expect(store.lowIds().size).toBe(0)
    expect(store.get('a')).toBeUndefined()
  })
})
