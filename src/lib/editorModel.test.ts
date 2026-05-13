import { describe, expect, it } from 'vitest'
import {
  applyPosterPreset,
  createCutFragments,
  getPosterPreset,
  scatterLayers,
} from './editorModel'

describe('poster presets', () => {
  it('returns practical pixel dimensions for A3 portrait posters', () => {
    expect(getPosterPreset('a3')).toEqual({
      id: 'a3',
      name: 'A3 portrait',
      width: 1240,
      height: 1754,
    })
  })

  it('keeps custom poster dimensions bounded and usable', () => {
    expect(applyPosterPreset('custom', { width: 120, height: 12000 })).toEqual({
      id: 'custom',
      name: 'Custom',
      width: 320,
      height: 3000,
    })
  })
})

describe('layer transforms', () => {
  it('scatters layers deterministically when a seeded random function is supplied', () => {
    const layers = [
      { id: 'a', left: 100, top: 100, angle: 0, scaleX: 1, scaleY: 1 },
      { id: 'b', left: 200, top: 200, angle: 10, scaleX: 1, scaleY: 1 },
    ]

    const result = scatterLayers(layers, {
      distance: 40,
      rotation: 20,
      scale: 0.25,
      random: () => 0.75,
    })

    expect(result).toEqual([
      { id: 'a', left: 120, top: 120, angle: 10, scaleX: 1.125, scaleY: 1.125 },
      { id: 'b', left: 220, top: 220, angle: 20, scaleX: 1.125, scaleY: 1.125 },
    ])
  })

  it('creates movable horizontal cut fragments that cover the selected layer', () => {
    const fragments = createCutFragments(
      { id: 'layer-1', left: 80, top: 100, width: 300, height: 180 },
      { pieces: 3, gap: 8, direction: 'horizontal' },
    )

    expect(fragments).toEqual([
      {
        id: 'layer-1-cut-1',
        left: 80,
        top: 100,
        width: 300,
        height: 54.666666666666664,
        clipTop: 0,
        clipLeft: 0,
      },
      {
        id: 'layer-1-cut-2',
        left: 88,
        top: 162.66666666666666,
        width: 300,
        height: 54.666666666666664,
        clipTop: 62.666666666666664,
        clipLeft: 0,
      },
      {
        id: 'layer-1-cut-3',
        left: 96,
        top: 225.33333333333331,
        width: 300,
        height: 54.666666666666664,
        clipTop: 125.33333333333333,
        clipLeft: 0,
      },
    ])
  })

  it('keeps fragments usable when the requested gaps are larger than the source', () => {
    const fragments = createCutFragments(
      { id: 'thin-layer', left: 0, top: 0, width: 200, height: 20 },
      { pieces: 5, gap: 9, direction: 'horizontal' },
    )

    expect(fragments).toHaveLength(5)
    expect(fragments.every((fragment) => fragment.height > 0)).toBe(true)
  })
})
