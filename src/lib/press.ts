/**
 * The press — one run of the poster through one machine.
 *
 * Every ink effect samples this one sheet instead of rolling its own dice:
 * - ink: wet and dry trains laid along the feed across the whole poster, so a
 *   wet band that floods the headline also darkens the caption beside it
 * - paper: one sheet's tooth and fibres, the grain running with the feed,
 *   continuous under every layer
 * - registration: the plates slip once for the run, so every misprint and
 *   copier ghost on the poster shifts the same way
 * - drum: starvation bands across the feed, dirt streaks along it and toner
 *   dropouts sit at fixed places on the sheet, through every copied layer
 * - age: the sheet's own folds, the wear that gathers along them and at the
 *   edges, and the light it hung in — one side faded more than the other
 *
 * Coordinates are poster px. Values come from a hashed lattice, so any patch
 * of the sheet — a layer's raster, a worker, an export at 4× — samples the
 * same paper and ink as every other patch. Pure and seeded.
 */
import { newSeed } from './random'

/** What a poster stores: which run it was, and which way the sheet travelled. */
export type PressRun = {
  seed: number
  /** Feed direction in degrees: ink trains, paper grain and slur run along it. */
  feedAngle: number
}

/** A run bound to its sheet size. */
export type Press = PressRun & {
  width: number
  height: number
}

/**
 * Where one raster lies on the sheet: raster pixel (x, y) covers poster
 * point (originX + (x + 0.5) · unit, originY + (y + 0.5) · unit).
 */
export type SheetPatch = {
  press: Press
  originX: number
  originY: number
  /** Poster px per raster px. */
  unit: number
}

export const DEFAULT_FEED_ANGLE = 0

/** Salts keep each field of the sheet independent of the others. */
export const SHEET_SALT = {
  ink: 1,
  lumps: 2,
  fibres: 3,
  chunks: 4,
  tooth: 5,
  grain: 6,
  slur: 7,
  dashes: 8,
  registration: 9,
  paper: 10,
  bands: 11,
  streaks: 12,
  voids: 13,
  mottle: 14,
  folds: 15,
  wear: 16,
  exposure: 17,
  chips: 18,
} as const

export function newPressRun(seed = newSeed(), feedAngle = DEFAULT_FEED_ANGLE): PressRun {
  return { seed: seed >>> 0, feedAngle: normalizeFeedAngle(feedAngle) }
}

export function normalizeFeedAngle(angle: number): number {
  if (!Number.isFinite(angle)) return DEFAULT_FEED_ANGLE
  return ((Math.round(angle) % 360) + 360) % 360
}

export function bindPress(run: PressRun, sheet: { width: number; height: number }): Press {
  return {
    seed: run.seed >>> 0,
    feedAngle: normalizeFeedAngle(run.feedAngle),
    width: Math.max(1, sheet.width),
    height: Math.max(1, sheet.height),
  }
}

/** Plain-data check for a stored run (documents are JSON). */
export function readPressRun(value: unknown): PressRun | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.seed !== 'number' || !Number.isFinite(record.seed)) return null
  const feed = typeof record.feedAngle === 'number' ? record.feedAngle : DEFAULT_FEED_ANGLE
  return newPressRun(record.seed, feed)
}

/** Lattice value in -1..1 for cell (i, j) of one field of one run. */
export function sheetHash(seed: number, salt: number, i: number, j: number): number {
  let h = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0
  h = Math.imul(h ^ Math.imul(i | 0, 0x85ebca6b), 0xc2b2ae35)
  h ^= Math.imul(j | 0, 0x27d4eb2f)
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
  h ^= h >>> 15
  return ((h >>> 0) / 4294967296) * 2 - 1
}

function feedBasis(press: Press) {
  const angle = (press.feedAngle * Math.PI) / 180
  return { c: Math.cos(angle), s: Math.sin(angle) }
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}

/** Smooth value noise at one poster point, cells measured along and across the feed. */
export function sheetValueAt(
  press: Press,
  salt: number,
  x: number,
  y: number,
  cellAlong: number,
  cellAcross: number,
): number {
  const { c, s } = feedBasis(press)
  const gu = (x * c + y * s) / Math.max(1e-6, cellAlong)
  const gv = (-x * s + y * c) / Math.max(1e-6, cellAcross)
  const i = Math.floor(gu)
  const j = Math.floor(gv)
  const fu = smooth(gu - i)
  const fv = smooth(gv - j)
  const a = sheetHash(press.seed, salt, i, j)
  const b = sheetHash(press.seed, salt, i + 1, j)
  const d = sheetHash(press.seed, salt, i, j + 1)
  const e = sheetHash(press.seed, salt, i + 1, j + 1)
  const top = a + (b - a) * fu
  const bottom = d + (e - d) * fu
  return top + (bottom - top) * fv
}

/**
 * One octave of value noise over a raster's patch of the sheet. The lattice
 * for just that patch is hashed once, then each pixel interpolates it — as
 * cheap as local noise, and seamless with every neighbouring patch.
 */
export function sheetNoise(
  patch: SheetPatch,
  width: number,
  height: number,
  cellAlong: number,
  cellAcross: number,
  salt: number,
): Float32Array {
  const { press, originX, originY, unit } = patch
  // Noise finer than a raster pixel can't be shown; it would only alias.
  const ca = Math.max(cellAlong, unit, 1e-3)
  const cc = Math.max(cellAcross, unit, 1e-3)
  const { c, s } = feedBasis(press)
  // Lattice coordinates of raster pixel (x, y): g = g0 + x · gx + y · gy.
  const px0 = originX + 0.5 * unit
  const py0 = originY + 0.5 * unit
  const gu0 = (px0 * c + py0 * s) / ca
  const gv0 = (-px0 * s + py0 * c) / cc
  const guX = (unit * c) / ca
  const guY = (unit * s) / ca
  const gvX = (-unit * s) / cc
  const gvY = (unit * c) / cc
  let minU = Infinity
  let maxU = -Infinity
  let minV = Infinity
  let maxV = -Infinity
  for (const [x, y] of [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ]) {
    const u = gu0 + x * guX + y * guY
    const v = gv0 + x * gvX + y * gvY
    minU = Math.min(minU, u)
    maxU = Math.max(maxU, u)
    minV = Math.min(minV, v)
    maxV = Math.max(maxV, v)
  }
  const i0 = Math.floor(minU)
  const j0 = Math.floor(minV)
  const cols = Math.floor(maxU) - i0 + 2
  const rows = Math.floor(maxV) - j0 + 2
  const lattice = new Float32Array(cols * rows)
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) lattice[j * cols + i] = sheetHash(press.seed, salt, i0 + i, j0 + j)
  }
  const plane = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    let u = gu0 + y * guY - i0
    let v = gv0 + y * gvY - j0
    const out = y * width
    for (let x = 0; x < width; x++) {
      const i = Math.min(cols - 2, Math.max(0, Math.floor(u)))
      const j = Math.min(rows - 2, Math.max(0, Math.floor(v)))
      const fu = smooth(Math.min(1, Math.max(0, u - i)))
      const fv = smooth(Math.min(1, Math.max(0, v - j)))
      const k = j * cols + i
      const top = lattice[k] + (lattice[k + 1] - lattice[k]) * fu
      const bottom = lattice[k + cols] + (lattice[k + cols + 1] - lattice[k + cols]) * fu
      plane[out + x] = top + (bottom - top) * fv
      u += guX
      v += gvX
    }
  }
  return plane
}

/** Octaves of sheet noise, each half the size and half the weight, normalised to about -1..1. */
export function sheetFractal(
  patch: SheetPatch,
  width: number,
  height: number,
  cellAlong: number,
  cellAcross: number,
  octaves: number,
  salt: number,
): Float32Array {
  const out = new Float32Array(width * height)
  let weight = 1
  let total = 0
  for (let octave = 0; octave < octaves; octave++) {
    const scale = 2 ** octave
    const layer = sheetNoise(patch, width, height, cellAlong / scale, cellAcross / scale, salt * 16 + octave)
    for (let i = 0; i < out.length; i++) out[i] += layer[i] * weight
    total += weight
    weight *= 0.5
  }
  // Value noise rarely reaches its extremes; stretch it back toward -1..1.
  const gain = 1.6 / total
  for (let i = 0; i < out.length; i++) out[i] = Math.max(-1, Math.min(1, out[i] * gain))
  return out
}

/** Independent value per paper grain (no smoothing), in -1..1: the tooth a single fibre leaves. */
export function sheetGrain(patch: SheetPatch, width: number, height: number, cell: number, salt: number): Float32Array {
  const { press, originX, originY, unit } = patch
  const size = Math.max(cell, 1e-3)
  const plane = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    const j = Math.floor((originY + (y + 0.5) * unit) / size)
    for (let x = 0; x < width; x++) {
      const i = Math.floor((originX + (x + 0.5) * unit) / size)
      plane[y * width + x] = sheetHash(press.seed, salt, i, j)
    }
  }
  return plane
}

/** A value in 0..1 for one line across the feed — a burr on the roller marks the same line everywhere. */
export function sheetLine(press: Press, salt: number, line: number): number {
  return (sheetHash(press.seed, salt, line, 0x51ed) + 1) / 2
}

/**
 * Size of the ink trains on this sheet: long along the feed, short across it,
 * set by the sheet rather than by any one layer — a roller doesn't know
 * what's printed on it.
 */
export function pressInkTrains(press: Pick<Press, 'width' | 'height'>): { along: number; across: number } {
  const short = Math.min(press.width, press.height)
  return { along: short * 0.2, across: short * 0.06 }
}

const INK_OCTAVES = 3

/** Raw ink train at a poster point, -1 (driest) … +1 (wettest), before any bleed or starve setting. */
export function pressInkAt(press: Press, x: number, y: number): number {
  const { along, across } = pressInkTrains(press)
  let sum = 0
  let weight = 1
  let total = 0
  for (let octave = 0; octave < INK_OCTAVES; octave++) {
    const scale = 2 ** octave
    sum += sheetValueAt(press, SHEET_SALT.ink * 16 + octave, x, y, along / scale, across / scale) * weight
    total += weight
    weight *= 0.5
  }
  return Math.max(-1, Math.min(1, (sum * 1.6) / total))
}

/** Raw ink trains over a raster's patch — the same field pressInkAt samples point by point. */
export function pressInkPlane(patch: SheetPatch, width: number, height: number): Float32Array {
  const { along, across } = pressInkTrains(patch.press)
  return sheetFractal(patch, width, height, along, across, INK_OCTAVES, SHEET_SALT.ink)
}

/**
 * How solid a flat (vector) fill prints at a point: 1 in a wet train, down to
 * about 0.56 where the roller ran dry.
 */
export function pressInkDensityAt(press: Press, x: number, y: number): number {
  return 0.78 + 0.22 * pressInkAt(press, x, y)
}

/**
 * The plate slip for the whole run, as a unit vector. Plates slip mostly
 * along the feed, a little off it, the same way for every layer.
 */
export function pressRegistration(press: Press): { dx: number; dy: number } {
  const deviation = sheetHash(press.seed, SHEET_SALT.registration, 0, 0) * 28
  // Which way along the feed the plate lags is part of the run, too.
  const back = sheetHash(press.seed, SHEET_SALT.registration, 1, 0) < -0.4 ? 180 : 0
  const angle = ((press.feedAngle + deviation + back - 24) * Math.PI) / 180
  return { dx: Math.cos(angle), dy: Math.sin(angle) }
}

/** The press a canvas is printing on, set by the editor whenever the poster changes. */
const canvasPresses = new WeakMap<object, Press>()

export function bindCanvasPress(canvas: object, press: Press | null) {
  if (press) canvasPresses.set(canvas, press)
  else canvasPresses.delete(canvas)
}

export function canvasPress(canvas: object): Press | null {
  return canvasPresses.get(canvas) ?? null
}

/** Stable text for cache keys: two bakes on the same press and spot match. */
export function pressSignature(press: Press | null): string {
  if (!press) return ''
  return `${press.seed}/${press.feedAngle}/${Math.round(press.width)}x${Math.round(press.height)}`
}

/** Hash in 0..1 for the k-th draw of one field — a fixed list of candidates per run. */
function sheetDraw(press: Press, salt: number, k: number, d: number): number {
  return (sheetHash(press.seed, salt, k, d) + 1) / 2
}

/** Along-feed (u) and across-feed (v) coordinates of a poster point. */
export function sheetFeedCoords(press: Press, x: number, y: number): { u: number; v: number } {
  const { c, s } = feedBasis(press)
  return { u: x * c + y * s, v: -x * s + y * c }
}

/** Unit steps of u and v per poster px in x and in y. */
export function sheetFeedBasis(press: Press): { ux: number; uy: number; vx: number; vy: number } {
  const { c, s } = feedBasis(press)
  return { ux: c, uy: s, vx: -s, vy: c }
}

/** Range of u and v the sheet covers. */
export function sheetFeedExtent(press: Press): { uMin: number; uMax: number; vMin: number; vMax: number } {
  let uMin = Infinity
  let uMax = -Infinity
  let vMin = Infinity
  let vMax = -Infinity
  for (const [x, y] of [
    [0, 0],
    [press.width, 0],
    [0, press.height],
    [press.width, press.height],
  ]) {
    const { u, v } = sheetFeedCoords(press, x, y)
    uMin = Math.min(uMin, u)
    uMax = Math.max(uMax, u)
    vMin = Math.min(vMin, v)
    vMax = Math.max(vMax, v)
  }
  return { uMin, uMax, vMin, vMax }
}

export type DrumBand = {
  /** Centre along the feed (u, poster px). */
  center: number
  half: number
  /** 0..1 before the Bands setting scales it. */
  depth: number
}

/**
 * Toner starvation bands for the whole run, in the order they appear as the
 * setting rises: a band is a stripe across the feed, wherever it falls on
 * the sheet, so it runs through every layer copied there.
 */
export function pressBands(press: Press, count: number): DrumBand[] {
  const { uMin, uMax } = sheetFeedExtent(press)
  const length = uMax - uMin
  return Array.from({ length: Math.max(0, Math.min(32, Math.round(count))) }, (_, k) => ({
    center: uMin + sheetDraw(press, SHEET_SALT.bands, k, 0) * length,
    half: Math.max(2, (0.004 + sheetDraw(press, SHEET_SALT.bands, k, 1) * 0.025) * length),
    depth: 0.2 + sheetDraw(press, SHEET_SALT.bands, k, 2) * 0.5,
  }))
}

export type DrumStreak = {
  /** Position across the feed (v, poster px). */
  position: number
  half: number
  /** Dirt prints a dark line; a scratched drum drops one out. */
  dark: boolean
  strength: number
  /** Which flicker field breaks this streak up along its length. */
  salt: number
}

/** Drum dirt and scratches for the run: lines along the feed at fixed places across it. */
export function pressStreaks(press: Press, count: number): DrumStreak[] {
  const { vMin, vMax } = sheetFeedExtent(press)
  const width = vMax - vMin
  return Array.from({ length: Math.max(0, Math.min(32, Math.round(count))) }, (_, k) => ({
    position: vMin + sheetDraw(press, SHEET_SALT.streaks, k, 0) * width,
    half: 0.35 + sheetDraw(press, SHEET_SALT.streaks, k, 1) * 1.1,
    dark: sheetDraw(press, SHEET_SALT.streaks, k, 2) < 0.62,
    strength: 0.45 + sheetDraw(press, SHEET_SALT.streaks, k, 3) * 0.5,
    salt: SHEET_SALT.streaks * 64 + k,
  }))
}

export type DrumVoid = { x: number; y: number; radius: number; lobes: [number, number, number] }

/** Toner dropouts for the run: soft blobs at fixed places on the sheet. Radius before the Voids setting. */
export function pressVoids(press: Press, count: number): DrumVoid[] {
  const short = Math.min(press.width, press.height)
  return Array.from({ length: Math.max(0, Math.min(64, Math.round(count))) }, (_, k) => ({
    x: sheetDraw(press, SHEET_SALT.voids, k, 0) * press.width,
    y: sheetDraw(press, SHEET_SALT.voids, k, 1) * press.height,
    radius: Math.max(3, (0.02 + sheetDraw(press, SHEET_SALT.voids, k, 2) * 0.1) * short * 0.35),
    lobes: [
      sheetDraw(press, SHEET_SALT.voids, k, 3) * Math.PI * 2,
      sheetDraw(press, SHEET_SALT.voids, k, 4) * Math.PI * 2,
      sheetDraw(press, SHEET_SALT.voids, k, 5) * Math.PI * 2,
    ],
  }))
}

export type SheetFold = {
  /** 'x': a vertical crease at x = position; 'y': a horizontal one at y = position. */
  axis: 'x' | 'y'
  position: number
  /** Degrees off true: a hand fold is never quite square. */
  angle: number
}

/**
 * How the sheet was folded: in half across, and in half or in thirds down —
 * the folds of a poster mailed, pinned up, taken down. Fixed per run.
 */
export function pressFolds(press: Press): SheetFold[] {
  const draw = (k: number) => sheetDraw(press, SHEET_SALT.folds, k, 0)
  const folds: SheetFold[] = []
  if (draw(0) < 0.85) {
    folds.push({ axis: 'x', position: press.width * (0.5 + (draw(1) - 0.5) * 0.06), angle: (draw(2) - 0.5) * 2.4 })
  }
  const thirds = draw(3) < 0.45
  const marks = thirds ? [1 / 3, 2 / 3] : [0.5]
  marks.forEach((mark, index) => {
    folds.push({
      axis: 'y',
      position: press.height * (mark + (draw(4 + index) - 0.5) * 0.04),
      angle: (draw(6 + index) - 0.5) * 2.4,
    })
  })
  return folds
}

function smoothRange(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(1e-6, edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Distance in poster px from a point to the nearest fold line. */
export function distanceToFold(press: Press, x: number, y: number, folds = pressFolds(press)): number {
  let best = Infinity
  for (const fold of folds) {
    const tilt = Math.tan((fold.angle * Math.PI) / 180)
    const distance =
      fold.axis === 'x'
        ? Math.abs(x - (fold.position + (y - press.height / 2) * tilt))
        : Math.abs(y - (fold.position + (x - press.width / 2) * tilt))
    best = Math.min(best, distance)
  }
  return best
}

/**
 * How worn the sheet is at a point, 0..1: scuffs everywhere, more at the
 * edges and corners that got handled, most along the folds where the ink
 * cracks.
 */
export function pressWearAt(press: Press, x: number, y: number, folds = pressFolds(press)): number {
  const short = Math.min(press.width, press.height)
  const scuff = (sheetValueAt(press, SHEET_SALT.wear, x, y, short * 0.07, short * 0.07) + 1) / 2
  const edge = Math.min(x, y, press.width - x, press.height - y)
  const edgeWear = 1 - smoothRange(0, short * 0.05, edge)
  const foldWear = 1 - smoothRange(0, short * 0.025, distanceToFold(press, x, y, folds))
  return Math.min(1, scuff * 0.45 + edgeWear * 0.45 + foldWear * 0.6)
}

/**
 * How much light the sheet took at a point, 0..1: it hung with one edge to
 * the window, so that side faded most, in blotches where it curled.
 */
export function pressExposureAt(press: Press, x: number, y: number): number {
  const side = Math.floor(sheetDraw(press, SHEET_SALT.exposure, 0, 0) * 4)
  const toward =
    side === 0 ? 1 - x / press.width : side === 1 ? x / press.width : side === 2 ? 1 - y / press.height : y / press.height
  const short = Math.min(press.width, press.height)
  const blotch = (sheetValueAt(press, SHEET_SALT.exposure, x, y, short * 0.35, short * 0.35) + 1) / 2
  return Math.max(0, Math.min(1, 0.2 + toward * 0.55 + blotch * 0.25))
}

export type WearChip = { x: number; y: number; width: number; height: number; angle: number }

/**
 * Ink-loss chips inside a box on the sheet. Sites sit on one lattice across
 * the whole sheet and are ranked by how worn the sheet is there, so chips line
 * the folds and edges and two overlapping layers share the same ones. Every
 * box gets at least its few most worn sites, and no more than its size allows.
 */
export function pressWearChips(
  press: Press,
  box: { left: number; top: number; width: number; height: number },
  decay: number,
): WearChip[] {
  const short = Math.min(press.width, press.height)
  const cell = short * 0.03
  const folds = pressFolds(press)
  const progress = Math.max(0, Math.min(1, decay))
  const sites: { chip: WearChip; score: number }[] = []
  const i0 = Math.floor(box.left / cell)
  const i1 = Math.floor((box.left + box.width) / cell)
  const j0 = Math.floor(box.top / cell)
  const j1 = Math.floor((box.top + box.height) / cell)
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const x = (i + (sheetHash(press.seed, SHEET_SALT.chips, i, j) + 1) / 2) * cell
      const y = (j + (sheetHash(press.seed, SHEET_SALT.chips + 1, i, j) + 1) / 2) * cell
      if (x < box.left || x > box.left + box.width || y < box.top || y > box.top + box.height) continue
      const luck = (sheetHash(press.seed, SHEET_SALT.chips + 2, i, j) + 1) / 2
      const size = (sheetHash(press.seed, SHEET_SALT.chips + 3, i, j) + 1) / 2
      sites.push({
        score: pressWearAt(press, x, y, folds) * 0.8 + luck * 0.45,
        chip: {
          x,
          y,
          width: short * (0.012 + size * 0.04),
          height: short * (0.003 + size * 0.01),
          angle: sheetHash(press.seed, SHEET_SALT.chips + 4, i, j) * 9,
        },
      })
    }
  }
  sites.sort((a, b) => b.score - a.score)
  const share = Math.sqrt((box.width * box.height) / Math.max(1, press.width * press.height * 0.15))
  const cap = Math.round((4 + progress * 10) * Math.max(0.6, Math.min(2, share)))
  const floor = Math.min(cap, 2 + Math.round(progress * 3))
  const threshold = 1.02 - progress * 0.5
  const worn = sites.filter((site) => site.score >= threshold).length
  return sites.slice(0, Math.min(cap, Math.max(floor, worn))).map((site) => site.chip)
}

/** Smooth 1-D noise along one line of the sheet, -1..1 — how a streak flickers along its length. */
export function sheetLineNoise(press: Press, salt: number, t: number, cell: number): number {
  const g = t / Math.max(1e-6, cell)
  const k = Math.floor(g)
  const f = smooth(g - k)
  const a = sheetHash(press.seed, salt, k, 0x1d)
  const b = sheetHash(press.seed, salt, k + 1, 0x1d)
  return a + (b - a) * f
}
