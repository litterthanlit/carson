/**
 * Press Check — live physical-print look as a document treatment.
 * Ink spread, plate misregistration, and paper tooth. Pure, seeded, DPI-aware.
 */
import { instrumentTensionScale } from './instrumentTension'

export type PressCheckParams = {
  inkSpread: number
  misregistration: number
  paperTooth: number
}

export const PRESS_CHECK_DEFAULTS: PressCheckParams = {
  inkSpread: 42,
  misregistration: 28,
  paperTooth: 48,
}

const MAX_INK_RADIUS_PX = 3.2
const MAX_MISREG_PX = 5
const MAX_PARAM_AFTER_TENSION = 200

function clampParam(value: number): number {
  return Math.max(0, Math.min(MAX_PARAM_AFTER_TENSION, value))
}

function paramUnit(value: number): number {
  return clampParam(value) / 100
}

export function pressCheckTensionScale(tensionScale = 1): number {
  return instrumentTensionScale(tensionScale)
}

/** Export/display pixel scale — amplitudes are in canvas px. */
export function pressCheckPixelScale(exportScale = 1): number {
  if (!Number.isFinite(exportScale) || exportScale <= 0) return 1
  return exportScale
}

export function scalePressCheckParams(params: PressCheckParams, tensionScale = 1): PressCheckParams {
  const scale = pressCheckTensionScale(tensionScale)
  if (scale === 1) return params
  return {
    inkSpread: params.inkSpread * scale,
    misregistration: params.misregistration * scale,
    paperTooth: params.paperTooth * scale,
  }
}

export function pressCheckParamsFromRecord(params: Record<string, number>): PressCheckParams {
  return {
    inkSpread: params.inkSpread ?? PRESS_CHECK_DEFAULTS.inkSpread,
    misregistration: params.misregistration ?? PRESS_CHECK_DEFAULTS.misregistration,
    paperTooth: params.paperTooth ?? PRESS_CHECK_DEFAULTS.paperTooth,
  }
}

export function pressCheckParamsToRecord(params: PressCheckParams): Record<string, number> {
  return { ...params }
}

export function clonePressCheckImageData(imageData: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height)
}

function sampleBilinearRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): [number, number, number, number] {
  const clampedX = Math.max(0, Math.min(width - 1, x))
  const clampedY = Math.max(0, Math.min(height - 1, y))
  const x0 = Math.floor(clampedX)
  const y0 = Math.floor(clampedY)
  const x1 = Math.min(x0 + 1, width - 1)
  const y1 = Math.min(y0 + 1, height - 1)
  const fx = clampedX - x0
  const fy = clampedY - y0

  const i00 = (y0 * width + x0) * 4
  const i10 = (y0 * width + x1) * 4
  const i01 = (y1 * width + x0) * 4
  const i11 = (y1 * width + x1) * 4

  const channels: [number, number, number, number] = [0, 0, 0, 0]
  for (let c = 0; c < 4; c++) {
    const top = data[i00 + c] + (data[i10 + c] - data[i00 + c]) * fx
    const bottom = data[i01 + c] + (data[i11 + c] - data[i01 + c]) * fx
    channels[c] = Math.round(top + (bottom - top) * fy)
  }
  return channels
}

function boxBlurAxis(imageData: ImageData, radius: number, horizontal: boolean): ImageData {
  const { width, height, data } = imageData
  const out = clonePressCheckImageData(imageData)
  const outData = out.data
  const r = Math.max(1, Math.round(radius))
  const span = r * 2 + 1

  if (horizontal) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sumR = 0
        let sumG = 0
        let sumB = 0
        let sumA = 0
        for (let k = -r; k <= r; k++) {
          const sx = Math.max(0, Math.min(width - 1, x + k))
          const i = (y * width + sx) * 4
          sumR += data[i]
          sumG += data[i + 1]
          sumB += data[i + 2]
          sumA += data[i + 3]
        }
        const oi = (y * width + x) * 4
        outData[oi] = Math.round(sumR / span)
        outData[oi + 1] = Math.round(sumG / span)
        outData[oi + 2] = Math.round(sumB / span)
        outData[oi + 3] = Math.round(sumA / span)
      }
    }
    return out
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sumR = 0
      let sumG = 0
      let sumB = 0
      let sumA = 0
      for (let k = -r; k <= r; k++) {
        const sy = Math.max(0, Math.min(height - 1, y + k))
        const i = (sy * width + x) * 4
        sumR += data[i]
        sumG += data[i + 1]
        sumB += data[i + 2]
        sumA += data[i + 3]
      }
      const oi = (y * width + x) * 4
      outData[oi] = Math.round(sumR / span)
      outData[oi + 1] = Math.round(sumG / span)
      outData[oi + 2] = Math.round(sumB / span)
      outData[oi + 3] = Math.round(sumA / span)
    }
  }
  return out
}

/** Dark inks bleed into the sheet — blur then keep only the darker result. */
export function applyInkSpread(imageData: ImageData, inkSpread: number, exportScale = 1): ImageData {
  const radius = paramUnit(inkSpread) * MAX_INK_RADIUS_PX * pressCheckPixelScale(exportScale)
  if (radius < 0.5) return clonePressCheckImageData(imageData)

  const blurred = boxBlurAxis(boxBlurAxis(imageData, radius, true), radius, false)
  const { data } = imageData
  const out = clonePressCheckImageData(imageData)
  const outData = out.data
  const wet = blurred.data

  for (let i = 0; i < data.length; i += 4) {
    outData[i] = Math.min(data[i], wet[i])
    outData[i + 1] = Math.min(data[i + 1], wet[i + 1])
    outData[i + 2] = Math.min(data[i + 2], wet[i + 2])
    outData[i + 3] = data[i + 3]
  }
  return out
}

/** CMY-ish plate shift: R/G/B sample from seeded opposite offsets. */
export function applyMisregistration(
  imageData: ImageData,
  misregistration: number,
  random: () => number,
  exportScale = 1,
): ImageData {
  const offset = paramUnit(misregistration) * MAX_MISREG_PX * pressCheckPixelScale(exportScale)
  if (offset < 0.25) return clonePressCheckImageData(imageData)

  const angle = random() * Math.PI * 2
  const dx = Math.cos(angle) * offset
  const dy = Math.sin(angle) * offset
  const { width, height, data } = imageData
  const out = clonePressCheckImageData(imageData)
  const outData = out.data

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r] = sampleBilinearRgba(data, width, height, x + dx, y + dy)
      const [, g] = sampleBilinearRgba(data, width, height, x, y)
      const [, , b] = sampleBilinearRgba(data, width, height, x - dx, y - dy)
      const oi = (y * width + x) * 4
      outData[oi] = r
      outData[oi + 1] = g
      outData[oi + 2] = b
      outData[oi + 3] = data[oi + 3]
    }
  }
  return out
}

function buildToothGrid(cols: number, rows: number, random: () => number): Float32Array {
  const grid = new Float32Array(cols * rows)
  for (let i = 0; i < grid.length; i++) {
    grid[i] = random()
  }
  return grid
}

function sampleGridBilinear(grid: Float32Array, cols: number, rows: number, u: number, v: number): number {
  const x = u * (cols - 1)
  const y = v * (rows - 1)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(x0 + 1, cols - 1)
  const y1 = Math.min(y0 + 1, rows - 1)
  const fx = x - x0
  const fy = y - y0
  const v00 = grid[y0 * cols + x0]
  const v10 = grid[y0 * cols + x1]
  const v01 = grid[y1 * cols + x0]
  const v11 = grid[y1 * cols + x1]
  const top = v00 + (v10 - v00) * fx
  const bottom = v01 + (v11 - v01) * fx
  return top + (bottom - top) * fy
}

/** Uncoated paper tooth — seeded fiber noise multiplied into the print. */
export function applyPaperTooth(
  imageData: ImageData,
  paperTooth: number,
  random: () => number,
  exportScale = 1,
): ImageData {
  const amount = paramUnit(paperTooth)
  if (amount < 0.01) return clonePressCheckImageData(imageData)

  const { width, height, data } = imageData
  const out = clonePressCheckImageData(imageData)
  const outData = out.data
  const pixelScale = pressCheckPixelScale(exportScale)
  const cellSize = Math.max(3, Math.round(7 * pixelScale))
  const cols = Math.max(2, Math.ceil(width / cellSize) + 1)
  const rows = Math.max(2, Math.ceil(height / cellSize) + 1)
  const grid = buildToothGrid(cols, rows, random)
  const depth = 0.08 + amount * 0.22

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tooth = sampleGridBilinear(grid, cols, rows, x / width, y / height)
      const mul = 1 - (tooth - 0.5) * 2 * depth
      const i = (y * width + x) * 4
      outData[i] = Math.max(0, Math.min(255, Math.round(data[i] * mul)))
      outData[i + 1] = Math.max(0, Math.min(255, Math.round(data[i + 1] * mul * 0.995)))
      outData[i + 2] = Math.max(0, Math.min(255, Math.round(data[i + 2] * mul * 0.97)))
    }
  }
  return out
}

/** Full Press Check pass: bleed → plates → tooth. */
export function renderPressCheckPass(
  imageData: ImageData,
  params: PressCheckParams,
  random: () => number,
  exportScale = 1,
): ImageData {
  const spread = applyInkSpread(imageData, params.inkSpread, exportScale)
  const plates = applyMisregistration(spread, params.misregistration, random, exportScale)
  return applyPaperTooth(plates, params.paperTooth, random, exportScale)
}
