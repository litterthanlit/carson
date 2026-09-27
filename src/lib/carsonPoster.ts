/**
 * The "Wreck this poster" seed: a David Carson-style collage — layered,
 * torn and overprinted, type breaking its own grid. Everything is a normal,
 * editable layer (text, rects, torn-paper polygons, rules), so the walkthrough
 * can scatter and xerox it further.
 *
 * Pure module: returns layer specs in poster pixels; App.tsx turns them into
 * Fabric objects. Torn edges come from a fixed seed so the seed poster looks
 * the same every time.
 */
import { createSeededRandom } from './random'

export const CARSON_PAPER = '#ecebe6'
export const CARSON_INK = '#111111'

const RED = '#e5231b'
const ORANGE = '#e8431a'
const BLUE = '#2f6fd6'
const YELLOW = '#f2c300'

type Blend = 'source-over' | 'multiply'

type Base = {
  name: string
  angle?: number
  opacity?: number
  blend?: Blend
}

export type CarsonTextSpec = Base & {
  type: 'text'
  text: string
  left: number
  top: number
  width: number
  fontFamily: string
  fontSize: number
  fontWeight: number
  lineHeight: number
  charSpacing: number
  fill: string
}

export type CarsonRectSpec = Base & {
  type: 'rect'
  left: number
  top: number
  width: number
  height: number
  fill: string
}

export type CarsonPolygonSpec = Base & {
  type: 'polygon'
  points: { x: number; y: number }[]
  fill: string
}

export type CarsonLineSpec = Base & {
  type: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
  stroke: string
  strokeWidth: number
}

export type CarsonLayerSpec = CarsonTextSpec | CarsonRectSpec | CarsonPolygonSpec | CarsonLineSpec

/**
 * A torn-paper scrap: walk the edge of a rectangle in small steps, pushing each
 * point in or out by a seeded amount, so the outline reads as ripped, not cut.
 */
export function tornScrap(
  left: number,
  top: number,
  width: number,
  height: number,
  seed: number,
  roughness = 0.06,
): { x: number; y: number }[] {
  const random = createSeededRandom(seed)
  const jitter = Math.min(width, height) * roughness
  const points: { x: number; y: number }[] = []
  const steps = 34
  // A random walk rather than independent jitter: each point drifts from the
  // last one, so the edge meanders like a real tear instead of spiking.
  let drift = 0
  const edge = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number) => {
    for (let i = 0; i < steps; i += 1) {
      const t = i / steps
      drift = drift * 0.6 + (random() - 0.5) * jitter
      drift = Math.max(-jitter * 1.4, Math.min(jitter * 1.4, drift))
      // Now and then a small fibre notch.
      const notch = random() < 0.08 ? (random() - 0.5) * jitter * 1.6 : 0
      const offset = drift + notch
      points.push({ x: x0 + (x1 - x0) * t + nx * offset, y: y0 + (y1 - y0) * t + ny * offset })
    }
  }
  edge(left, top, left + width, top, 0, 1)
  edge(left + width, top, left + width, top + height, 1, 0)
  edge(left + width, top + height, left, top + height, 0, 1)
  edge(left, top + height, left, top, 1, 0)
  return points.map((point) => ({ x: round(point.x), y: round(point.y) }))
}

// Bundled library faces (public/fonts), so the seed renders the same on every machine.
const MONO = 'IBM Plex Mono'
const TYPEWRITER = 'Special Elite'
const HEAVY = 'Archivo Black'
const GROTESK = 'Archivo'

/** Families the seed poster uses; App loads these before drawing it. */
export const CARSON_POSTER_FONTS = [MONO, TYPEWRITER, HEAVY, GROTESK] as const

/**
 * Build the collage for any poster size. Positions are fractions of the page so
 * every preset gets the same composition; type sizes scale with `u`, the width
 * of an A-series page that fits, so square and landscape posters don't blow out.
 */
export function buildCarsonPoster(width: number, height: number): CarsonLayerSpec[] {
  const W = width
  const H = height
  const u = Math.min(W, H / Math.SQRT2)
  const px = (fx: number) => W * fx
  const py = (fy: number) => H * fy
  const layers: CarsonLayerSpec[] = []

  // ── Paper structure: fold lines, like a poster that has been posted and folded.
  layers.push(
    line('Vertical fold', px(0.5), 0, px(0.5), H, 'rgba(17,17,17,0.14)', Math.max(1, u * 0.0012)),
    line('Horizontal fold', 0, py(0.5), W, py(0.5), 'rgba(17,17,17,0.12)', Math.max(1, u * 0.0012)),
  )

  // ── Colour scraps under the type (multiply, so ink overprints them).
  layers.push(
    {
      type: 'polygon',
      name: 'Red interruption',
      points: tornScrap(px(-0.02), py(0.015), px(0.42), py(0.16), 1983, 0.07),
      fill: RED,
      angle: -3,
      blend: 'multiply',
    },
    rect('Blue scan', px(0.36), py(0.12), px(0.22), py(0.2), BLUE, { angle: 1.5, opacity: 0.92, blend: 'multiply' }),
    rect('Orange card', px(0.07), py(0.39), px(0.17), py(0.17), ORANGE, { angle: -2, blend: 'multiply' }),
    {
      type: 'polygon',
      name: 'Yellow smear',
      points: tornScrap(px(0.62), py(0.53), px(0.28), py(0.075), 1991, 0.14),
      fill: YELLOW,
      angle: -4,
      opacity: 0.95,
      blend: 'multiply',
    },
    {
      type: 'polygon',
      name: 'Black tear',
      points: tornScrap(px(0.06), py(0.74), px(0.24), py(0.17), 1996, 0.1),
      fill: CARSON_INK,
      angle: 6,
    },
    {
      type: 'polygon',
      name: 'Paper scrap',
      points: tornScrap(px(0.6), py(0.075), px(0.29), py(0.105), 2001, 0.08),
      fill: '#faf9f5',
      angle: 5,
    },
    rect('Red speck', px(0.33), py(0.765), px(0.014), px(0.014), RED, { angle: 12 }),
    rect('Red speck 2', px(0.365), py(0.79), px(0.009), px(0.009), RED, { angle: -8 }),
  )

  // ── Running mono copy across the top, overlapping itself.
  layers.push(
    text(
      'Mono lede',
      'The art of making a mess on purpose was recorded by hand: manual fragments, image noise, broken grids. Legibility is not neutral. The end of print gave an impression of something different.',
      px(0.03),
      py(0.022),
      px(0.94),
      u * 0.026,
      { fontFamily: TYPEWRITER, lineHeight: 0.92, fontWeight: 400 },
    ),
  )

  // ── A big word behind the headline, clipped by the page like a torn masthead.
  layers.push(
    text('Mess', 'mess', px(0.02), py(0.14), px(0.9), u * 0.2, {
      fontFamily: HEAVY,
      fontWeight: 400,
      lineHeight: 0.8,
      charSpacing: -60,
      opacity: 0.88,
    }),
  )

  // ── The headline: CARSON broken across lines, bleeding off the right edge.
  layers.push(
    text('Oversized headline', 'CAR\nSON', px(0.04), py(0.37), px(1.1), u * 0.3, {
      fontFamily: HEAVY,
      fontWeight: 400,
      lineHeight: 0.74,
      charSpacing: -70,
      opacity: 0.94,
    }),
  )

  // ── Vertical mono column on the right, reading bottom to top.
  layers.push(
    text(
      'Vertical column',
      'the end of the print gave an\nimpression of something different\nand the revision was all tentative',
      px(0.955),
      py(0.2),
      py(0.52),
      u * 0.024,
      { fontFamily: TYPEWRITER, lineHeight: 1.05, fontWeight: 400, angle: 90 },
    ),
    text('Graphic', 'graphic', px(0.735), py(0.26), py(0.3), u * 0.05, {
      fontFamily: MONO,
      fontWeight: 400,
      lineHeight: 1,
      angle: 90,
    }),
  )

  // ── A smeared stack of repeated type — lines crushed onto each other.
  layers.push(
    text('Type smear', 'fragments\nfragments\nfragments\nfragments\nfragments\nfragments', px(0.2), py(0.66), px(0.3), u * 0.045, {
      fontFamily: MONO,
      fontWeight: 700,
      lineHeight: 0.32,
      charSpacing: -40,
    }),
  )

  // ── Stray rules crossing the headline, like registration lines left in.
  layers.push(
    line('Crossing rule', px(0.1), py(0.33), px(0.62), py(0.47), CARSON_INK, Math.max(1, u * 0.0016)),
    line('Rule', px(0.05), py(0.635), px(0.66), py(0.635), CARSON_INK, Math.max(1, u * 0.0012)),
  )

  // ── Pasted fragments: a label on the paper scrap, reversed type on the black tear.
  layers.push(
    text('Scrap label', 'ISSUE 01 / NO RULES\nlegibility is\nnot neutral', px(0.625), py(0.092), px(0.24), u * 0.018, {
      fontFamily: MONO,
      fontWeight: 700,
      lineHeight: 1.15,
      angle: 5,
    }),
    text('Reversed type', 'print\nis\nnot\ndead', px(0.12), py(0.77), px(0.14), u * 0.03, {
      fontFamily: HEAVY,
      fontWeight: 400,
      lineHeight: 0.86,
      fill: CARSON_PAPER,
      angle: 6,
    }),
  )

  // ── Small printed matter: a caption, an issue mark, and the studio name bottom right.
  layers.push(
    text('Caption', 'no. 01 — manual fragments / image noise / broken grids', px(0.34), py(0.345), px(0.3), u * 0.016, {
      fontFamily: MONO,
      fontWeight: 400,
      lineHeight: 1.1,
    }),
    text('Studio', 'poster\nstudio', px(0.62), py(0.86), px(0.36), u * 0.075, {
      fontFamily: GROTESK,
      fontWeight: 700,
      lineHeight: 0.85,
      charSpacing: -30,
    }),
  )

  return layers
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function text(
  name: string,
  value: string,
  left: number,
  top: number,
  width: number,
  fontSize: number,
  options: Partial<Pick<CarsonTextSpec, 'fontFamily' | 'fontWeight' | 'lineHeight' | 'charSpacing' | 'fill' | 'angle' | 'opacity' | 'blend'>> = {},
): CarsonTextSpec {
  return {
    type: 'text',
    name,
    text: value,
    left,
    top,
    width,
    fontSize,
    fontFamily: options.fontFamily ?? GROTESK,
    fontWeight: options.fontWeight ?? 400,
    lineHeight: options.lineHeight ?? 1.1,
    charSpacing: options.charSpacing ?? 0,
    fill: options.fill ?? CARSON_INK,
    angle: options.angle,
    opacity: options.opacity,
    blend: options.blend,
  }
}

function rect(
  name: string,
  left: number,
  top: number,
  width: number,
  height: number,
  fill: string,
  options: Pick<Base, 'angle' | 'opacity' | 'blend'> = {},
): CarsonRectSpec {
  return { type: 'rect', name, left, top, width, height, fill, ...options }
}

function line(name: string, x1: number, y1: number, x2: number, y2: number, stroke: string, strokeWidth: number): CarsonLineSpec {
  return { type: 'line', name, x1, y1, x2, y2, stroke, strokeWidth }
}
