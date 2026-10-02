/**
 * Print-process pixel filters: halftone dots, risograph, duotone, ordered dither, RGB split and
 * scan lines. Each has a Canvas2D path and a WebGL fragment shader that compute the same thing,
 * like the directional blurs in `pixelFilters.ts`.
 *
 * Conventions shared by both paths:
 * - Pixel `(x, y)` has its center at integer coordinates; sampling rounds to the nearest texel.
 * - Ink is composed over white and then un-composited (`overWhite`), so ink that lands on a
 *   transparent area is ink-coloured and opaque only where it covers, never a paper box.
 * - Grain and jitter come from a coordinate hash, never `Math.random()`, so preview, apply and a
 *   re-render after reload agree. Grain cells are relative to the layer, so a 640 px preview and
 *   the full-size result show the same pattern.
 * - Repeating patterns (dots, dither cells, scan lines) fade to their average tone once they get
 *   smaller than a couple of pixels, as a downsampled view of the full-size result would.
 */
import { classRegistry, filters } from 'fabric'

type ImageBuffer = {
  data: Uint8ClampedArray
  width: number
  height: number
}

type WebGLUniformMap = Record<string, WebGLUniformLocation | null>

type Rgb = readonly [number, number, number]

export type InkPair = { name: string; shadow: string; accent: string }
export type DuotonePalette = { name: string; shadow: string; highlight: string }

/** Riso drum pairs. The shadow ink carries darks; the accent ink is broader and runs off register. */
export const RISO_INKS: readonly InkPair[] = [
  { name: 'Fluoro Pink + Blue', shadow: '#0078bf', accent: '#ff48b0' },
  { name: 'Black + Red', shadow: '#000000', accent: '#f15060' },
  { name: 'Teal + Orange', shadow: '#00838a', accent: '#ff6c2f' },
  { name: 'Black + Yellow', shadow: '#000000', accent: '#ffe800' },
  { name: 'Purple + Fluoro Orange', shadow: '#765ba7', accent: '#ff7477' },
]

export const DUOTONE_PALETTES: readonly DuotonePalette[] = [
  { name: 'Black / Paper', shadow: '#141414', highlight: '#f1ead9' },
  { name: 'Navy / Cream', shadow: '#1c2541', highlight: '#f4e9cd' },
  { name: 'Red / Paper', shadow: '#b3141c', highlight: '#f1ead9' },
  { name: 'Blue / Pink', shadow: '#0b3c8c', highlight: '#ffb3d6' },
  { name: 'Green / Lemon', shadow: '#10463a', highlight: '#f2e86d' },
]

/** Grain cells across the layer's long side, whatever the raster size. */
const GRAIN_CELLS = 520
/** Riso misregistration direction (unit vector, down and to the right). */
const RISO_SHIFT: Rgb = [0.8, 0.6, 0]

export function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.replace('#', ''), 16)
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]
}

function paletteIndex(value: number, length: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(length - 1, Math.max(0, Math.round(value)))
}

export function risoInks(index: number): InkPair {
  return RISO_INKS[paletteIndex(index, RISO_INKS.length)]!
}

export function duotonePalette(index: number): DuotonePalette {
  return DUOTONE_PALETTES[paletteIndex(index, DUOTONE_PALETTES.length)]!
}

// --- Shared CPU helpers (mirrors of the GLSL prelude below) ---

function fract(value: number) {
  return value - Math.floor(value)
}

function clamp01(value: number) {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp01((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** Hash without sine (Dave Hoskins), [0, 1). */
export function hash12(x: number, y: number) {
  let px = fract(x * 0.1031)
  let py = fract(y * 0.1031)
  let pz = px
  const dot = px * (py + 33.33) + py * (pz + 33.33) + pz * (px + 33.33)
  px += dot
  py += dot
  pz += dot
  return fract((px + py) * pz)
}

function valueNoise(x: number, y: number) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  let fx = x - ix
  let fy = y - iy
  fx = fx * fx * (3 - 2 * fx)
  fy = fy * fy * (3 - 2 * fy)
  const a = hash12(ix, iy)
  const b = hash12(ix + 1, iy)
  const c = hash12(ix, iy + 1)
  const d = hash12(ix + 1, iy + 1)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

/** 0 while a pattern is at least `hi` px, 1 once it is `lo` px or smaller. */
function patternFade(sizePx: number, lo: number, hi: number) {
  return clamp01((hi - sizePx) / (hi - lo))
}

/** Index of the 8×8 Bayer matrix, 0–63. */
export function bayer8(x: number, y: number) {
  let value = 0
  for (let bit = 0; bit < 3; bit += 1) {
    const xb = (x >> bit) & 1
    const yb = (y >> bit) & 1
    value += (2 * (xb ^ yb) + yb) << (2 * (2 - bit))
  }
  return value
}

/** Straight-alpha RGBA in 0–1, nearest texel; `clear` returns transparent outside the image. */
function texel(image: ImageBuffer, x: number, y: number, clear = false): [number, number, number, number] {
  const index = texelIndex(image, x, y, clear)
  if (index < 0) return [0, 0, 0, 0]
  const { data } = image
  return [(data[index] ?? 0) / 255, (data[index + 1] ?? 0) / 255, (data[index + 2] ?? 0) / 255, (data[index + 3] ?? 0) / 255]
}

/** Byte index of the nearest texel; -1 outside the image when `clear`, else clamped to the edge. */
function texelIndex(image: ImageBuffer, x: number, y: number, clear = false) {
  let cx = Math.floor(x + 0.5)
  let cy = Math.floor(y + 0.5)
  if (cx < 0 || cy < 0 || cx >= image.width || cy >= image.height) {
    if (clear) return -1
    cx = Math.min(image.width - 1, Math.max(0, cx))
    cy = Math.min(image.height - 1, Math.max(0, cy))
  }
  return (cy * image.width + cx) * 4
}

function luma(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** `darkness()` read straight from the buffer, without allocating (hot loops). */
function darknessAt(data: Uint8ClampedArray, index: number) {
  if (index < 0) return 0
  return (1 - luma((data[index] ?? 0) / 255, (data[index + 1] ?? 0) / 255, (data[index + 2] ?? 0) / 255)) * ((data[index + 3] ?? 0) / 255)
}

/** Ink needed to print this pixel over white paper: 0 for white or transparent, 1 for solid black. */
function darkness(pixel: readonly number[]) {
  return (1 - luma(pixel[0]!, pixel[1]!, pixel[2]!)) * pixel[3]!
}

/** Write the colour that, at alpha `a` over white, looks like `w`. */
function writeOverWhite(dest: Uint8ClampedArray, index: number, wr: number, wg: number, wb: number, a: number) {
  if (a <= 0) {
    dest[index] = 0
    dest[index + 1] = 0
    dest[index + 2] = 0
    dest[index + 3] = 0
    return
  }
  dest[index] = clamp01((wr - (1 - a)) / a) * 255
  dest[index + 1] = clamp01((wg - (1 - a)) / a) * 255
  dest[index + 2] = clamp01((wb - (1 - a)) / a) * 255
  dest[index + 3] = a * 255
}

function toneContrast(value: number, contrast: number) {
  return clamp01((value - 0.5) * (1 + (contrast / 100) * 3) + 0.5)
}

/** Dot radius in cells for a tone. Exact area up to mid-tones, then grows to close the corners at 100%. */
function dotRadius(tone: number) {
  return Math.sqrt(tone / Math.PI) * (1 + 0.42 * tone * tone)
}

/** White paper under a layer's solid areas only, so anti-aliased edges never get a pale rim. */
function paperAlpha(alpha: number) {
  return smoothstep(0.75, 1, alpha)
}

// --- CPU paths ---

export function halftoneDotsImageData(image: ImageBuffer, cell: number, angle: number, contrast: number) {
  const { width, height } = image
  const source = { data: image.data.slice(), width, height }
  const size = Math.max(0.25, cell)
  const rad = (angle * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const fade = patternFade(size, 1.5, 3)
  const quarter = size / 4

  // Screen-space cell bounds of the image, so each cell's tone is sampled once.
  const corners = [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ]
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of corners) {
    const qx = (x! * cos + y! * sin) / size
    const qy = (-x! * sin + y! * cos) / size
    minX = Math.min(minX, qx)
    maxX = Math.max(maxX, qx)
    minY = Math.min(minY, qy)
    maxY = Math.max(maxY, qy)
  }
  const originX = Math.floor(minX) - 2
  const originY = Math.floor(minY) - 2
  const cols = Math.ceil(maxX) - originX + 3
  const rows = Math.ceil(maxY) - originY + 3
  const tones = new Float32Array(cols * rows).fill(-1)

  const cellTone = (cx: number, cy: number) => {
    const slot = (cy - originY) * cols + (cx - originX)
    const cached = tones[slot]
    if (cached !== undefined && cached >= 0) return cached
    const qx = (cx + 0.5) * size
    const qy = (cy + 0.5) * size
    const px = qx * cos - qy * sin
    const py = qx * sin + qy * cos
    const src = source.data
    let sum = darknessAt(src, texelIndex(source, px, py))
    sum += darknessAt(src, texelIndex(source, px + quarter * cos, py + quarter * sin))
    sum += darknessAt(src, texelIndex(source, px - quarter * cos, py - quarter * sin))
    sum += darknessAt(src, texelIndex(source, px - quarter * sin, py + quarter * cos))
    sum += darknessAt(src, texelIndex(source, px + quarter * sin, py - quarter * cos))
    const tone = toneContrast(sum / 5, contrast)
    tones[slot] = tone
    return tone
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const qx = (x * cos + y * sin) / size
      const qy = (-x * sin + y * cos) / size
      const baseX = Math.floor(qx - 0.5)
      const baseY = Math.floor(qy - 0.5)
      // Union of the four nearest dots; where full-tone dots overlap, the corners close up.
      let clear = 1
      for (let oy = 0; oy <= 1; oy += 1) {
        for (let ox = 0; ox <= 1; ox += 1) {
          const cx = baseX + ox
          const cy = baseY + oy
          const radius = dotRadius(cellTone(cx, cy)) * size
          const ddx = qx - cx - 0.5
          const ddy = qy - cy - 0.5
          const dist = Math.sqrt(ddx * ddx + ddy * ddy) * size
          clear *= 1 - clamp01(radius - dist + 0.5) * clamp01(radius * 2)
        }
      }
      let cover = 1 - clear
      const index = (y * width + x) * 4
      if (fade > 0) cover += (toneContrast(darknessAt(source.data, index), contrast) - cover) * fade
      const paper = paperAlpha((source.data[index + 3] ?? 0) / 255)
      const alpha = paper + cover * (1 - paper)
      writeOverWhite(image.data, index, 1 - cover, 1 - cover, 1 - cover, alpha)
    }
  }
}

function grainAt(u: number, v: number, salt: number) {
  const speckle = hash12(Math.floor(u * GRAIN_CELLS) + salt * 131, Math.floor(v * GRAIN_CELLS) + salt * 71)
  const blotch = valueNoise(u * 36 + salt * 17.3, v * 36 + salt * 5.1)
  return clamp01(0.8 * speckle * speckle + 0.5 * blotch - 0.12)
}

export function risographImageData(image: ImageBuffer, inks: number, offset: number, grain: number) {
  const { width, height } = image
  const source = { data: image.data.slice(), width, height }
  const pair = risoInks(inks)
  const shadow = hexToRgb(pair.shadow)
  const accent = hexToRgb(pair.accent)
  const shiftX = RISO_SHIFT[0] * Math.max(0, offset)
  const shiftY = RISO_SHIFT[1] * Math.max(0, offset)
  const amount = clamp01(grain / 100)
  const longSide = Math.max(width, height, 1)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      let inkA = smoothstep(0.3, 0.9, darknessAt(source.data, index))
      let inkB = smoothstep(0.05, 0.6, darknessAt(source.data, texelIndex(source, x - shiftX, y - shiftY, true)))
      if (amount > 0) {
        const u = (x + 0.5) / longSide
        const v = (y + 0.5) / longSide
        inkA *= 1 - amount * grainAt(u, v, 0)
        inkB *= 1 - amount * grainAt(u, v, 1)
      }
      const cover = 1 - (1 - inkA) * (1 - inkB)
      const paper = paperAlpha((source.data[index + 3] ?? 0) / 255)
      const alpha = paper + cover * (1 - paper)
      writeOverWhite(
        image.data,
        index,
        (1 - inkA * (1 - shadow[0])) * (1 - inkB * (1 - accent[0])),
        (1 - inkA * (1 - shadow[1])) * (1 - inkB * (1 - accent[1])),
        (1 - inkA * (1 - shadow[2])) * (1 - inkB * (1 - accent[2])),
        alpha,
      )
    }
  }
}

export function duotoneImageData(image: ImageBuffer, palette: number, contrast: number) {
  const colors = duotonePalette(palette)
  const shadow = hexToRgb(colors.shadow)
  const highlight = hexToRgb(colors.highlight)
  const gain = 1 + (contrast / 100) * 2
  const { data } = image
  for (let index = 0; index < data.length; index += 4) {
    const lum = luma((data[index] ?? 0) / 255, (data[index + 1] ?? 0) / 255, (data[index + 2] ?? 0) / 255)
    const t = clamp01((lum - 0.5) * gain + 0.5)
    data[index] = (shadow[0] + (highlight[0] - shadow[0]) * t) * 255
    data[index + 1] = (shadow[1] + (highlight[1] - shadow[1]) * t) * 255
    data[index + 2] = (shadow[2] + (highlight[2] - shadow[2]) * t) * 255
  }
}

/**
 * Tone curve for the dither threshold: 50% is neutral, higher prints darker, and the ends clear
 * mid gray to all paper or all ink. A power curve keeps 0 and 1 fixed, so blank areas never ink.
 */
function ditherGamma(threshold: number) {
  return 2 ** ((50 - threshold) / 12.5)
}

export function ditherImageData(image: ImageBuffer, scale: number, threshold: number) {
  const { width, height } = image
  const source = { data: image.data.slice(), width, height }
  const block = Math.max(0.25, scale)
  const gamma = ditherGamma(threshold)
  const fade = patternFade(block, 0.75, 1.5)

  for (let y = 0; y < height; y += 1) {
    const by = Math.floor((y + 0.5) / block)
    for (let x = 0; x < width; x += 1) {
      const bx = Math.floor((x + 0.5) / block)
      const pixel = texel(source, (bx + 0.5) * block - 0.5, (by + 0.5) * block - 0.5)
      const tone = darkness(pixel) ** gamma
      const coverage = pixel[3] ** gamma
      const limit = (bayer8(bx & 7, by & 7) + 0.5) / 64
      let ink = tone > limit ? 1 : 0
      let paper = coverage > limit ? 1 : 0
      if (fade > 0) {
        ink += (tone - ink) * fade
        paper += (pixel[3] - paper) * fade
      }
      const alpha = paper + ink * (1 - paper)
      writeOverWhite(image.data, (y * width + x) * 4, 1 - ink, 1 - ink, 1 - ink, alpha)
    }
  }
}

export function rgbSplitImageData(image: ImageBuffer, distance: number, angle: number) {
  const { width, height } = image
  const source = { data: image.data.slice(), width, height }
  const rad = (angle * Math.PI) / 180
  const dx = Math.cos(rad) * distance
  const dy = Math.sin(rad) * distance

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const red = texel(source, x - dx, y - dy, true)
      const green = texel(source, x, y, true)
      const blue = texel(source, x + dx, y + dy, true)
      writeOverWhite(
        image.data,
        (y * width + x) * 4,
        red[0] * red[3] + 1 - red[3],
        green[1] * green[3] + 1 - green[3],
        blue[2] * blue[3] + 1 - blue[3],
        Math.max(red[3], green[3], blue[3]),
      )
    }
  }
}

export function scanLinesImageData(image: ImageBuffer, spacing: number, darknessAmount: number, jitter: number) {
  const { width, height } = image
  const source = { data: image.data.slice(), width, height }
  const period = Math.max(0.25, spacing)
  const strength = clamp01(darknessAmount / 100)
  const slip = clamp01(jitter / 100)
  const fade = patternFade(period, 1.25, 2.5)
  const edge = Math.min(0.25, 0.5 / period)

  for (let y = 0; y < height; y += 1) {
    const line = Math.floor((y + 0.5) / period)
    const phase = fract((y + 0.5) / period)
    let band = smoothstep(0.5 - edge, 0.5 + edge, phase)
    band += (0.5 - band) * fade
    const sway = hash12(line, 3.7) * 2 - 1
    const shift = sway * sway * sway * slip * period * 3
    const dim = strength * (1 - slip * 0.6 * hash12(line, 11.3)) * band
    for (let x = 0; x < width; x += 1) {
      const pixel = texel(source, x - shift, y, true)
      const lum = luma(pixel[0], pixel[1], pixel[2])
      const shade = 1 - dim * lum
      const index = (y * width + x) * 4
      image.data[index] = pixel[0] * shade * 255
      image.data[index + 1] = pixel[1] * shade * 255
      image.data[index + 2] = pixel[2] * shade * 255
      image.data[index + 3] = pixel[3] * (1 - dim * (1 - lum)) * 255
    }
  }
}

// --- WebGL ---

const PRELUDE = `
  precision highp float;
  uniform sampler2D uTexture;
  uniform float uStepW;
  uniform float uStepH;
  varying vec2 vTexCoord;

  vec2 texSize() {
    return floor(vec2(1.0 / uStepW, 1.0 / uStepH) + 0.5);
  }
  vec2 pixelCoord() {
    return floor(vTexCoord * texSize());
  }
  vec4 texel(vec2 p) {
    vec2 size = texSize();
    vec2 q = clamp(floor(p + 0.5), vec2(0.0), size - 1.0);
    return texture2D(uTexture, (q + 0.5) / size);
  }
  vec4 texelOrClear(vec2 p) {
    vec2 size = texSize();
    vec2 q = floor(p + 0.5);
    if (q.x < 0.0 || q.y < 0.0 || q.x > size.x - 1.0 || q.y > size.y - 1.0) return vec4(0.0);
    return texture2D(uTexture, (q + 0.5) / size);
  }
  float luma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
  }
  float darkness(vec4 c) {
    return (1.0 - luma(c.rgb)) * c.a;
  }
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));
    return a + (b - a) * f.x + (c - a) * f.y + (a - b - c + d) * f.x * f.y;
  }
  float patternFade(float sizePx, float lo, float hi) {
    return clamp((hi - sizePx) / (hi - lo), 0.0, 1.0);
  }
  float paperAlpha(float a) {
    return smoothstep(0.75, 1.0, a);
  }
  vec4 overWhite(vec3 w, float a) {
    if (a <= 0.0) return vec4(0.0);
    return vec4(clamp((w - (1.0 - a)) / a, 0.0, 1.0), a);
  }
`

const HALFTONE_DOTS_SOURCE = `${PRELUDE}
  uniform float uCell;
  uniform vec2 uRot;
  uniform float uContrast;

  float toneContrast(float v) {
    return clamp((v - 0.5) * (1.0 + uContrast * 3.0) + 0.5, 0.0, 1.0);
  }
  float cellTone(vec2 cell) {
    vec2 q = (cell + 0.5) * uCell;
    vec2 p = vec2(q.x * uRot.x - q.y * uRot.y, q.x * uRot.y + q.y * uRot.x);
    float k = uCell * 0.25;
    float sum = darkness(texel(p));
    sum += darkness(texel(p + k * vec2(uRot.x, uRot.y)));
    sum += darkness(texel(p - k * vec2(uRot.x, uRot.y)));
    sum += darkness(texel(p + k * vec2(-uRot.y, uRot.x)));
    sum += darkness(texel(p - k * vec2(-uRot.y, uRot.x)));
    return toneContrast(sum / 5.0);
  }
  void main() {
    vec2 p = pixelCoord();
    vec2 q = vec2(p.x * uRot.x + p.y * uRot.y, -p.x * uRot.y + p.y * uRot.x) / uCell;
    vec2 base = floor(q - 0.5);
    float clear = 1.0;
    for (int oy = 0; oy < 2; oy++) {
      for (int ox = 0; ox < 2; ox++) {
        vec2 cell = base + vec2(float(ox), float(oy));
        float tone = cellTone(cell);
        float radius = sqrt(tone / 3.14159265) * (1.0 + 0.42 * tone * tone) * uCell;
        float dist = length(q - cell - 0.5) * uCell;
        clear *= 1.0 - clamp(radius - dist + 0.5, 0.0, 1.0) * clamp(radius * 2.0, 0.0, 1.0);
      }
    }
    float cover = 1.0 - clear;
    vec4 pixel = texel(p);
    float fade = patternFade(uCell, 1.5, 3.0);
    cover = mix(cover, toneContrast(darkness(pixel)), fade);
    float paper = paperAlpha(pixel.a);
    gl_FragColor = overWhite(vec3(1.0 - cover), paper + cover * (1.0 - paper));
  }
`

const RISOGRAPH_SOURCE = `${PRELUDE}
  uniform vec3 uShadow;
  uniform vec3 uAccent;
  uniform vec2 uShift;
  uniform float uGrain;

  float grainAt(vec2 uv, float salt) {
    float speckle = hash12(floor(uv * ${GRAIN_CELLS.toFixed(1)}) + vec2(salt * 131.0, salt * 71.0));
    float blotch = valueNoise(uv * 36.0 + vec2(salt * 17.3, salt * 5.1));
    return clamp(0.8 * speckle * speckle + 0.5 * blotch - 0.12, 0.0, 1.0);
  }
  void main() {
    vec2 p = pixelCoord();
    vec4 pixel = texelOrClear(p);
    float inkA = smoothstep(0.3, 0.9, darkness(pixel));
    float inkB = smoothstep(0.05, 0.6, darkness(texelOrClear(p - uShift)));
    if (uGrain > 0.0) {
      vec2 size = texSize();
      vec2 uv = (p + 0.5) / max(size.x, size.y);
      inkA *= 1.0 - uGrain * grainAt(uv, 0.0);
      inkB *= 1.0 - uGrain * grainAt(uv, 1.0);
    }
    float cover = 1.0 - (1.0 - inkA) * (1.0 - inkB);
    vec3 w = (1.0 - inkA * (1.0 - uShadow)) * (1.0 - inkB * (1.0 - uAccent));
    float paper = paperAlpha(pixel.a);
    gl_FragColor = overWhite(w, paper + cover * (1.0 - paper));
  }
`

const DUOTONE_SOURCE = `
  precision highp float;
  uniform sampler2D uTexture;
  uniform vec3 uShadow;
  uniform vec3 uHighlight;
  uniform float uGain;
  varying vec2 vTexCoord;
  void main() {
    vec4 color = texture2D(uTexture, vTexCoord);
    float lum = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
    float t = clamp((lum - 0.5) * uGain + 0.5, 0.0, 1.0);
    gl_FragColor = vec4(mix(uShadow, uHighlight, t), color.a);
  }
`

const DITHER_SOURCE = `${PRELUDE}
  uniform float uBlock;
  uniform float uGamma;

  float bit(float v, float place) {
    return mod(floor(v / place), 2.0);
  }
  float bayer8(vec2 b) {
    float value = 0.0;
    value += (2.0 * abs(bit(b.x, 1.0) - bit(b.y, 1.0)) + bit(b.y, 1.0)) * 16.0;
    value += (2.0 * abs(bit(b.x, 2.0) - bit(b.y, 2.0)) + bit(b.y, 2.0)) * 4.0;
    value += (2.0 * abs(bit(b.x, 4.0) - bit(b.y, 4.0)) + bit(b.y, 4.0));
    return value;
  }
  void main() {
    vec2 p = pixelCoord();
    vec2 b = floor((p + 0.5) / uBlock);
    vec4 pixel = texel((b + 0.5) * uBlock - 0.5);
    float tone = pow(darkness(pixel), uGamma);
    float coverage = pow(pixel.a, uGamma);
    float limit = (bayer8(mod(b, 8.0)) + 0.5) / 64.0;
    float ink = tone > limit ? 1.0 : 0.0;
    float paper = coverage > limit ? 1.0 : 0.0;
    float fade = patternFade(uBlock, 0.75, 1.5);
    ink = mix(ink, tone, fade);
    paper = mix(paper, pixel.a, fade);
    gl_FragColor = overWhite(vec3(1.0 - ink), paper + ink * (1.0 - paper));
  }
`

const RGB_SPLIT_SOURCE = `${PRELUDE}
  uniform vec2 uOffset;
  void main() {
    vec2 p = pixelCoord();
    vec4 red = texelOrClear(p - uOffset);
    vec4 green = texelOrClear(p);
    vec4 blue = texelOrClear(p + uOffset);
    vec3 w = vec3(red.r * red.a, green.g * green.a, blue.b * blue.a) + 1.0 - vec3(red.a, green.a, blue.a);
    gl_FragColor = overWhite(w, max(red.a, max(green.a, blue.a)));
  }
`

const SCAN_LINES_SOURCE = `${PRELUDE}
  uniform float uSpacing;
  uniform float uStrength;
  uniform float uJitter;
  void main() {
    vec2 p = pixelCoord();
    float line = floor((p.y + 0.5) / uSpacing);
    float phase = fract((p.y + 0.5) / uSpacing);
    float edge = min(0.25, 0.5 / uSpacing);
    float band = smoothstep(0.5 - edge, 0.5 + edge, phase);
    band = mix(band, 0.5, patternFade(uSpacing, 1.25, 2.5));
    float sway = hash12(vec2(line, 3.7)) * 2.0 - 1.0;
    float shift = sway * sway * sway * uJitter * uSpacing * 3.0;
    float dim = uStrength * (1.0 - uJitter * 0.6 * hash12(vec2(line, 11.3))) * band;
    vec4 pixel = texelOrClear(vec2(p.x - shift, p.y));
    float lum = luma(pixel.rgb);
    gl_FragColor = vec4(pixel.rgb * (1.0 - dim * lum), pixel.a * (1.0 - dim * (1.0 - lum)));
  }
`

// --- Fabric filter classes ---

type HalftoneDotsProps = { cell: number; angle: number; contrast: number }

export class HalftoneDots extends filters.BaseFilter<'HalftoneDots', HalftoneDotsProps> {
  declare cell: number
  declare angle: number
  declare contrast: number

  static type = 'HalftoneDots'
  static defaults: HalftoneDotsProps = { cell: 28, angle: 45, contrast: 25 }
  static uniformLocations = ['uCell', 'uRot', 'uContrast']

  getFragmentSource() {
    return HALFTONE_DOTS_SOURCE
  }

  applyTo2d({ imageData }: { imageData: ImageData }) {
    halftoneDotsImageData(imageData, this.cell, this.angle, this.contrast)
  }

  sendUniformData(gl: WebGLRenderingContext, uniformLocations: WebGLUniformMap) {
    const rad = (this.angle * Math.PI) / 180
    gl.uniform1f(uniformLocations.uCell, Math.max(0.25, this.cell))
    gl.uniform2f(uniformLocations.uRot, Math.cos(rad), Math.sin(rad))
    gl.uniform1f(uniformLocations.uContrast, this.contrast / 100)
  }
}

type RisographProps = { inks: number; offset: number; grain: number }

export class Risograph extends filters.BaseFilter<'Risograph', RisographProps> {
  declare inks: number
  declare offset: number
  declare grain: number

  static type = 'Risograph'
  static defaults: RisographProps = { inks: 0, offset: 20, grain: 35 }
  static uniformLocations = ['uShadow', 'uAccent', 'uShift', 'uGrain']

  getFragmentSource() {
    return RISOGRAPH_SOURCE
  }

  applyTo2d({ imageData }: { imageData: ImageData }) {
    risographImageData(imageData, this.inks, this.offset, this.grain)
  }

  sendUniformData(gl: WebGLRenderingContext, uniformLocations: WebGLUniformMap) {
    const pair = risoInks(this.inks)
    const offset = Math.max(0, this.offset)
    gl.uniform3fv(uniformLocations.uShadow, hexToRgb(pair.shadow))
    gl.uniform3fv(uniformLocations.uAccent, hexToRgb(pair.accent))
    gl.uniform2f(uniformLocations.uShift, RISO_SHIFT[0] * offset, RISO_SHIFT[1] * offset)
    gl.uniform1f(uniformLocations.uGrain, clamp01(this.grain / 100))
  }
}

type DuotoneProps = { palette: number; contrast: number }

export class Duotone extends filters.BaseFilter<'Duotone', DuotoneProps> {
  declare palette: number
  declare contrast: number

  static type = 'Duotone'
  static defaults: DuotoneProps = { palette: 0, contrast: 30 }
  static uniformLocations = ['uShadow', 'uHighlight', 'uGain']

  getFragmentSource() {
    return DUOTONE_SOURCE
  }

  applyTo2d({ imageData }: { imageData: ImageData }) {
    duotoneImageData(imageData, this.palette, this.contrast)
  }

  sendUniformData(gl: WebGLRenderingContext, uniformLocations: WebGLUniformMap) {
    const colors = duotonePalette(this.palette)
    gl.uniform3fv(uniformLocations.uShadow, hexToRgb(colors.shadow))
    gl.uniform3fv(uniformLocations.uHighlight, hexToRgb(colors.highlight))
    gl.uniform1f(uniformLocations.uGain, 1 + (this.contrast / 100) * 2)
  }
}

type BayerDitherProps = { scale: number; threshold: number }

export class BayerDither extends filters.BaseFilter<'BayerDither', BayerDitherProps> {
  declare scale: number
  declare threshold: number

  static type = 'BayerDither'
  static defaults: BayerDitherProps = { scale: 8, threshold: 50 }
  static uniformLocations = ['uBlock', 'uGamma']

  getFragmentSource() {
    return DITHER_SOURCE
  }

  applyTo2d({ imageData }: { imageData: ImageData }) {
    ditherImageData(imageData, this.scale, this.threshold)
  }

  sendUniformData(gl: WebGLRenderingContext, uniformLocations: WebGLUniformMap) {
    gl.uniform1f(uniformLocations.uBlock, Math.max(0.25, this.scale))
    gl.uniform1f(uniformLocations.uGamma, ditherGamma(this.threshold))
  }
}

type RgbSplitProps = { distance: number; angle: number }

export class RgbSplit extends filters.BaseFilter<'RgbSplit', RgbSplitProps> {
  declare distance: number
  declare angle: number

  static type = 'RgbSplit'
  static defaults: RgbSplitProps = { distance: 16, angle: 0 }
  static uniformLocations = ['uOffset']

  getFragmentSource() {
    return RGB_SPLIT_SOURCE
  }

  applyTo2d({ imageData }: { imageData: ImageData }) {
    rgbSplitImageData(imageData, this.distance, this.angle)
  }

  sendUniformData(gl: WebGLRenderingContext, uniformLocations: WebGLUniformMap) {
    const rad = (this.angle * Math.PI) / 180
    gl.uniform2f(uniformLocations.uOffset, Math.cos(rad) * this.distance, Math.sin(rad) * this.distance)
  }

  isNeutralState() {
    return this.distance <= 0
  }
}

type ScanLinesProps = { spacing: number; darkness: number; jitter: number }

export class ScanLines extends filters.BaseFilter<'ScanLines', ScanLinesProps> {
  declare spacing: number
  declare darkness: number
  declare jitter: number

  static type = 'ScanLines'
  static defaults: ScanLinesProps = { spacing: 24, darkness: 55, jitter: 20 }
  static uniformLocations = ['uSpacing', 'uStrength', 'uJitter']

  getFragmentSource() {
    return SCAN_LINES_SOURCE
  }

  applyTo2d({ imageData }: { imageData: ImageData }) {
    scanLinesImageData(imageData, this.spacing, this.darkness, this.jitter)
  }

  sendUniformData(gl: WebGLRenderingContext, uniformLocations: WebGLUniformMap) {
    gl.uniform1f(uniformLocations.uSpacing, Math.max(0.25, this.spacing))
    gl.uniform1f(uniformLocations.uStrength, clamp01(this.darkness / 100))
    gl.uniform1f(uniformLocations.uJitter, clamp01(this.jitter / 100))
  }

  isNeutralState() {
    return this.darkness <= 0 && this.jitter <= 0
  }
}

classRegistry.setClass(HalftoneDots)
classRegistry.setClass(Risograph)
classRegistry.setClass(Duotone)
classRegistry.setClass(BayerDither)
classRegistry.setClass(RgbSplit)
classRegistry.setClass(ScanLines)
