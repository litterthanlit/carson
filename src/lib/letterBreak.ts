/**
 * Letter break — split each glyph into its strokes and pull them apart.
 *
 * The cuts are found from the glyph's own ink, not a fixed grid: a cut lands
 * where the ink density jumps — the edge of a stem where an arch leaves it, the
 * top of a bowl, a crossbar — so an "h" comes apart as stem | arch / leg, the
 * way a Carson headline looks after a scalpel. Cuts are applied recursively
 * (a guillotine split), each piece can slide along the cut that freed it,
 * cuts leave a white kerf, and a few pieces go missing.
 *
 * Pure: works on an alpha plane, so it's testable without a canvas.
 */

export type InkPlane = {
  width: number
  height: number
  /** Ink coverage 0–1, row-major. */
  alpha: Float32Array
}

export type BreakRect = { x0: number; y0: number; x1: number; y1: number }

export type BreakPiece = {
  rect: BreakRect
  /** Slide along the cuts that freed this piece, in plane px. */
  dx: number
  dy: number
  dropped: boolean
}

export type BreakCut = { axis: 'x' | 'y'; at: number; score: number }

export type LetterBreakParams = {
  /** 0–100: share of letters that break. */
  letters: number
  /** 1–4: how many times a letter is cut (up to 2^depth pieces). */
  depth: number
  /** 0–100: white kerf left by each cut. */
  gap: number
  /** 0–100: how far pieces slide along their cut. */
  shift: number
  /** 0–100: chance a piece goes missing. */
  drop: number
  /** 0 = only cuts across the line (vertical), 100 = only along it (horizontal). */
  axis: number
}

export const LETTER_BREAK_DEFAULTS: LetterBreakParams = {
  letters: 70,
  depth: 2,
  gap: 35,
  shift: 40,
  drop: 10,
  axis: 50,
}

export const MAX_BREAK_DEPTH = 4

export function letterBreakParamsFromRecord(params: Record<string, number>): LetterBreakParams {
  const read = (key: keyof LetterBreakParams) => {
    const value = params[key]
    return Number.isFinite(value) ? value : LETTER_BREAK_DEFAULTS[key]
  }
  return {
    letters: read('letters'),
    depth: Math.max(1, Math.min(MAX_BREAK_DEPTH, Math.round(read('depth')))),
    gap: read('gap'),
    shift: read('shift'),
    drop: read('drop'),
    axis: read('axis'),
  }
}

const INK = 0.08

/** Tight bounds of the ink inside `rect` (or the whole plane), null if blank. */
export function inkBounds(plane: InkPlane, rect?: BreakRect): BreakRect | null {
  const area = rect ?? { x0: 0, y0: 0, x1: plane.width, y1: plane.height }
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let y = area.y0; y < area.y1; y++) {
    for (let x = area.x0; x < area.x1; x++) {
      if (plane.alpha[y * plane.width + x] <= INK) continue
      if (x < x0) x0 = x
      if (y < y0) y0 = y
      if (x > x1) x1 = x
      if (y > y1) y1 = y
    }
  }
  if (x1 < x0) return null
  return { x0, y0, x1: x1 + 1, y1: y1 + 1 }
}

/** Mean ink per column (axis x) or per row (axis y) across `rect`. */
function profile(plane: InkPlane, rect: BreakRect, axis: 'x' | 'y'): Float32Array {
  const along = axis === 'x' ? rect.x1 - rect.x0 : rect.y1 - rect.y0
  const across = axis === 'x' ? rect.y1 - rect.y0 : rect.x1 - rect.x0
  const values = new Float32Array(Math.max(0, along))
  for (let y = rect.y0; y < rect.y1; y++) {
    for (let x = rect.x0; x < rect.x1; x++) {
      values[axis === 'x' ? x - rect.x0 : y - rect.y0] += plane.alpha[y * plane.width + x]
    }
  }
  for (let i = 0; i < values.length; i++) values[i] /= Math.max(1, across)
  return values
}

/**
 * The strongest stroke edge in `rect` along one axis: where the ink on one
 * side of a line differs most from the other, with ink left on both sides.
 */
function bestEdge(plane: InkPlane, rect: BreakRect, axis: 'x' | 'y', em: number, random: () => number): BreakCut | null {
  const values = profile(plane, rect, axis)
  const length = values.length
  const minSide = Math.max(2, Math.round(em * 0.09))
  if (length < minSide * 2 + 1) return null
  const window = Math.max(2, Math.round(em * 0.04))
  const prefix = new Float64Array(length + 1)
  for (let i = 0; i < length; i++) prefix[i + 1] = prefix[i] + values[i]
  const total = prefix[length]
  if (total <= 0) return null
  const mean = (from: number, to: number) => {
    const a = Math.max(0, from)
    const b = Math.min(length, to)
    return b > a ? (prefix[b] - prefix[a]) / (b - a) : 0
  }
  const candidates: { at: number; score: number }[] = []
  for (let i = minSide; i <= length - minSide; i++) {
    const before = prefix[i]
    const balance = Math.min(before, total - before) / total
    if (balance < 0.1) continue
    const edge = Math.abs(mean(i - window, i) - mean(i, i + window))
    candidates.push({ at: i, score: edge * Math.sqrt(balance) })
  }
  if (candidates.length === 0) return null
  const best = Math.max(...candidates.map((candidate) => candidate.score))
  // Any edge nearly as strong as the best is fair game, so a re-roll can cut elsewhere.
  const strong = candidates.filter((candidate) => candidate.score >= best * 0.85)
  const pick = strong[Math.floor(random() * strong.length) % strong.length]
  return { axis, at: (axis === 'x' ? rect.x0 : rect.y0) + pick.at, score: pick.score }
}

/** Choose the cut for `rect`, weighted by the axis preference. */
export function findCut(
  plane: InkPlane,
  rect: BreakRect,
  em: number,
  axisBias: number,
  random: () => number,
): BreakCut | null {
  const bias = Math.max(0, Math.min(100, axisBias)) / 100
  const options: BreakCut[] = []
  const vertical = bias < 1 ? bestEdge(plane, rect, 'x', em, random) : null
  const horizontal = bias > 0 ? bestEdge(plane, rect, 'y', em, random) : null
  if (vertical) options.push({ ...vertical, score: vertical.score * (1 - bias) * (0.75 + random() * 0.5) })
  if (horizontal) options.push({ ...horizontal, score: horizontal.score * bias * (0.75 + random() * 0.5) })
  const best = options.sort((a, b) => b.score - a.score)[0]
  return best && best.score > 0.02 ? best : null
}

type Side = { left: boolean; right: boolean; top: boolean; bottom: boolean }

/** Break one glyph. `em` is the font size in plane px. */
export function breakGlyph(plane: InkPlane, em: number, params: LetterBreakParams, random: () => number): BreakPiece[] {
  const ink = inkBounds(plane)
  if (!ink) return []
  const start: BreakRect = {
    x0: Math.max(0, ink.x0 - 1),
    y0: Math.max(0, ink.y0 - 1),
    x1: Math.min(plane.width, ink.x1 + 1),
    y1: Math.min(plane.height, ink.y1 + 1),
  }
  const depth = Math.max(1, Math.min(MAX_BREAK_DEPTH, Math.round(params.depth)))
  const kerf = (Math.max(0, params.gap) / 100) * 0.07 * em
  const slide = (Math.max(0, params.shift) / 100) * 0.3 * em
  const leaves: { rect: BreakRect; dx: number; dy: number; cut: Side }[] = []

  const split = (rect: BreakRect, level: number, dx: number, dy: number, cut: Side) => {
    const attempt = level < depth && (level === 0 || random() < 0.8)
    const found = attempt ? findCut(plane, rect, em, params.axis, random) : null
    if (!found) {
      leaves.push({ rect, dx, dy, cut })
      return
    }
    const moveFirst = random() < 0.5
    const amount = slide * (0.35 + random() * 0.65) * (random() < 0.5 ? -1 : 1)
    if (found.axis === 'x') {
      // A vertical cut frees pieces to slide up or down along it.
      const left = { ...rect, x1: found.at }
      const right = { ...rect, x0: found.at }
      split(left, level + 1, dx, dy + (moveFirst ? amount : 0), { ...cut, right: true })
      split(right, level + 1, dx, dy + (moveFirst ? 0 : amount), { ...cut, left: true })
    } else {
      const top = { ...rect, y1: found.at }
      const bottom = { ...rect, y0: found.at }
      split(top, level + 1, dx + (moveFirst ? amount : 0), dy, { ...cut, bottom: true })
      split(bottom, level + 1, dx + (moveFirst ? 0 : amount), dy, { ...cut, top: true })
    }
  }
  split(start, 0, 0, 0, { left: false, right: false, top: false, bottom: false })

  const half = kerf / 2
  const pieces = leaves.map((leaf) => {
    const rect = {
      x0: leaf.rect.x0 + (leaf.cut.left ? half : 0),
      y0: leaf.rect.y0 + (leaf.cut.top ? half : 0),
      x1: leaf.rect.x1 - (leaf.cut.right ? half : 0),
      y1: leaf.rect.y1 - (leaf.cut.bottom ? half : 0),
    }
    if (rect.x1 - rect.x0 < 1) rect.x1 = rect.x0 + 1
    if (rect.y1 - rect.y0 < 1) rect.y1 = rect.y0 + 1
    return { rect, dx: leaf.dx, dy: leaf.dy, dropped: false }
  })
  if (pieces.length > 1) {
    const chance = (Math.max(0, Math.min(100, params.drop)) / 100) * 0.6
    for (const piece of pieces) piece.dropped = random() < chance
    // A letter never vanishes completely.
    if (pieces.every((piece) => piece.dropped)) pieces[Math.floor(random() * pieces.length)].dropped = false
  }
  return pieces
}
