/**
 * Renders warped layers (Distort / mesh Warp) through Fabric's pipeline.
 *
 * The layer's normal output — content, masks, filters, layer styles — is drawn into
 * an offscreen source in its local, unrotated space, then mapped onto the canvas
 * through a tessellated grid of affine-textured triangles. The source is cached
 * against content, style, and scale, so moving or rotating a warped layer only
 * re-maps it. Everything stays live: text is still text, a photo still a photo.
 */
import { FabricObject, util } from 'fabric'
import { isIdentityWarp, tessellateWarp, affineFromTriangles, type Vec, type Warp } from './warp'
import { layerStyleBleed, readLayerStyle } from './layerStyles'

export const WARP_KEY = 'warp'

export function readWarp(object: unknown): Warp | null {
  const warp = (object as { [WARP_KEY]?: Warp } | null)?.[WARP_KEY]
  return warp && typeof warp === 'object' && (warp.type === 'distort' || warp.type === 'mesh') ? warp : null
}

type RenderableObject = FabricObject & {
  isNotVisible(): boolean
  calcTransformMatrix(skipGroup?: boolean): number[]
}

type SourceCache = { key: string; canvas: HTMLCanvasElement }

const sources = new WeakMap<object, SourceCache>()
/** Objects currently rendering their unwarped source (pass straight through). */
const renderingSource = new WeakSet<object>()

/** Keep warp sources bounded even for huge layers at deep zoom. */
const MAX_SOURCE_EDGE = 4096
const MAX_SOURCE_PIXELS = 12_000_000

function renderSource(
  object: RenderableObject,
  inner: (ctx: CanvasRenderingContext2D) => void,
  width: number,
  height: number,
  pad: number,
  k: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil((width + 2 * pad) * k))
  canvas.height = Math.max(1, Math.ceil((height + 2 * pad) * k))
  const ctx = canvas.getContext('2d')!
  // Local (0,0) = layer center → source center; then cancel the layer's own matrix,
  // which the inner render re-applies, leaving pure local space.
  ctx.setTransform(k, 0, 0, k, (pad + width / 2) * k, (pad + height / 2) * k)
  const inverse = util.invertTransform(object.calcTransformMatrix(true) as never) as number[]
  ctx.transform(inverse[0], inverse[1], inverse[2], inverse[3], inverse[4], inverse[5])
  // Blend and opacity are applied once when the warped result is composited;
  // baking opacity here would double it wherever mesh triangles overlap.
  const blend = object.globalCompositeOperation
  const opacity = object.opacity
  object.globalCompositeOperation = 'source-over'
  object.opacity = 1
  // Fabric skips objects outside the current viewport. During a tiled export the
  // viewport is one tile, so a source rendered for a tile that doesn't show the
  // layer came out empty — and was then cached for every other tile.
  const fabricCanvas = object.canvas as { skipOffscreen?: boolean } | undefined
  const skipOffscreen = fabricCanvas?.skipOffscreen
  if (fabricCanvas) fabricCanvas.skipOffscreen = false
  renderingSource.add(object)
  try {
    inner.call(object, ctx)
  } finally {
    renderingSource.delete(object)
    if (fabricCanvas) fabricCanvas.skipOffscreen = skipOffscreen
    object.globalCompositeOperation = blend
    object.opacity = opacity
  }
  return canvas
}

function renderWarped(object: RenderableObject, ctx: CanvasRenderingContext2D, warp: Warp, inner: (ctx: CanvasRenderingContext2D) => void) {
  ctx.save()
  object.transform(ctx)
  const t = ctx.getTransform()
  ctx.restore()

  const stroke = object.strokeWidth ?? 0
  const width = Math.max(1, (object.width ?? 0) + stroke)
  const height = Math.max(1, (object.height ?? 0) + stroke)
  const style = readLayerStyle(object)
  const scale = Math.max(1e-6, (Math.abs(object.scaleX ?? 1) + Math.abs(object.scaleY ?? 1)) / 2)
  const pad = layerStyleBleed(style) / scale + 2
  // Device px per local unit, bounded.
  let k = Math.max(Math.hypot(t.a, t.b), Math.hypot(t.c, t.d), 1e-3)
  const edge = Math.max(width, height) + 2 * pad
  k = Math.min(k, MAX_SOURCE_EDGE / edge, Math.sqrt(MAX_SOURCE_PIXELS / ((width + 2 * pad) * (height + 2 * pad))))
  // Quantize so tiny zoom changes reuse the cached source.
  k = Math.pow(2, Math.ceil(Math.log2(k) * 4) / 4)


  const padU = pad / width
  const padV = pad / height
  const sourceWidth = Math.ceil((width + 2 * pad) * k)
  const sourceHeight = Math.ceil((height + 2 * pad) * k)
  // Meshes bend, so they need density regardless of zoom; distorts are nearly
  // affine per cell and can go coarser.
  const minCells = warp.type === 'mesh' ? 24 : 8
  const span = Math.max(minCells, Math.min(32, Math.ceil(Math.max(sourceWidth, sourceHeight) / 120)))
  // Aspect-aware grid: near-square cells avoid sliver triangles on thin layers.
  const aspect = (width + 2 * pad) / (height + 2 * pad)
  const cells = aspect >= 1 ? span : Math.max(4, Math.round(span * aspect))
  const rows = aspect >= 1 ? Math.max(4, Math.round(span / aspect)) : span
  const grid = tessellateWarp(warp, cells, padU, padV, rows)
  const toLocal = (p: Vec): Vec => ({ x: (p.x - 0.5) * width, y: (p.y - 0.5) * height })
  const toSource = (p: Vec): Vec => ({ x: (p.x * width + pad) * k, y: (p.y * height + pad) * k })
  // Grow each clip triangle by ~0.75 device px so neighbours overlap (no hairline
  // seams). Overlaps are invisible because triangles are assembled at full opacity
  // in a buffer, which is then composited once at the layer's opacity and blend.
  const grow = 0.75 / Math.max(Math.hypot(t.a, t.b), 1e-3)

  const device = grid.target.map((p) => {
    const l = toLocal(p)
    return { x: t.a * l.x + t.c * l.y + t.e, y: t.b * l.x + t.d * l.y + t.f }
  })
  const left = Math.max(0, Math.floor(Math.min(...device.map((p) => p.x)) - 2))
  const top = Math.max(0, Math.floor(Math.min(...device.map((p) => p.y)) - 2))
  const right = Math.min(ctx.canvas.width, Math.ceil(Math.max(...device.map((p) => p.x)) + 2))
  const bottom = Math.min(ctx.canvas.height, Math.ceil(Math.max(...device.map((p) => p.y)) + 2))
  // Nothing of the warped layer lands on this target (e.g. an export tile): skip.
  if (right <= left || bottom <= top) return

  const key = [JSON.stringify(style), width, height, pad.toFixed(2), k.toFixed(4)].join('|')
  let cached = sources.get(object)
  if (!cached || cached.key !== key || object.dirty) {
    cached = { key, canvas: renderSource(object, inner, width, height, pad, k) }
    sources.set(object, cached)
    object.dirty = false
  }
  const source = cached.canvas

  const bw = right - left
  const bh = bottom - top
  const buffer = warpBuffer(bw, bh)
  const bctx = buffer.getContext('2d')!
  bctx.setTransform(1, 0, 0, 1, 0, 0)
  bctx.clearRect(0, 0, bw, bh)
  bctx.setTransform(t.a, t.b, t.c, t.d, t.e - left, t.f - top)
  const drawTriangle = (s: [Vec, Vec, Vec], d: [Vec, Vec, Vec]) => {
    const ctx = bctx
    const m = affineFromTriangles(s, d)
    if (!m) return
    // Expand about the incenter by (r + grow) / r: every edge moves out by exactly
    // `grow`, even on thin sliver triangles where a centroid push barely moves the
    // long edge (that left light seams).
    const la = Math.hypot(d[1].x - d[2].x, d[1].y - d[2].y)
    const lb = Math.hypot(d[0].x - d[2].x, d[0].y - d[2].y)
    const lc = Math.hypot(d[0].x - d[1].x, d[0].y - d[1].y)
    const perimeter = la + lb + lc
    const area = Math.abs((d[1].x - d[0].x) * (d[2].y - d[0].y) - (d[2].x - d[0].x) * (d[1].y - d[0].y)) / 2
    if (perimeter <= 0 || area <= 0) return
    const ix = (la * d[0].x + lb * d[1].x + lc * d[2].x) / perimeter
    const iy = (la * d[0].y + lb * d[1].y + lc * d[2].y) / perimeter
    const inradius = (2 * area) / perimeter
    // Cap the vertex push at a few pixels so a degenerate triangle can't throw needles.
    const reach = Math.max(...d.map((p) => Math.hypot(p.x - ix, p.y - iy)))
    const expand = Math.min((inradius + grow) / inradius, 1 + (3 * grow) / Math.max(reach, 1e-9))
    ctx.save()
    ctx.beginPath()
    d.forEach((p, index) => {
      const x = ix + (p.x - ix) * expand
      const y = iy + (p.y - iy) * expand
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.clip()
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5])
    ctx.drawImage(source, 0, 0)
    ctx.restore()
  }
  const row = cells + 1
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cells; i += 1) {
      const a = j * row + i
      const b = a + 1
      const c = a + row
      const d = c + 1
      const s = [grid.source[a], grid.source[b], grid.source[c], grid.source[d]].map(toSource)
      const q = [grid.target[a], grid.target[b], grid.target[c], grid.target[d]].map(toLocal)
      drawTriangle([s[0], s[1], s[2]], [q[0], q[1], q[2]])
      drawTriangle([s[1], s[3], s[2]], [q[1], q[3], q[2]])
    }
  }

  ctx.save()
  ctx.globalAlpha *= object.opacity ?? 1
  ctx.globalCompositeOperation = object.globalCompositeOperation ?? 'source-over'
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(buffer, 0, 0, bw, bh, left, top, bw, bh)
  ctx.restore()
}

let sharedBuffer: HTMLCanvasElement | null = null

/** Reused assembly buffer (grows only). */
function warpBuffer(width: number, height: number) {
  sharedBuffer ??= document.createElement('canvas')
  if (sharedBuffer.width < width) sharedBuffer.width = width
  if (sharedBuffer.height < height) sharedBuffer.height = height
  return sharedBuffer
}

let installed = false

/** Must be installed after the layer-style patch so warped sources include styles. */
export function installWarpRenderPatch() {
  if (installed) return
  installed = true
  const proto = FabricObject.prototype as unknown as { render: (this: RenderableObject, ctx: CanvasRenderingContext2D) => void }
  const inner = proto.render
  proto.render = function renderWithWarp(this: RenderableObject, ctx: CanvasRenderingContext2D) {
    const warp = readWarp(this)
    if (!warp || renderingSource.has(this) || isIdentityWarp(warp) || this.isNotVisible()) {
      inner.call(this, ctx)
      return
    }
    renderWarped(this, ctx, warp, inner)
  }
}
