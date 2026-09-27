/**
 * The "Wreck this poster" seed: a disciplined Swiss (International Typographic
 * Style) layout, built to be taken apart. Rules follow the vyo explain-app
 * Swiss canon (Müller-Brockmann grid + Vignelli palette):
 *
 * - white paper, near-black ink, grey only for meta, ONE red mark (the full stop)
 * - a real 12-column grid; every element starts on a column line
 * - flush-left grotesque type in two roles (display + body), violent scale contrast
 * - one deliberately empty zone (cols 8–12 beside the purpose line)
 * - a transit line with 4 stations (3, 4 or 6 land on 12 columns — never 5)
 *
 * This module is pure: it returns plain layer specs in poster pixels. App.tsx
 * turns them into Fabric objects, so the geometry can be unit-tested.
 */

export const SWISS = {
  paper: '#ffffff',
  ink: '#0a0a0a',
  inkSoft: '#5b6066',
  accent: '#e4002b',
  font: 'Helvetica',
} as const

export const SWISS_COLUMNS = 12

/** Line index → per-character style overrides (Fabric Textbox `styles` shape). */
export type LineStyles = Record<number, Record<number, Record<string, string | number>>>

export type SwissTextSpec = {
  type: 'text'
  name: string
  text: string
  left: number
  top: number
  width: number
  fontSize: number
  fontWeight: number
  lineHeight: number
  charSpacing: number
  fill: string
  textAlign: 'left' | 'right'
  styles?: LineStyles
}

export type SwissRectSpec = {
  type: 'rect'
  name: string
  left: number
  top: number
  width: number
  height: number
  fill: string
}

export type SwissPathSpec = {
  type: 'path'
  name: string
  d: string
  strokeWidth: number
  fill: string
  stroke: string
}

export type SwissLayerSpec = SwissTextSpec | SwissRectSpec | SwissPathSpec

export type SwissGrid = {
  margin: number
  gutter: number
  column: number
  /** Left edge of column `c` (1-based). */
  x: (c: number) => number
  /** Width of the span from column `a` to column `b` inclusive. */
  span: (a: number, b: number) => number
}

export function swissGrid(width: number): SwissGrid {
  const margin = width * 0.07
  const gutter = width * 0.022
  const column = (width - margin * 2 - gutter * (SWISS_COLUMNS - 1)) / SWISS_COLUMNS
  return {
    margin,
    gutter,
    column,
    x: (c) => margin + (c - 1) * (column + gutter),
    span: (a, b) => (b - a + 1) * column + (b - a) * gutter,
  }
}

/**
 * Fabric draws a text line's baseline at top + fontSize × 1.13 × (1 − 0.222)
 * (its _fontSizeMult and _fontSizeFraction) for the first line of a box.
 */
export const FABRIC_BASELINE_RATIO = 1.13 * (1 - 0.222)

/** Style every character of `line` in `text` with `style`. */
function styleLine(text: string, line: number, style: Record<string, string | number>): LineStyles {
  const chars = text.split('\n')[line] ?? ''
  const row: Record<number, Record<string, string | number>> = {}
  for (let i = 0; i < chars.length; i += 1) row[i] = { ...style }
  return { [line]: row }
}

export const SWISS_STATIONS = [
  { label: 'Scatter', verb: 'Throw it' },
  { label: 'Xerox', verb: 'Copy it' },
  { label: 'Re-roll', verb: 'Roll again' },
  { label: 'Undo', verb: 'Walk it back' },
] as const

const MATERIALS = [
  { numeral: '01', title: 'Type', line: 'Set it big, flush left, on the grid.' },
  { numeral: '02', title: 'Grid', line: 'Twelve columns hold every element in place.' },
  { numeral: '03', title: 'Accident', line: 'Break it on purpose. Every move stays editable.' },
] as const

/**
 * Build the seed poster for any poster size. Horizontal positions come from the
 * 12-column grid on the poster width; sizes and vertical rhythm scale with `u`,
 * the width of an A-series page that fits the poster, so square and landscape
 * presets keep the same proportions without overflowing.
 *
 * `measureHeadline` returns the rendered width of the masthead line so the red
 * full stop can sit right after the last letter (Fabric measures it for real).
 */
export function buildSwissPoster(
  width: number,
  height: number,
  measureHeadline: (text: string, fontSize: number) => number,
): SwissLayerSpec[] {
  const grid = swissGrid(width)
  const u = Math.min(width, height / Math.SQRT2)
  const mv = u * 0.07
  const hair = Math.max(1, u * 0.0011)
  const rule = Math.max(2, u * 0.0023)

  const folioSize = u * 0.013
  const bodySize = u * 0.02
  const captionSize = u * 0.017
  const numeralSize = u * 0.06
  const headSize = u * 0.185

  const layers: SwissLayerSpec[] = []

  // ── Folio: label (ink) · promise (soft) · meta (soft, right) — hangs from a 2px rule.
  const folioTop = mv
  layers.push(
    text('Folio', 'Issue 01', grid.x(1), folioTop, grid.span(1, 4), folioSize, { fontWeight: 500 }),
    text('Folio promise', 'A poster made to be taken apart', grid.x(5), folioTop, grid.span(5, 9), folioSize, {
      fill: SWISS.inkSoft,
    }),
    text('Folio meta', 'Autumn 2026', grid.x(10), folioTop, grid.span(10, 12), folioSize, {
      fill: SWISS.inkSoft,
      textAlign: 'right',
    }),
  )
  const ruleTop = folioTop + folioSize * 1.13 + u * 0.012
  layers.push(rect('Folio rule', grid.x(1), ruleTop, grid.span(1, 12), rule, SWISS.ink))

  // ── Masthead: one line, flush left, optically nudged so ink meets column line 1.
  const headline = 'RAY GUN'
  const headTop = ruleTop + u * 0.045
  const headLeft = grid.x(1) - headSize * 0.04
  layers.push(
    text('Oversized headline', headline, headLeft, headTop, grid.span(1, 12) + headSize * 0.04, headSize, {
      fontWeight: 700,
      lineHeight: 0.9,
      charSpacing: -30,
    }),
  )
  // The single accent: a red full stop closing the masthead.
  const dot = headSize * 0.15
  const baseline = headTop + headSize * FABRIC_BASELINE_RATIO
  layers.push(
    rect(
      'Red interruption',
      headLeft + measureHeadline(headline, headSize) + headSize * 0.05,
      baseline - dot,
      dot,
      dot,
      SWISS.accent,
    ),
  )

  // ── Purpose: cols 1–7 in ink. Cols 8–12 stay empty on purpose.
  const purposeTop = headTop + headSize * 1.13 + u * 0.04
  layers.push(
    text(
      'Purpose',
      'Legibility is not neutral. A clean Swiss layout on a twelve-column grid, built to be taken apart one accident at a time.',
      grid.x(1),
      purposeTop,
      grid.span(1, 7),
      bodySize,
      { lineHeight: 1.3 },
    ),
  )

  // ── Bottom cluster, anchored to the foot so the middle of the page stays open.
  const footerTextTop = height - mv - captionSize * 1.13
  const footerRuleTop = footerTextTop - u * 0.014
  const stationsTop = footerRuleTop - u * 0.12
  const lineY = stationsTop - u * 0.03
  const materialsTop = lineY - u * 0.1 - (numeralSize * 1.13 + captionSize * 1.13 * 1.2 * 3)

  // Materials: giant numerals on 4-column spans (3 × 4 = 12).
  MATERIALS.forEach((item, index) => {
    const start = 1 + index * 4
    const body = `${item.numeral}\n${item.title}\n${item.line}`
    layers.push(
      text(`Material ${item.numeral}`, body, grid.x(start), materialsTop, grid.span(start, start + 2), captionSize, {
        lineHeight: 1.2,
        styles: {
          ...styleLine(body, 0, { fontSize: numeralSize, fontWeight: 700 }),
          ...styleLine(body, 1, { fontWeight: 700 }),
        },
      }),
    )
  })

  // Transit line: one ink line, four solid stations on 3-column spans.
  const r = Math.max(4, u * 0.0085)
  const stationCols = SWISS_STATIONS.map((_, index) => 1 + index * 3)
  const lineStart = grid.x(1)
  const lineEnd = grid.x(12) + grid.column
  let d = `M ${round(lineStart)} ${round(lineY)} L ${round(lineEnd)} ${round(lineY)}`
  for (const c of stationCols) {
    const cx = grid.x(c) + r
    d += ` M ${round(cx - r)} ${round(lineY)} a ${round(r)} ${round(r)} 0 1 0 ${round(r * 2)} 0 a ${round(r)} ${round(r)} 0 1 0 ${round(-r * 2)} 0`
  }
  layers.push({ type: 'path', name: 'Transit line', d, strokeWidth: rule, fill: SWISS.ink, stroke: SWISS.ink })

  SWISS_STATIONS.forEach((station, index) => {
    const c = stationCols[index]
    const body = `${station.label}\n${station.verb}`
    layers.push(
      text(`Station ${index + 1}`, body, grid.x(c), stationsTop, grid.span(c, c + 2), captionSize, {
        lineHeight: 1.2,
        styles: {
          ...styleLine(body, 0, { fontWeight: 700 }),
          ...styleLine(body, 1, { fill: SWISS.inkSoft }),
        },
      }),
    )
  })

  // Footer: hairline, then meta left and right.
  layers.push(rect('Footer rule', grid.x(1), footerRuleTop, grid.span(1, 12), hair, SWISS.ink))
  layers.push(
    text('Footer', 'Set in Helvetica on a twelve-column grid. One red full stop.', grid.x(1), footerTextTop, grid.span(1, 8), captionSize, {
      fill: SWISS.inkSoft,
    }),
    text('Footer credit', 'Made in Carson', grid.x(9), footerTextTop, grid.span(9, 12), captionSize, {
      fill: SWISS.inkSoft,
      textAlign: 'right',
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
  options: Partial<Pick<SwissTextSpec, 'fontWeight' | 'lineHeight' | 'charSpacing' | 'fill' | 'textAlign' | 'styles'>> = {},
): SwissTextSpec {
  return {
    type: 'text',
    name,
    text: value,
    left,
    top,
    width,
    fontSize,
    fontWeight: options.fontWeight ?? 400,
    lineHeight: options.lineHeight ?? 1.16,
    charSpacing: options.charSpacing ?? 0,
    fill: options.fill ?? SWISS.ink,
    textAlign: options.textAlign ?? 'left',
    styles: options.styles,
  }
}

function rect(name: string, left: number, top: number, width: number, height: number, fill: string): SwissRectSpec {
  return { type: 'rect', name, left, top, width, height, fill }
}
