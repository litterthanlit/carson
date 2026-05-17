import { describe, expect, it } from 'vitest'
import {
  applyPosterPreset,
  createCutFragments,
  createCropGuides,
  createExpressiveGlyphs,
  createPhotocopyNoise,
  createTearFragments,
  createTypeStrips,
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

describe('manual effect helpers', () => {
  it('creates repeated type strips from selected text', () => {
    const strips = createTypeStrips(
      { id: 'type-1', text: 'CONNWAX', left: 40, top: 80, width: 360 },
      { rows: 3, height: 22, gap: 5, jitter: 10, random: () => 0.75 },
    )

    expect(strips).toEqual([
      {
        id: 'type-1-strip-1',
        text: 'CONNWAX  /  CONNWAX  /  CONNWAX  /  CONNWAX  /  CONNWAX  /  CONNWAX  /  CONNWAX  /  CONNWAX',
        left: 45,
        top: 82.5,
        width: 360,
        height: 22,
        angle: 0.75,
        inverted: false,
      },
      {
        id: 'type-1-strip-2',
        text: 'CONNWAX  /  CONNWAX  /  CONNWAX  /  CONNWAX  /  CONNWAX  /  CONNWAX  /  CONNWAX  /  CONNWAX',
        left: 45,
        top: 109.5,
        width: 360,
        height: 22,
        angle: 0.75,
        inverted: true,
      },
      {
        id: 'type-1-strip-3',
        text: 'CONNWAX  /  CONNWAX  /  CONNWAX  /  CONNWAX  /  CONNWAX  /  CONNWAX  /  CONNWAX  /  CONNWAX',
        left: 45,
        top: 136.5,
        width: 360,
        height: 22,
        angle: 0.75,
        inverted: false,
      },
    ])
  })

  it('creates irregular tear fragments inside the selected layer bounds', () => {
    const fragments = createTearFragments(
      { id: 'image-1', left: 100, top: 120, width: 500, height: 300 },
      { pieces: 4, gap: 20, random: () => 0.25 },
    )

    expect(fragments).toEqual([
      {
        id: 'image-1-tear-1',
        left: 90,
        top: 110,
        width: 103.75,
        height: 300,
        clipTop: 0,
        clipLeft: 0,
        angle: -3.5,
        offsetX: -10,
        offsetY: -10,
      },
      {
        id: 'image-1-tear-2',
        left: 215,
        top: 110,
        width: 103.75,
        height: 300,
        clipTop: 0,
        clipLeft: 125,
        angle: -3.5,
        offsetX: -10,
        offsetY: -10,
      },
      {
        id: 'image-1-tear-3',
        left: 340,
        top: 110,
        width: 103.75,
        height: 300,
        clipTop: 0,
        clipLeft: 250,
        angle: -3.5,
        offsetX: -10,
        offsetY: -10,
      },
      {
        id: 'image-1-tear-4',
        left: 465,
        top: 110,
        width: 125,
        height: 300,
        clipTop: 0,
        clipLeft: 375,
        angle: -3.5,
        offsetX: -10,
        offsetY: -10,
      },
    ])
  })

  it('creates deterministic photocopy marks with a seeded random function', () => {
    const marks = createPhotocopyNoise(
      { width: 400, height: 600 },
      { specks: 2, scratches: 1, scanlines: 2, random: () => 0.5 },
    )

    expect(marks).toEqual([
      { id: 'speck-1', kind: 'speck', left: 200, top: 300, size: 4, opacity: 0.35 },
      { id: 'speck-2', kind: 'speck', left: 200, top: 300, size: 4, opacity: 0.35 },
      {
        id: 'scratch-1',
        kind: 'scratch',
        left: 200,
        top: 300,
        width: 52,
        height: 2,
        angle: 0,
        opacity: 0.28,
      },
      { id: 'scanline-1', kind: 'scanline', left: 0, top: 200, width: 400, height: 1, angle: 0, opacity: 0.14 },
      { id: 'scanline-2', kind: 'scanline', left: 0, top: 400, width: 400, height: 1, angle: 0, opacity: 0.14 },
    ])
  })

  it('creates crop marks, thirds grid, and a registration cross', () => {
    const guides = createCropGuides({ width: 900, height: 1200 }, 90)

    expect(guides).toHaveLength(13)
    expect(guides[0]).toEqual({ id: 'crop-top-left-h', kind: 'line', left: 90, top: 90, width: 64.8, height: 1 })
    expect(guides[8]).toEqual({ id: 'grid-third-v-1', kind: 'line', left: 300, top: 90, width: 1, height: 1020 })
    expect(guides[12]).toEqual({ id: 'registration-center', kind: 'cross', left: 450, top: 600, size: 31.5 })
  })

  it('breaks text into expressive glyph placements with controlled legibility', () => {
    const glyphs = createExpressiveGlyphs(
      {
        id: 'headline',
        text: 'RAY',
        left: 100,
        top: 200,
        fontSize: 80,
        charSpacing: 10,
      },
      {
        intensity: 60,
        legibility: 'medium',
        random: () => 0.75,
      },
    )

    expect(glyphs).toEqual([
      {
        id: 'headline-glyph-1',
        text: 'R',
        left: 103.6,
        top: 201.8,
        angle: 3.6,
        fontSize: 83.6,
        opacity: 0.955,
        scaleX: 1.023,
        scaleY: 1.023,
      },
      {
        id: 'headline-glyph-2',
        text: 'A',
        left: 137.56,
        top: 201.8,
        angle: 3.6,
        fontSize: 83.6,
        opacity: 0.955,
        scaleX: 1.023,
        scaleY: 1.023,
      },
      {
        id: 'headline-glyph-3',
        text: 'Y',
        left: 171.52,
        top: 201.8,
        angle: 3.6,
        fontSize: 83.6,
        opacity: 0.955,
        scaleX: 1.023,
        scaleY: 1.023,
      },
    ])
  })

  it('keeps high-legibility glyphs tighter than extreme glyphs', () => {
    const readable = createExpressiveGlyphs(
      { id: 'type', text: 'AB', left: 0, top: 0, fontSize: 100, charSpacing: 0 },
      { intensity: 100, legibility: 'high', random: () => 1 },
    )
    const extreme = createExpressiveGlyphs(
      { id: 'type', text: 'AB', left: 0, top: 0, fontSize: 100, charSpacing: 0 },
      { intensity: 100, legibility: 'low', random: () => 1 },
    )

    expect(readable[0].angle).toBeLessThan(extreme[0].angle)
    expect(readable[0].top).toBeLessThan(extreme[0].top)
    const readableSpacing = createExpressiveGlyphs(
      { id: 'type', text: 'AB', left: 0, top: 0, fontSize: 100, charSpacing: 0 },
      { intensity: 100, legibility: 'high', random: () => 0.5 },
    )
    const extremeSpacing = createExpressiveGlyphs(
      { id: 'type', text: 'AB', left: 0, top: 0, fontSize: 100, charSpacing: 0 },
      { intensity: 100, legibility: 'low', random: () => 0.5 },
    )

    expect(readableSpacing[1].left).toBeGreaterThan(extremeSpacing[1].left)
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
