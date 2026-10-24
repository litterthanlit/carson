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
