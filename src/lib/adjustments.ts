/**
 * Adjustment math (Levels, Hue/Saturation, Brightness/Contrast, Gradient map,
 * Threshold, Posterize, Invert) as pure per-pixel operations on RGBA buffers.
 *
 * Adjustment layers apply these to whatever is painted beneath them, so everything
 * here is a point operation: the result for a pixel depends only on that pixel.
 * That keeps tiled export exact and lets separable adjustments compile to
 * per-channel lookup tables.
 */

export type LevelsAdjustment = { type: 'levels'; black: number; white: number; gamma: number }
export type HueSatAdjustment = { type: 'hueSat'; hue: number; saturation: number; lightness: number }
export type BrightnessContrastAdjustment = { type: 'brightnessContrast'; brightness: number; contrast: number }
export type GradientMapAdjustment = { type: 'gradientMap'; shadow: string; highlight: string }
export type ThresholdAdjustment = { type: 'threshold'; level: number }
export type PosterizeAdjustment = { type: 'posterize'; levels: number }
export type InvertAdjustment = { type: 'invert' }

export type Adjustment =
  | LevelsAdjustment
  | HueSatAdjustment
  | BrightnessContrastAdjustment
  | GradientMapAdjustment
  | ThresholdAdjustment
  | PosterizeAdjustment
  | InvertAdjustment

export type AdjustmentType = Adjustment['type']

export const ADJUSTMENT_LABELS: Record<AdjustmentType, string> = {
  levels: 'Levels',
  hueSat: 'Hue/Saturation',
  brightnessContrast: 'Brightness/Contrast',
  gradientMap: 'Gradient map',
  threshold: 'Threshold',
  posterize: 'Posterize',
  invert: 'Invert',
}

export function defaultAdjustment(type: AdjustmentType): Adjustment {
  switch (type) {
    case 'levels':
      return { type, black: 20, white: 235, gamma: 1 }
    case 'hueSat':
      return { type, hue: 0, saturation: -40, lightness: 0 }
    case 'brightnessContrast':
      return { type, brightness: 0, contrast: 30 }
    case 'gradientMap':
      return { type, shadow: '#141414', highlight: '#e11d48' }
    case 'threshold':
      return { type, level: 128 }
    case 'posterize':
      return { type, levels: 4 }
    case 'invert':
      return { type }
  }
}

const clamp255 = (value: number) => (value < 0 ? 0 : value > 255 ? 255 : value)

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0').slice(0, 6)
  const value = Number.parseInt(full, 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/** Per-channel lookup table for separable adjustments, or null if not separable. */
export function adjustmentLut(adjustment: Adjustment): Uint8ClampedArray | null {
  const lut = new Uint8ClampedArray(256)
  switch (adjustment.type) {
    case 'levels': {
      const black = Math.min(254, Math.max(0, adjustment.black))
      const white = Math.max(black + 1, Math.min(255, adjustment.white))
      const gamma = Math.max(0.1, Math.min(9.99, adjustment.gamma))
      for (let i = 0; i < 256; i += 1) {
        const t = Math.min(1, Math.max(0, (i - black) / (white - black)))
        lut[i] = Math.round(255 * t ** (1 / gamma))
      }
      return lut
    }
    case 'brightnessContrast': {
      // Photoshop-like: contrast pivots on mid-grey, brightness shifts.
      const contrast = Math.max(-100, Math.min(100, adjustment.contrast)) / 100
      const factor = contrast >= 0 ? 1 / Math.max(0.01, 1 - contrast) : 1 + contrast
      const shift = (Math.max(-100, Math.min(100, adjustment.brightness)) / 100) * 128
      for (let i = 0; i < 256; i += 1) lut[i] = clamp255(Math.round((i - 128) * factor + 128 + shift))
      return lut
    }
    case 'posterize': {
      const levels = Math.max(2, Math.min(32, Math.round(adjustment.levels)))
      for (let i = 0; i < 256; i += 1) lut[i] = Math.round(Math.round((i / 255) * (levels - 1)) * (255 / (levels - 1)))
      return lut
    }
    case 'invert': {
      for (let i = 0; i < 256; i += 1) lut[i] = 255 - i
      return lut
    }
    default:
      return null
  }
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return [h / 6, s, l]
}

function hueToRgb(p: number, q: number, t: number) {
  let tt = t
  if (tt < 0) tt += 1
  if (tt > 1) tt -= 1
  if (tt < 1 / 6) return p + (q - p) * 6 * tt
  if (tt < 1 / 2) return q
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
  return p
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [
    Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, h) * 255),
    Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  ]
}

const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/**
 * Apply `adjustment` in place to an RGBA buffer, blended with the original by
 * `opacity` (0–1). Alpha is preserved: adjustments recolor, they never reveal.
 */
export function applyAdjustment(data: Uint8ClampedArray, adjustment: Adjustment, opacity = 1) {
  const mix = Math.max(0, Math.min(1, opacity))
  if (mix === 0) return
  const keep = 1 - mix
  const lut = adjustmentLut(adjustment)

  if (lut) {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue
      data[i] = keep * data[i] + mix * lut[data[i]]
      data[i + 1] = keep * data[i + 1] + mix * lut[data[i + 1]]
      data[i + 2] = keep * data[i + 2] + mix * lut[data[i + 2]]
    }
    return
  }

  if (adjustment.type === 'threshold') {
    const level = Math.max(0, Math.min(255, adjustment.level))
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue
      const v = luminance(data[i], data[i + 1], data[i + 2]) >= level ? 255 : 0
      data[i] = keep * data[i] + mix * v
      data[i + 1] = keep * data[i + 1] + mix * v
      data[i + 2] = keep * data[i + 2] + mix * v
    }
    return
  }

  if (adjustment.type === 'gradientMap') {
    const [sr, sg, sb] = hexToRgb(adjustment.shadow)
    const [hr, hg, hb] = hexToRgb(adjustment.highlight)
    const palette = new Uint8ClampedArray(256 * 3)
    for (let i = 0; i < 256; i += 1) {
      const t = i / 255
      palette[i * 3] = sr + (hr - sr) * t
      palette[i * 3 + 1] = sg + (hg - sg) * t
      palette[i * 3 + 2] = sb + (hb - sb) * t
    }
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue
      const p = Math.round(luminance(data[i], data[i + 1], data[i + 2])) * 3
      data[i] = keep * data[i] + mix * palette[p]
      data[i + 1] = keep * data[i + 1] + mix * palette[p + 1]
      data[i + 2] = keep * data[i + 2] + mix * palette[p + 2]
    }
    return
  }

  if (adjustment.type === 'hueSat') {
    const hueShift = (((adjustment.hue % 360) + 360) % 360) / 360
    const sat = Math.max(-100, Math.min(100, adjustment.saturation)) / 100
    const light = Math.max(-100, Math.min(100, adjustment.lightness)) / 100
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue
      const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2])
      const nh = (h + hueShift) % 1
      const ns = sat >= 0 ? s + (1 - s) * sat * s : s * (1 + sat)
      const nl = light >= 0 ? l + (1 - l) * light : l * (1 + light)
      const [r, g, b] = hslToRgb(nh, Math.min(1, Math.max(0, ns)), Math.min(1, Math.max(0, nl)))
      data[i] = keep * data[i] + mix * r
      data[i + 1] = keep * data[i + 1] + mix * g
      data[i + 2] = keep * data[i + 2] + mix * b
    }
  }
}
