/**
 * Photoshop-style pixel filters used by the Filter Gallery.
 * Custom directional blurs implement both Canvas2D and WebGL so they run
 * on Fabric's default WebGL backend as well as in jsdom tests.
 */
import { classRegistry, filters, isWebGLPipelineState } from 'fabric'

type ImageBuffer = {
  data: Uint8ClampedArray
  width: number
  height: number
}

type WebGLUniformMap = Record<string, WebGLUniformLocation | null>

export const FX_KINDS = [
  'gaussian-blur',
  'motion-blur',
  'radial-blur',
  'zoom-blur',
  'sharpen',
  'unsharp',
  'emboss',
  'find-edges',
  'glowing-edges',
  'posterize',
  'pixelate',
  'halftone',
  'watercolor',
  'brightness',
  'contrast',
  'saturation',
  'vibrance',
  'hue',
  'invert',
  'threshold',
  'grayscale',
  'sepia',
  'vintage',
  'kodachrome',
  'polaroid',
  'technicolor',
  'brownie',
  'grain',
] as const

export type FxKind = (typeof FX_KINDS)[number]

export const FX_LABELS: Record<FxKind, string> = {
  'gaussian-blur': 'Gaussian',
  'motion-blur': 'Motion',
  'radial-blur': 'Radial',
  'zoom-blur': 'Zoom',
  sharpen: 'Sharpen',
  unsharp: 'Unsharp',
  emboss: 'Emboss',
  'find-edges': 'Edges',
  'glowing-edges': 'Glow edges',
  posterize: 'Posterize',
  pixelate: 'Pixelate',
  halftone: 'Halftone',
  watercolor: 'Wash paint',
  brightness: 'Brightness',
  contrast: 'Contrast',
  saturation: 'Saturation',
  vibrance: 'Vibrance',
  hue: 'Hue',
  invert: 'Invert',
  threshold: 'Threshold',
  grayscale: 'Grayscale',
  sepia: 'Sepia',
  vintage: 'Vintage',
  kodachrome: 'Kodachrome',
  polaroid: 'Polaroid',
  technicolor: 'Technicolor',
  brownie: 'Brownie',
  grain: 'Grain',
}

export function isFxKind(value: string | undefined): value is FxKind {
  return Boolean(value && (FX_KINDS as readonly string[]).includes(value))
}

export function fxChipLabel(fxKind: string | undefined, params: Record<string, number>): string {
  if (!isFxKind(fxKind)) return 'Filter'
  const name = FX_LABELS[fxKind]
  if (fxKind === 'motion-blur') return `${name}·${Math.round(params.angle ?? 0)}°`
  if (fxKind === 'gaussian-blur') return `${name}·${Math.round(params.radius ?? 18)}`
  if (fxKind === 'radial-blur' || fxKind === 'zoom-blur') return `${name}·${Math.round(params.amount ?? 40)}`
  if (params.amount !== undefined) return `${name}·${Math.round(params.amount)}`
  if (params.levels !== undefined) return `${name}·${Math.round(params.levels)}`
  return name
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

function sample(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): [number, number, number, number] {
  const cx = x < 0 ? 0 : x >= width ? width - 1 : x | 0
  const cy = y < 0 ? 0 : y >= height ? height - 1 : y | 0
  const index = (cy * width + cx) * 4
  return [data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0, data[index + 3] ?? 0]
}

function writeWeightedAverage(
  source: Uint8ClampedArray,
  dest: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  points: Array<{ x: number; y: number; weight: number }>,
) {
  let r = 0
  let g = 0
  let b = 0
  let a = 0
  let weightSum = 0
  for (const point of points) {
    const pixel = sample(source, width, height, point.x, point.y)
    const alpha = pixel[3] * point.weight
    r += pixel[0] * alpha
    g += pixel[1] * alpha
    b += pixel[2] * alpha
    a += alpha
    weightSum += point.weight
  }
  const index = (y * width + x) * 4
  dest[index] = a > 0 ? r / a : 0
  dest[index + 1] = a > 0 ? g / a : 0
  dest[index + 2] = a > 0 ? b / a : 0
  dest[index + 3] = weightSum > 0 ? a / weightSum : 0
}

export function motionBlurImageData(image: ImageBuffer, distance: number, angle: number) {
  const length = Math.max(1, distance)
  const rad = (angle * Math.PI) / 180
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  const samples = Math.max(3, Math.min(24, Math.round(length)))
  const dest = new Uint8ClampedArray(image.data.length)

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const points: Array<{ x: number; y: number; weight: number }> = []
      for (let step = -samples; step <= samples; step += 1) {
        const percent = step / samples
        points.push({
          x: x + dx * length * percent,
          y: y + dy * length * percent,
          weight: 1 - Math.abs(percent),
        })
      }
      writeWeightedAverage(image.data, dest, image.width, image.height, x, y, points)
    }
  }
  image.data.set(dest)
}

export function radialBlurImageData(image: ImageBuffer, amount: number, centerX = 50, centerY = 50) {
  const spin = ((amount / 100) * Math.PI) / 2
  const cx = (centerX / 100) * (image.width - 1)
  const cy = (centerY / 100) * (image.height - 1)
  const samples = 16
  const dest = new Uint8ClampedArray(image.data.length)

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const deltaX = x - cx
      const deltaY = y - cy
      const radius = Math.hypot(deltaX, deltaY)
      const base = Math.atan2(deltaY, deltaX)
      const points: Array<{ x: number; y: number; weight: number }> = []
      for (let step = -samples; step <= samples; step += 1) {
        const percent = step / samples
        const angle = base + spin * percent
        points.push({
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
          weight: 1 - Math.abs(percent),
        })
      }
      writeWeightedAverage(image.data, dest, image.width, image.height, x, y, points)
    }
  }
  image.data.set(dest)
}

export function zoomBlurImageData(image: ImageBuffer, amount: number, centerX = 50, centerY = 50) {
  const strength = (amount / 100) * 0.45
  const cx = (centerX / 100) * (image.width - 1)
  const cy = (centerY / 100) * (image.height - 1)
  const samples = 16
  const dest = new Uint8ClampedArray(image.data.length)

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const deltaX = x - cx
      const deltaY = y - cy
      const points: Array<{ x: number; y: number; weight: number }> = []
      for (let step = -samples; step <= samples; step += 1) {
        const percent = step / samples
        const scale = 1 + strength * percent
        points.push({
          x: cx + deltaX * scale,
          y: cy + deltaY * scale,
          weight: 1 - Math.abs(percent),
        })
      }
      writeWeightedAverage(image.data, dest, image.width, image.height, x, y, points)
    }
  }
  image.data.set(dest)
}

export function posterizeImageData(image: ImageBuffer, levels: number) {
  const steps = Math.max(2, Math.min(16, Math.round(levels)))
  const factor = 255 / (steps - 1)
  const { data } = image
  for (let index = 0; index < data.length; index += 4) {
    data[index] = Math.round((data[index] ?? 0) / factor) * factor
    data[index + 1] = Math.round((data[index + 1] ?? 0) / factor) * factor
    data[index + 2] = Math.round((data[index + 2] ?? 0) / factor) * factor
  }
}

const DIRECTIONAL_BLUR_SOURCE = `
  precision highp float;
  uniform sampler2D uTexture;
  uniform vec2 uDelta;
  varying vec2 vTexCoord;
  void main() {
    vec4 color = vec4(0.0);
    float totalC = 0.0;
    float totalA = 0.0;
    const float nSamples = 16.0;
    for (float t = -nSamples; t <= nSamples; t++) {
      float percent = t / nSamples;
      vec4 sampleColor = texture2D(uTexture, vTexCoord + uDelta * percent);
      float weight = 1.0 - abs(percent);
      float alpha = weight * sampleColor.a;
      color.rgb += sampleColor.rgb * alpha;
      color.a += alpha;
      totalA += weight;
      totalC += alpha;
    }
    gl_FragColor.rgb = color.rgb / max(totalC, 0.0001);
    gl_FragColor.a = color.a / max(totalA, 0.0001);
  }
`

const RADIAL_BLUR_SOURCE = `
  precision highp float;
  uniform sampler2D uTexture;
  uniform vec2 uCenter;
  uniform float uAmount;
  varying vec2 vTexCoord;
  void main() {
    vec2 delta = vTexCoord - uCenter;
    float radius = length(delta);
    float base = atan(delta.y, delta.x);
    vec4 color = vec4(0.0);
    float totalC = 0.0;
    float totalA = 0.0;
    const float nSamples = 16.0;
    for (float t = -nSamples; t <= nSamples; t++) {
      float percent = t / nSamples;
      float angle = base + uAmount * percent;
      vec2 samplePos = uCenter + vec2(cos(angle), sin(angle)) * radius;
      vec4 sampleColor = texture2D(uTexture, samplePos);
      float weight = 1.0 - abs(percent);
      float alpha = weight * sampleColor.a;
      color.rgb += sampleColor.rgb * alpha;
      color.a += alpha;
      totalA += weight;
      totalC += alpha;
    }
    gl_FragColor.rgb = color.rgb / max(totalC, 0.0001);
    gl_FragColor.a = color.a / max(totalA, 0.0001);
  }
`

const ZOOM_BLUR_SOURCE = `
  precision highp float;
  uniform sampler2D uTexture;
  uniform vec2 uCenter;
  uniform float uAmount;
  varying vec2 vTexCoord;
  void main() {
    vec2 delta = vTexCoord - uCenter;
    vec4 color = vec4(0.0);
    float totalC = 0.0;
    float totalA = 0.0;
    const float nSamples = 16.0;
    for (float t = -nSamples; t <= nSamples; t++) {
      float percent = t / nSamples;
      float scale = 1.0 + uAmount * percent;
      vec4 sampleColor = texture2D(uTexture, uCenter + delta * scale);
      float weight = 1.0 - abs(percent);
      float alpha = weight * sampleColor.a;
      color.rgb += sampleColor.rgb * alpha;
      color.a += alpha;
      totalA += weight;
      totalC += alpha;
    }
    gl_FragColor.rgb = color.rgb / max(totalC, 0.0001);
    gl_FragColor.a = color.a / max(totalA, 0.0001);
  }
`

const POSTERIZE_SOURCE = `
  precision highp float;
  uniform sampler2D uTexture;
  uniform float uLevels;
  varying vec2 vTexCoord;
  void main() {
    vec4 color = texture2D(uTexture, vTexCoord);
    float steps = max(uLevels - 1.0, 1.0);
    color.rgb = floor(color.rgb * steps + 0.5) / steps;
    gl_FragColor = color;
  }
`

type MotionBlurProps = {
  distance: number
  angle: number
}

class MotionBlur extends filters.BaseFilter<'MotionBlur', MotionBlurProps> {
  declare distance: number
  declare angle: number
  declare sourceWidth: number
  declare sourceHeight: number

  static type = 'MotionBlur'
  static defaults: MotionBlurProps = { distance: 24, angle: 0 }
  static uniformLocations = ['uDelta']

  getFragmentSource() {
    return DIRECTIONAL_BLUR_SOURCE
  }

  applyTo(options: Parameters<filters.BaseFilter<'MotionBlur', MotionBlurProps>['applyTo']>[0]) {
    if (isWebGLPipelineState(options)) {
      this.sourceWidth = options.sourceWidth
      this.sourceHeight = options.sourceHeight
    }
    super.applyTo(options)
  }

  applyTo2d({ imageData }: { imageData: ImageData }) {
    motionBlurImageData(imageData, this.distance, this.angle)
  }

  sendUniformData(gl: WebGLRenderingContext, uniformLocations: WebGLUniformMap) {
    const width = Math.max(1, this.sourceWidth || 1)
    const height = Math.max(1, this.sourceHeight || 1)
    const rad = (this.angle * Math.PI) / 180
    gl.uniform2f(
      uniformLocations.uDelta,
      (Math.cos(rad) * this.distance) / width,
      (Math.sin(rad) * this.distance) / height,
    )
  }

  isNeutralState() {
    return this.distance <= 0
  }
}

type RadialBlurProps = {
  amount: number
  centerX: number
  centerY: number
}

class SpinBlur extends filters.BaseFilter<'SpinBlur', RadialBlurProps> {
  declare amount: number
  declare centerX: number
  declare centerY: number

  static type = 'SpinBlur'
  static defaults: RadialBlurProps = { amount: 40, centerX: 50, centerY: 50 }
  static uniformLocations = ['uCenter', 'uAmount']

  getFragmentSource() {
    return RADIAL_BLUR_SOURCE
  }

  applyTo2d({ imageData }: { imageData: ImageData }) {
    radialBlurImageData(imageData, this.amount, this.centerX, this.centerY)
  }

  sendUniformData(gl: WebGLRenderingContext, uniformLocations: WebGLUniformMap) {
    gl.uniform2f(uniformLocations.uCenter, this.centerX / 100, this.centerY / 100)
    gl.uniform1f(uniformLocations.uAmount, ((this.amount / 100) * Math.PI) / 2)
  }

  isNeutralState() {
    return this.amount <= 0
  }
}

class ZoomBlur extends filters.BaseFilter<'ZoomBlur', RadialBlurProps> {
  declare amount: number
  declare centerX: number
  declare centerY: number

  static type = 'ZoomBlur'
  static defaults: RadialBlurProps = { amount: 40, centerX: 50, centerY: 50 }
  static uniformLocations = ['uCenter', 'uAmount']

  getFragmentSource() {
    return ZOOM_BLUR_SOURCE
  }

  applyTo2d({ imageData }: { imageData: ImageData }) {
    zoomBlurImageData(imageData, this.amount, this.centerX, this.centerY)
  }

  sendUniformData(gl: WebGLRenderingContext, uniformLocations: WebGLUniformMap) {
    gl.uniform2f(uniformLocations.uCenter, this.centerX / 100, this.centerY / 100)
    gl.uniform1f(uniformLocations.uAmount, (this.amount / 100) * 0.45)
  }

  isNeutralState() {
    return this.amount <= 0
  }
}

type PosterizeProps = {
  levels: number
}

class Posterize extends filters.BaseFilter<'Posterize', PosterizeProps> {
  declare levels: number

  static type = 'Posterize'
  static defaults: PosterizeProps = { levels: 4 }
  static uniformLocations = ['uLevels']

  getFragmentSource() {
    return POSTERIZE_SOURCE
  }

  applyTo2d({ imageData }: { imageData: ImageData }) {
    posterizeImageData(imageData, this.levels)
  }

  sendUniformData(gl: WebGLRenderingContext, uniformLocations: WebGLUniformMap) {
    gl.uniform1f(uniformLocations.uLevels, Math.max(2, this.levels))
  }

  isNeutralState() {
    return this.levels >= 16
  }
}

classRegistry.setClass(MotionBlur)
classRegistry.setClass(SpinBlur)
classRegistry.setClass(ZoomBlur)
classRegistry.setClass(Posterize)

type FabricFilter = filters.BaseFilter<string, object>

export const TREATMENT_FILTER_FLAG = 'carsonTreatment'

export function markTreatmentFilter(filter: FabricFilter): FabricFilter {
  ;(filter as unknown as Record<string, unknown>)[TREATMENT_FILTER_FLAG] = true
  return filter
}

export function isTreatmentFilter(filter: FabricFilter | undefined): boolean {
  if (!filter) return false
  return Boolean((filter as unknown as Record<string, unknown>)[TREATMENT_FILTER_FLAG])
}

function markAll(list: FabricFilter[]): FabricFilter[] {
  return list.map(markTreatmentFilter)
}

function unit(value: number, fallback = 0) {
  return Math.max(-1, Math.min(1, (Number.isFinite(value) ? value : fallback) / 100))
}

function sharpenMatrix(amount: number): number[] {
  const a = (amount / 100) * 1.15
  return [0, -a, 0, -a, 1 + 4 * a, -a, 0, -a, 0]
}

export function buildFxFilters(kind: FxKind, params: Record<string, number>): FabricFilter[] {
  switch (kind) {
    case 'gaussian-blur':
      return markAll([new filters.Blur({ blur: clampInt(params.radius ?? 24, 0, 100) / 220 })])
    case 'motion-blur':
      return markAll([
        new MotionBlur({
          distance: clampInt(params.distance ?? 32, 0, 200),
          angle: clampInt(params.angle ?? 0, 0, 360),
        }),
      ])
    case 'radial-blur':
      return markAll([
        new SpinBlur({
          amount: clampInt(params.amount ?? 40, 0, 100),
          centerX: clampInt(params.centerX ?? 50, 0, 100),
          centerY: clampInt(params.centerY ?? 50, 0, 100),
        }),
      ])
    case 'zoom-blur':
      return markAll([
        new ZoomBlur({
          amount: clampInt(params.amount ?? 40, 0, 100),
          centerX: clampInt(params.centerX ?? 50, 0, 100),
          centerY: clampInt(params.centerY ?? 50, 0, 100),
        }),
      ])
    case 'sharpen':
      return markAll([new filters.Convolute({ matrix: sharpenMatrix(params.amount ?? 50) })])
    case 'unsharp':
      return markAll([
        new filters.Convolute({ matrix: sharpenMatrix((params.amount ?? 70) * 1.35) }),
        new filters.Contrast({ contrast: 0.08 }),
      ])
    case 'emboss':
      return markAll([
        new filters.Convolute({
          matrix: [clampInt(params.amount ?? 60, 0, 100) / 80, 1, 0, 1, 0.7, -1, 0, -1, -1],
        }),
      ])
    case 'find-edges':
      return markAll([
        new filters.Convolute({
          matrix: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
        }),
      ])
    case 'glowing-edges':
      return markAll([
        new filters.Convolute({
          matrix: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
        }),
        new filters.Invert(),
        new filters.Contrast({ contrast: 0.28 }),
      ])
    case 'posterize':
      return markAll([new Posterize({ levels: clampInt(params.levels ?? 4, 2, 16) })])
    case 'pixelate':
      return markAll([new filters.Pixelate({ blocksize: clampInt(params.blocksize ?? 8, 2, 48) })])
    case 'halftone':
      return markAll([
        new filters.Grayscale(),
        new filters.Pixelate({ blocksize: clampInt(params.blocksize ?? 6, 2, 32) }),
        new filters.Contrast({ contrast: 0.42 }),
        new filters.BlackWhite(),
      ])
    case 'watercolor':
      return markAll([
        new filters.Blur({ blur: 0.12 + clampInt(params.amount ?? 40, 0, 100) / 400 }),
        new filters.Saturation({ saturation: 0.22 }),
        new Posterize({ levels: 6 }),
        new filters.Noise({ noise: 28 }),
      ])
    case 'brightness':
      return markAll([new filters.Brightness({ brightness: unit(params.amount ?? 0) })])
    case 'contrast':
      return markAll([new filters.Contrast({ contrast: unit(params.amount ?? 0) })])
    case 'saturation':
      return markAll([new filters.Saturation({ saturation: unit(params.amount ?? 0) })])
    case 'vibrance':
      return markAll([new filters.Vibrance({ vibrance: unit(params.amount ?? 0) })])
    case 'hue':
      return markAll([
        new filters.HueRotation({
          rotation: Math.max(-1, Math.min(1, (params.angle ?? 0) / 180)),
        }),
      ])
    case 'invert':
      return markAll([new filters.Invert()])
    case 'threshold':
      return markAll([new filters.BlackWhite(), new filters.Contrast({ contrast: 0.2 })])
    case 'grayscale':
      return markAll([new filters.Grayscale()])
    case 'sepia':
      return markAll([new filters.Sepia()])
    case 'vintage':
      return markAll([new filters.Vintage()])
    case 'kodachrome':
      return markAll([new filters.Kodachrome()])
    case 'polaroid':
      return markAll([new filters.Polaroid()])
    case 'technicolor':
      return markAll([new filters.Technicolor()])
    case 'brownie':
      return markAll([new filters.Brownie()])
    case 'grain':
      return markAll([new filters.Noise({ noise: clampInt(params.amount ?? 40, 0, 100) * 3.2 })])
    default:
      return []
  }
}
