/**
 * CMYK soft-proof helpers — approximate RGB preview of print gamut (Horizon 2.6).
 */

export function rgbToCmyk(r: number, g: number, b: number) {
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

/** Returns true when CMYK round-trip visibly shifts the color (out-of-gamut hint). */
export function isOutOfGamut(r: number, g: number, b: number, threshold = 18) {
  const cmyk = rgbToCmyk(r, g, b)
  const back = cmykToRgb(cmyk.c, cmyk.m, cmyk.y, cmyk.k)
  const delta = Math.abs(back.r - r) + Math.abs(back.g - g) + Math.abs(back.b - b)
  return delta > threshold
}

export function softProofHex(hex: string): string {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return hex
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  const cmyk = rgbToCmyk(r, g, b)
  const back = cmykToRgb(cmyk.c, cmyk.m, cmyk.y, cmyk.k)
  const toHex = (value: number) => value.toString(16).padStart(2, '0')
  return `#${toHex(back.r)}${toHex(back.g)}${toHex(back.b)}`
}
