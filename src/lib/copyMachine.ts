/**
 * Copy Machine — spatial displacement bake (CM-0 spike).
 * Pure, deterministic image warping: wobble (displacement field) + drag (scan smear).
 * Tonal passes and treatment wiring land in CM-1.
 */

export type CopyMachineParams = {
  // tonal (CM-1)
  contrast: number
  grain: number
  voids: number
  // spatial
  wobble: number
  wobbleFreq: number
  drag: number
  dragAngle: number
  bands: number
  // companion (CM-2)
  ghost: number
  ghostOffset: number
}

export const COPY_MACHINE_DEFAULTS: CopyMachineParams = {
  contrast: 75,
  grain: 60,
  voids: 15,
  wobble: 35,
  wobbleFreq: 50,
  drag: 40,
  dragAngle: 90,
  bands: 25,
  ghost: 20,
  ghostOffset: 3,
}

const MAX_WOBBLE_PX = 12
const MAX_DRAG_PX = 24

function clampParam(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function paramUnit(value: number): number {
  return clampParam(value) / 100
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function cloneImageData(imageData: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height)
}

function buildValueNoiseGrid(cols: number, rows: number, random: () => number): Float32Array {
  const grid = new Float32Array(cols * rows)
  for (let i = 0; i < grid.length; i++) {
    grid[i] = random() * 2 - 1
  }
  return grid
}

function sampleGridBilinear(
  grid: Float32Array,
  cols: number,
  rows: number,
  u: number,
  v: number,
): number {
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

/** Seeded xy displacement field — 2 floats per pixel (dx, dy). */
export function buildDisplacementField(
  width: number,
  height: number,
  params: Pick<CopyMachineParams, 'wobble' | 'wobbleFreq'>,
  random: () => number,
): Float32Array {
  const field = new Float32Array(width * height * 2)
  const amplitude = paramUnit(params.wobble) * MAX_WOBBLE_PX
  if (amplitude < 0.01 || width < 1 || height < 1) return field

  const freq = paramUnit(params.wobbleFreq)
  const cellSize = Math.max(4, Math.round(lerp(48, 6, freq)))
  const cols = Math.max(2, Math.ceil(width / cellSize) + 1)
  const rows = Math.max(2, Math.ceil(height / cellSize) + 1)

  const gridX = buildValueNoiseGrid(cols, rows, random)
  const gridY = buildValueNoiseGrid(cols, rows, random)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width
      const v = y / height
      const idx = (y * width + x) * 2
      field[idx] = sampleGridBilinear(gridX, cols, rows, u, v) * amplitude
      field[idx + 1] = sampleGridBilinear(gridY, cols, rows, u, v) * amplitude
    }
  }

  return field
}

/** Inverse-map warp: each output pixel samples the source at field-offset coordinates. */
export function applyDisplacement(imageData: ImageData, field: Float32Array): ImageData {
  const { width, height, data } = imageData
  const out = new ImageData(width, height)
  const outData = out.data

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const fi = (y * width + x) * 2
      const sx = x + field[fi]
      const sy = y + field[fi + 1]
      const [r, g, b, a] = sampleBilinearRgba(data, width, height, sx, sy)
      const oi = (y * width + x) * 4
      outData[oi] = r
      outData[oi + 1] = g
      outData[oi + 2] = b
      outData[oi + 3] = a
    }
  }

  return out
}

/** Axis-aligned scan smear — simulates the original shifting during the scan pass. */
export function applyDrag(
  imageData: ImageData,
  params: Pick<CopyMachineParams, 'drag' | 'dragAngle'>,
  random: () => number,
): ImageData {
  const maxLength = paramUnit(params.drag) * MAX_DRAG_PX
  if (maxLength < 0.5) return cloneImageData(imageData)

  const { width, height, data } = imageData
  const angleRad = (params.dragAngle * Math.PI) / 180
  const ux = Math.cos(angleRad)
  const uy = Math.sin(angleRad)

  const scanAlongY = Math.abs(uy) >= Math.abs(ux)
  const scanCount = scanAlongY ? height : width
  const smearStrength = new Float32Array(scanCount)
  for (let i = 0; i < scanCount; i++) {
    smearStrength[i] = random() < 0.4 ? 0.25 + random() * 0.75 : 0
  }

  const out = new ImageData(width, height)
  const outData = out.data
  const steps = Math.max(1, Math.round(maxLength))

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const scanIndex = scanAlongY ? y : x
      const smear = smearStrength[scanIndex] * maxLength
      const oi = (y * width + x) * 4

      if (smear < 0.5) {
        const si = oi
        outData[oi] = data[si]
        outData[oi + 1] = data[si + 1]
        outData[oi + 2] = data[si + 2]
        outData[oi + 3] = data[si + 3]
        continue
      }

      let rSum = 0
      let gSum = 0
      let bSum = 0
      let aSum = 0
      let count = 0

      for (let step = 0; step <= steps; step++) {
        const t = step / steps
        const offset = smear * t
        const sx = x - ux * offset
        const sy = y - uy * offset
        const [r, g, b, a] = sampleBilinearRgba(data, width, height, sx, sy)
        rSum += r
        gSum += g
        bSum += b
        aSum += a
        count++
      }

      outData[oi] = Math.round(rSum / count)
      outData[oi + 1] = Math.round(gSum / count)
      outData[oi + 2] = Math.round(bSum / count)
      outData[oi + 3] = Math.round(aSum / count)
    }
  }

  return out
}

/** CM-0 convenience: displacement field + drag in one deterministic pass. */
export function applySpatialPasses(
  imageData: ImageData,
  params: Pick<CopyMachineParams, 'wobble' | 'wobbleFreq' | 'drag' | 'dragAngle'>,
  random: () => number,
): ImageData {
  const { width, height } = imageData
  const field = buildDisplacementField(width, height, params, random)
  const warped = applyDisplacement(imageData, field)
  return applyDrag(warped, params, random)
}
