import { describe, expect, it } from 'vitest'
import {
  applyPosterPreset,
  createAccidentTransforms,
  createAggressiveCropFrame,
  createCutFragments,
  createCropGuides,
  createDiagonalTextureLines,
  createExpressiveGlyphs,
  createLayerDecayMarks,
  createPhotocopyNoise,
  createPrintScanArtifacts,
  createScrapeMasks,
  getLayerDecayProfile,
  getPrintScanProfile,
  createTearFragments,
  createTypeStrips,
  getPosterPreset,
  scatterLayers,
} from './editorModel'

describe('poster presets', () => {
  it('returns print-ready 300dpi dimensions for A3 portrait posters', () => {
    expect(getPosterPreset('a3')).toEqual({
      id: 'a3',
      name: 'A3 portrait (300dpi)',
      width: 3508,
      height: 4961,
      dpi: 300,
      widthMm: 297,
      heightMm: 420,
    })
  })

  it('keeps custom poster dimensions bounded and usable', () => {
    expect(applyPosterPreset('custom', { width: 120, height: 12000 })).toEqual({
      id: 'custom',
      name: 'Custom',
      width: 320,
      height: 10000,
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

  it('returns stronger xerox settings for later copy generations', () => {
    expect(getPrintScanProfile(1)).toEqual({
      generation: 1,
      contrast: 0.28,
      noise: 80,
      blur: 0.04,
      opacity: 0.96,
      misregistration: 3,
    })

    expect(getPrintScanProfile(10)).toEqual({
      generation: 10,
      contrast: 0.78,
      noise: 260,
      blur: 0.16,
      opacity: 0.9,
      misregistration: 18,
    })
  })

  it('creates deterministic print-scan artifacts for the poster surface', () => {
    const artifacts = createPrintScanArtifacts(
      { width: 400, height: 600 },
      { generation: 5, random: () => 0.5 },
    )

    expect(artifacts.slice(0, 4)).toEqual([
      {
        id: 'xerox-band-1',
        kind: 'band',
        left: 0,
        top: 85.714,
        width: 400,
        height: 5,
        opacity: 0.095,
      },
      {
        id: 'xerox-band-2',
        kind: 'band',
        left: 0,
        top: 171.429,
        width: 400,
        height: 5,
        opacity: 0.095,
      },
      {
        id: 'xerox-band-3',
        kind: 'band',
        left: 0,
        top: 257.143,
        width: 400,
        height: 5,
        opacity: 0.095,
      },
      {
        id: 'xerox-band-4',
        kind: 'band',
        left: 0,
        top: 342.857,
        width: 400,
        height: 5,
        opacity: 0.095,
      },
    ])
    expect(artifacts.at(-1)).toEqual({
      id: 'xerox-drift-3',
      kind: 'drift',
      left: 200,
      top: 300,
      width: 64,
      height: 2,
      angle: 0,
      opacity: 0.15,
    })
  })

  it('creates controlled accident transforms for duplicate drift and bad crops', () => {
    const accidents = createAccidentTransforms(
      [
        { id: 'a', left: 100, top: 100, angle: 0, scaleX: 1, scaleY: 1 },
        { id: 'b', left: 200, top: 150, angle: 8, scaleX: 1.2, scaleY: 0.9 },
      ],
      { intensity: 60, random: () => 0.75 },
    )

    expect(accidents).toEqual([
      {
        id: 'a',
        left: 115,
        top: 115,
        angle: 7.5,
        scaleX: 1.045,
        scaleY: 0.955,
        opacity: 0.82,
      },
      {
        id: 'b',
        left: 215,
        top: 165,
        angle: 15.5,
        scaleX: 1.254,
        scaleY: 0.859,
        opacity: 0.82,
      },
    ])
  })

  it('keeps accident intensity bounded and usable', () => {
    const [accident] = createAccidentTransforms([{ id: 'a', left: 0, top: 0, angle: 0, scaleX: 1, scaleY: 1 }], {
      intensity: 999,
      random: () => 1,
    })

    expect(accident.left).toBe(50)
    expect(accident.angle).toBe(25)
    expect(accident.opacity).toBe(0.7)
  })

  it('creates diagonal print texture lines across the poster', () => {
    const lines = createDiagonalTextureLines({ width: 400, height: 600 }, { spacing: 80, angle: -18, opacity: 0.14 })

    expect(lines.slice(0, 3)).toEqual([
      { id: 'diagonal-texture-1', left: -600, top: -400, width: 1000, height: 2, angle: -18, opacity: 0.14 },
      { id: 'diagonal-texture-2', left: -520, top: -400, width: 1000, height: 2, angle: -18, opacity: 0.14 },
      { id: 'diagonal-texture-3', left: -440, top: -400, width: 1000, height: 2, angle: -18, opacity: 0.14 },
    ])
    expect(lines).toHaveLength(18)
  })

  it('creates rough white scrape masks with deterministic drift', () => {
    const masks = createScrapeMasks({ width: 800, height: 1000 }, { count: 3, random: () => 0.5 })

    expect(masks).toEqual([
      { id: 'scrape-mask-1', left: 40, top: 206, width: 520, height: 44, angle: -3, opacity: 0.86 },
      { id: 'scrape-mask-2', left: 40, top: 456, width: 520, height: 44, angle: -3, opacity: 0.86 },
      { id: 'scrape-mask-3', left: 40, top: 706, width: 520, height: 44, angle: -3, opacity: 0.86 },
    ])
  })

  it('creates aggressive crop frames for close and edge crops', () => {
    expect(createAggressiveCropFrame({ id: 'image', left: 100, top: 80, width: 500, height: 300 }, { mode: 'close' })).toEqual({
      id: 'image-close-crop',
      left: 175,
      top: 125,
      width: 350,
      height: 210,
      clipLeft: 75,
      clipTop: 45,
    })

    expect(createAggressiveCropFrame({ id: 'image', left: 100, top: 80, width: 500, height: 300 }, { mode: 'edge' })).toEqual({
      id: 'image-edge-crop',
      left: -25,
      top: 5,
      width: 500,
      height: 270,
      clipLeft: 0,
      clipTop: 0,
    })
  })

  it('creates deterministic off-center crop frames', () => {
    const frame = createAggressiveCropFrame(
      { id: 'image', left: 100, top: 80, width: 500, height: 300 },
      { mode: 'off-center', random: () => 0.75 },
    )

    expect(frame).toEqual({
      id: 'image-off-center-crop',
      left: 231.25,
      top: 158.75,
      width: 325,
      height: 195,
      clipLeft: 131.25,
      clipTop: 78.75,
    })
  })

  it('returns bounded layer decay profiles for clean and destroyed layers', () => {
    expect(getLayerDecayProfile(0)).toEqual({
      amount: 0,
      contrast: 0.1,
      blur: 0.02,
      noise: 30,
      opacity: 0.98,
      misregistration: 1,
    })

    expect(getLayerDecayProfile(100)).toEqual({
      amount: 100,
      contrast: 0.62,
      blur: 0.14,
      noise: 220,
      opacity: 0.82,
      misregistration: 16,
    })
  })

  it('creates deterministic ink loss and fold marks for a decayed layer', () => {
    const marks = createLayerDecayMarks(
      { id: 'photo', left: 100, top: 80, width: 500, height: 300 },
      { amount: 50, random: () => 0.5 },
    )

    expect(marks).toHaveLength(12)
    expect(marks[0]).toEqual({
      id: 'photo-ink-loss-1',
      kind: 'ink-loss',
      left: 350,
      top: 230,
      width: 50,
      height: 9.6,
      angle: 0,
      opacity: 0.675,
    })
    expect(marks.at(-1)).toEqual({
      id: 'photo-fold-3',
      kind: 'fold',
      left: 100,
      top: 305,
      width: 500,
      height: 2,
      angle: 0,
      opacity: 0.23,
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
