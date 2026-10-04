/**
 * Surface — what time and hands do to a printed surface, on its raster.
 *
 *   age    — time and light: ink fades and warms, more on the side that faced
 *            the window and toward the exposed edges, unevenly; where the layer
 *            carries its own paper, the paper yellows from the edges in and
 *            foxes with small rust spots.
 *   abrade — rubbing (a thumb, a sleeve, sandpaper): ink worn off in long
 *            streaks along the rub, letting go through the paper's tooth; on
 *            printed paper the coating wears through to white fibre.
 *   erode  — ink loss: ink chips away from its own edges inward, frayed by the
 *            fibres, with the odd pinhole — ink removed, not painted over.
 *
 * Every process works in millimetres (`pxPerMm` is the raster's resolution)
 * and is seeded. Transparent layers (type) are ink only; opaque ones (scans,
 * scraps) are ink on paper.
 */
import { boxBlur } from './copyMachine'
import { releaseField, smoothstep, valueNoise } from './tapeLift'

export type SurfaceRaster = {
  data: Uint8ClampedArray
  width: number
  height: number
  /** True when the layer is a sheet (ink on paper), false when it's ink alone. */
  opaque: boolean
  pxPerMm: number
  paper: [number, number, number]
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

/** How much ink a pixel carries: its darkness on paper, or its alpha when it's ink alone. */
function inkPlane(surface: SurfaceRaster): Float32Array {
  const { data, width, height, opaque } = surface
  const ink = new Float32Array(width * height)
  for (let p = 0, i = 0; p < ink.length; p++, i += 4) {
    if (opaque) ink[p] = 1 - (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255
    else ink[p] = data[i + 3] / 255
  }
  return ink
}

/** Distance to the nearest layer edge, in mm (cheap: min of the four). */
function edgeDistanceMm(x: number, y: number, surface: SurfaceRaster) {
  return Math.min(x, y, surface.width - 1 - x, surface.height - 1 - y) / Math.max(0.01, surface.pxPerMm)
}

/** Remove a share `amount` (0–1) of the ink at pixel i: alpha for ink alone, back to paper for a sheet. */
function removeInk(surface: SurfaceRaster, i: number, amount: number, toward: [number, number, number] = surface.paper) {
  if (amount <= 0) return
  const { data } = surface
  if (surface.opaque) {
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] + (toward[c] - data[i + c]) * amount)
  } else {
    data[i + 3] = Math.round(data[i + 3] * (1 - amount))
  }
}

export function ageSurface(surface: SurfaceRaster, amount: number, random: () => number) {
  const a = clamp01(amount)
  if (a <= 0) return
  const { data, width, height, pxPerMm } = surface
  const mm = Math.max(0.05, pxPerMm)
  const light = random() * Math.PI * 2
  const lx = Math.cos(light)
  const ly = Math.sin(light)
  const mottle = valueNoise(width, height, Math.max(3, 14 * mm), random)
  const spots = surface.opaque ? valueNoise(width, height, Math.max(2, 1.6 * mm), random) : null
  const spotField = surface.opaque ? valueNoise(width, height, Math.max(4, 25 * mm), random) : null
  const warmInk: [number, number, number] = [96, 78, 62]
  const yellow: [number, number, number] = [226, 206, 162]
  const fox: [number, number, number] = [170, 112, 66]
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      const i = p * 4
      // Exposure: the side that faced the light, the edges, and an uneven sheet.
      const side = 0.5 + 0.5 * (((x / width) - 0.5) * lx + ((y / height) - 0.5) * ly) * 2
      const edge = Math.exp(-edgeDistanceMm(x, y, surface) / 9)
      const exposure = clamp01(0.35 * side + 0.4 * edge + 0.35 * mottle[p])
      if (surface.opaque) {
        const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255
        const paperness = smoothstep(0.55, 0.9, lum)
        // Paper yellows; ink on it fades toward the yellowing paper.
        const yellowing = a * (0.15 + 0.6 * exposure) * paperness
        const fade = a * 0.35 * exposure * (1 - paperness)
        for (let c = 0; c < 3; c++) {
          let value = data[i + c]
          value += (yellow[c] - value) * yellowing
          value += (surface.paper[c] * 0.6 + yellow[c] * 0.4 - value) * fade
          data[i + c] = Math.round(value)
        }
        // Foxing: rust spots on the paper, clustered where the sheet was damp.
        if (spots && spotField) {
          const t = 1 - a * 0.16 * (0.4 + spotField[p])
          const spot = smoothstep(t, t + 0.03, spots[p]) * paperness
          if (spot > 0) for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] + (fox[c] - data[i + c]) * spot * 0.45)
        }
      } else if (data[i + 3] > 0) {
        // Ink alone: it thins and warms — black goes to a brown-grey.
        const fade = a * (0.15 + 0.55 * exposure)
        for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] + (warmInk[c] - data[i + c]) * fade * 0.6)
        data[i + 3] = Math.round(data[i + 3] * (1 - fade * 0.45))
      }
    }
  }
}

/** Long streaks along one direction: smooth noise stretched along the rub. */
function streakField(width: number, height: number, angle: number, lengthPx: number, widthPx: number, random: () => number) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const corners = [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ].map(([x, y]) => ({ u: x * cos + y * sin, v: -x * sin + y * cos }))
  const u0 = Math.min(...corners.map((c) => c.u))
  const v0 = Math.min(...corners.map((c) => c.v))
  const cols = Math.ceil((Math.max(...corners.map((c) => c.u)) - u0) / lengthPx) + 3
  const rows = Math.ceil((Math.max(...corners.map((c) => c.v)) - v0) / widthPx) + 3
  const grid = new Float32Array(cols * rows)
  for (let i = 0; i < grid.length; i++) grid[i] = random()
  const out = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const gu = (x * cos + y * sin - u0) / lengthPx
      const gv = (-x * sin + y * cos - v0) / widthPx
      const c0 = Math.floor(gu)
      const r0 = Math.floor(gv)
      const fu = gu - c0
      const fv = gv - r0
      const su = fu * fu * (3 - 2 * fu)
      const sv = fv * fv * (3 - 2 * fv)
      const a = grid[r0 * cols + c0]
      const b = grid[r0 * cols + c0 + 1]
      const c = grid[(r0 + 1) * cols + c0]
      const d = grid[(r0 + 1) * cols + c0 + 1]
      out[y * width + x] = a + (b - a) * su + (c - a + (a - b + d - c) * su) * sv
    }
  }
  return out
}

export function abradeSurface(surface: SurfaceRaster, intensity: number, random: () => number) {
  const strength = clamp01(intensity)
  if (strength <= 0) return
  const { width, height, pxPerMm } = surface
  const mm = Math.max(0.05, pxPerMm)
  // One rubbing direction, the way a sleeve or a thumb goes back and forth.
  const angle = random() * Math.PI
  const streaks = streakField(width, height, angle, Math.max(8, 40 * mm), Math.max(2, 3.5 * mm), random)
  const release = releaseField(width, height, mm, random)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      // Edges and corners stand proud and take the most wear.
      const edge = Math.exp(-edgeDistanceMm(x, y, surface) / 6)
      const pressure = clamp01(strength * (0.15 + 0.85 * streaks[p] + 0.35 * edge))
      const t = 1 - pressure
      const worn = smoothstep(t - 0.06, t + 0.06, release[p])
      // Worn coating shows white fibre, a shade brighter than the sheet.
      removeInk(surface, p * 4, worn * 0.92, surface.paper.map((c) => Math.min(255, c + 6)) as [number, number, number])
    }
  }
}

export function erodeInk(surface: SurfaceRaster, amount: number, random: () => number) {
  const a = clamp01(amount)
  if (a <= 0) return
  const { width, height, pxPerMm } = surface
  const mm = Math.max(0.05, pxPerMm)
  const ink = inkPlane(surface)
  const spread = boxBlur(ink, width, height, Math.max(1, 0.7 * mm))
  const chips = valueNoise(width, height, Math.max(2, 0.9 * mm), random)
  const release = releaseField(width, height, mm, random)
  for (let p = 0; p < ink.length; p++) {
    if (ink[p] < 0.05) continue
    // Near an edge of the ink the blurred coverage drops below full.
    const nearEdge = clamp01((1 - spread[p]) * 2.2)
    const t = 1 - a * 0.7
    const chipped = smoothstep(t - 0.05, t + 0.05, nearEdge * 0.65 + chips[p] * 0.25 + release[p] * 0.2)
    const pinhole = smoothstep(1 - a * 0.1, 1 - a * 0.1 + 0.03, release[p])
    removeInk(surface, p * 4, Math.max(chipped, pinhole))
  }
}
