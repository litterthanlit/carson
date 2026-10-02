/**
 * Materials — the physical state of the sheet itself.
 *
 * Crumple: a poster that has been folded, balled up and flattened again. Each
 * crease is a fold — a ridge or valley along a line, fading out away from where
 * the hand pressed — and their sum is a faceted relief like real crushed paper.
 * The relief is lit from one side and laid over the poster in hard-light, so it
 * darkens and lightens white paper and print alike.
 */
import { createSeededRandom } from './random'

export type Crease = {
  /** Unit normal of the fold line. */
  nx: number
  ny: number
  /** The fold line passes through (cx, cy). */
  cx: number
  cy: number
  /** Ridge (+) or valley (-) steepness. */
  slope: number
  /** How far along its line the crease runs before it dies out. */
  length: number
  /** How far either side of the line the paper is bent. */
  width: number
}

/**
 * Seeded creases for a sheet of width × height, amount 0–100: two or three
 * long faint folds from when it was folded, then many short wrinkles from
 * when it was balled up — each fading out along its length, as real ones do.
 */
export function crumpleCreases(seed: number, width: number, height: number, amount = 60): Crease[] {
  const random = createSeededRandom(seed)
  const strength = Math.max(0, Math.min(100, amount)) / 100
  const long = Math.max(width, height)
  const creases: Crease[] = []
  const folds = 2 + Math.floor(random() * 2)
  for (let i = 0; i < folds; i++) {
    // Folds run roughly with the sheet: across, down, or corner to corner.
    const angle = Math.floor(random() * 4) * (Math.PI / 4) + (random() - 0.5) * 0.15
    creases.push({
      nx: Math.cos(angle),
      ny: Math.sin(angle),
      cx: width * (0.3 + random() * 0.4),
      cy: height * (0.3 + random() * 0.4),
      slope: (random() < 0.5 ? -1 : 1) * (0.008 + random() * 0.012) * (0.5 + strength),
      length: long * 1.5,
      width: long * 0.6,
    })
  }
  const wrinkles = Math.round(25 + strength * 95)
  for (let i = 0; i < wrinkles; i++) {
    const angle = random() * Math.PI
    const size = long * (0.03 + random() * 0.11)
    creases.push({
      nx: Math.cos(angle),
      ny: Math.sin(angle),
      cx: random() * width,
      cy: random() * height,
      slope: (random() < 0.5 ? -1 : 1) * (0.012 + random() * 0.04) * (0.4 + strength),
      length: size,
      width: size * (0.35 + random() * 0.3),
    })
  }
  return creases
}

/** Height of the crumpled sheet at (x, y). */
export function crumpleHeight(creases: Crease[], x: number, y: number): number {
  let height = 0
  for (const crease of creases) {
    const dx = x - crease.cx
    const dy = y - crease.cy
    const across = dx * crease.nx + dy * crease.ny
    const along = -dx * crease.ny + dy * crease.nx
    const fade = (along * along) / (crease.length * crease.length) + (across * across) / (crease.width * crease.width)
    if (fade > 9) continue
    // A crease is a tent: the paper rises (or sinks) linearly from the crease line.
    height -= crease.slope * Math.abs(across) * Math.exp(-fade)
  }
  return height
}

const LIGHT = (() => {
  // Light from the upper left, fairly low, like a window.
  const lx = -0.55
  const ly = -0.6
  const lz = 0.58
  const norm = Math.hypot(lx, ly, lz)
  return { x: lx / norm, y: ly / norm, z: lz / norm }
})()

/** Shading -1..1 of a surface with gradient (gx, gy): 0 is flat paper. */
export function shadeFromGradient(gx: number, gy: number): number {
  const length = Math.hypot(gx, gy, 1)
  return (-gx * LIGHT.x - gy * LIGHT.y + LIGHT.z) / length - LIGHT.z
}

/**
 * Paint the crumple as a hard-light map: mid grey is untouched paper, lighter
 * faces catch the light, darker faces and crease valleys fall into shadow.
 */
export function paintCrumple(ctx: CanvasRenderingContext2D, width: number, height: number, seed: number, amount = 60) {
  const creases = crumpleCreases(seed, width, height, amount)
  const random = createSeededRandom(seed ^ 0x68e31da4)
  const strength = Math.max(0, Math.min(100, amount)) / 100
  const gain = 150 + strength * 110
  const relief = new Float32Array(width * height)
  // Between creases the sheet never lies flat: a slow, smooth bend.
  const long = Math.max(width, height)
  const bend = [0, 1, 2].map(() => ({
    fx: (1 + random() * 2.5) / long,
    fy: (1 + random() * 2.5) / long,
    phase: random() * Math.PI * 2,
    amp: long * (0.002 + random() * 0.003) * (0.4 + strength),
  }))
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let h = crumpleHeight(creases, x, y)
      for (const wave of bend) h += Math.sin(x * wave.fx * Math.PI * 2 + wave.phase) * Math.cos(y * wave.fy * Math.PI * 2 - wave.phase) * wave.amp
      relief[y * width + x] = h
    }
  }
  const at = (x: number, y: number) =>
    relief[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))]
  const image = ctx.createImageData(width, height)
  const { data } = image
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const gx = (at(x + 1, y) - at(x - 1, y)) / 2
      const gy = (at(x, y + 1) - at(x, y - 1)) / 2
      // Paper tooth so the flat areas aren't dead grey.
      const tooth = (random() - 0.5) * 6
      // Soft-clamped: crushed paper rarely falls darker than a light grey.
      const value = Math.max(0, Math.min(255, 128 + 110 * Math.tanh((shadeFromGradient(gx, gy) * gain) / 110) + tooth))
      const i = (y * width + x) * 4
      data[i] = value
      data[i + 1] = value
      data[i + 2] = Math.max(0, value - 2)
      data[i + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
}
