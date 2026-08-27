/**
 * CMYK soft-proof helpers — approximate RGB preview of print gamut (Horizon 2.6).
 * Naive RGB↔CMYK is lossless; press proof uses impure process inks so gamut shift is visible.
 */
import { parseHex } from './color'

const CYAN_INK = { r: 0, g: 163, b: 224 }
const MAGENTA_INK = { r: 216, g: 17, b: 118 }
const YELLOW_INK = { r: 255, g: 236, b: 0 }
const BLACK_INK = { r: 0, g: 0, b: 0 }

export type Cmyk = { c: number; m: number; y: number; k: number }

export type GamutReadout = {
  hex: string
  cmyk: Cmyk
  proof: string
  outOfGamut: boolean
  delta: number
}

export function rgbToCmyk(r: number, g: number, b: number): Cmyk {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const k = 1 - Math.max(rn, gn, bn)
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 }
  const c = ((1 - rn - k) / (1 - k)) * 100
  const m = ((1 - gn - k) / (1 - k)) * 100
  const y = ((1 - bn - k) / (1 - k)) * 100
  return { c, m, y, k: k * 100 }
}

export function cmykToRgb(c: number, m: number, y: number, k: number) {
  const cn = c / 100
  const mn = m / 100
  const yn = y / 100
  const kn = k / 100
  return {
    r: Math.round(255 * (1 - cn) * (1 - kn)),
    g: Math.round(255 * (1 - mn) * (1 - kn)),
    b: Math.round(255 * (1 - yn) * (1 - kn)),
  }
}

function mixInk(channel: number, ink: number, amount: number) {
  return channel * (1 - amount * (1 - ink / 255))
}

/** Reconstruct RGB with impure process inks so saturated screen colors shift. */
export function cmykToRgbPress(c: number, m: number, y: number, k: number) {
  const cyan = c / 100
  const magenta = m / 100
  const yellow = y / 100
  const black = k / 100
  let r = 255
  let g = 255
  let b = 255
  r = mixInk(r, CYAN_INK.r, cyan)
  g = mixInk(g, CYAN_INK.g, cyan)
  b = mixInk(b, CYAN_INK.b, cyan)
  r = mixInk(r, MAGENTA_INK.r, magenta)
  g = mixInk(g, MAGENTA_INK.g, magenta)
  b = mixInk(b, MAGENTA_INK.b, magenta)
  r = mixInk(r, YELLOW_INK.r, yellow)
  g = mixInk(g, YELLOW_INK.g, yellow)
  b = mixInk(b, YELLOW_INK.b, yellow)
  r = mixInk(r, BLACK_INK.r, black)
  g = mixInk(g, BLACK_INK.g, black)
  b = mixInk(b, BLACK_INK.b, black)
  return {
    r: Math.round(r),
    g: Math.round(g),
    b: Math.round(b),
  }
}

export function gamutDelta(r: number, g: number, b: number) {
  const cmyk = rgbToCmyk(r, g, b)
  const back = cmykToRgbPress(cmyk.c, cmyk.m, cmyk.y, cmyk.k)
  return Math.abs(back.r - r) + Math.abs(back.g - g) + Math.abs(back.b - b)
}

/** Returns true when a press-ink round-trip visibly shifts the color. */
export function isOutOfGamut(r: number, g: number, b: number, threshold = 18) {
  return gamutDelta(r, g, b) > threshold
}

function toHex(value: number) {
  return Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0')
}

export function rgbToHex(r: number, g: number, b: number) {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function softProofHex(hex: string): string {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b)
  const back = cmykToRgbPress(cmyk.c, cmyk.m, cmyk.y, cmyk.k)
  return rgbToHex(back.r, back.g, back.b)
}

export function formatCmyk(cmyk: Cmyk) {
  const n = (value: number) => Math.round(value)
  return `C${n(cmyk.c)} M${n(cmyk.m)} Y${n(cmyk.y)} K${n(cmyk.k)}`
}

export function gamutReadout(hex: string): GamutReadout | null {
  const rgb = parseHex(hex)
  if (!rgb) return null
  const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b)
  const proof = softProofHex(hex)
  const delta = gamutDelta(rgb.r, rgb.g, rgb.b)
  return {
    hex,
    cmyk,
    proof,
    outOfGamut: delta > 18,
    delta,
  }
}
