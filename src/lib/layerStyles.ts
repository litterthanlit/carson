/**
 * Layer styles: drop shadow, outer glow, and outline as live, stackable effects.
 *
 * Fabric supports a single `shadow` per object. To stack effects (and to outline
 * images, text, and vectors alike) each effect is rendered as a *shadow-only pass*:
 * the object is drawn far outside the canvas with a shadow offset that lands the
 * shadow exactly under the object. Only the shadow is visible; the object itself
 * then renders normally on top. Passes reuse the object's render cache, so each one
 * costs a single `drawImage` for cached layers.
 *
 * Styles live on the object as `layerStyle` (serialized with the document), so they
 * survive save, undo, variants, and export — and never bake into pixels.
 */
import { FabricObject } from 'fabric'

export type DropShadowStyle = {
  enabled: boolean
  color: string
  /** 0–1 */
  opacity: number
  /** Poster px */
  blur: number
  /** Poster px */
  distance: number
  /** Degrees, 0 = light from the left (shadow falls right), 90 = light from the top. */
  angle: number
}

export type OuterGlowStyle = {
  enabled: boolean
  color: string
  opacity: number
  /** Poster px */
  size: number
}

export type OutlineStyle = {
  enabled: boolean
  color: string
  opacity: number
  /** Poster px */
  width: number
}

export type LayerStyle = {
  dropShadow?: DropShadowStyle
  outerGlow?: OuterGlowStyle
  outline?: OutlineStyle
}

export type LayerStyleKind = keyof LayerStyle

export const LAYER_STYLE_KEY = 'layerStyle'

export const LAYER_STYLE_DEFAULTS: Required<{ [K in LayerStyleKind]: NonNullable<LayerStyle[K]> }> = {
  dropShadow: { enabled: true, color: '#000000', opacity: 0.45, blur: 24, distance: 18, angle: 120 },
  outerGlow: { enabled: true, color: '#05b6d4', opacity: 0.8, size: 32 },
  outline: { enabled: true, color: '#111111', opacity: 1, width: 6 },
}

/**
 * Effect sizes are in poster px, so a 300dpi A3 (3508px wide) needs ~3× the pixels
 * of a 1080px Instagram post for the same visual weight. Scale relative to 1080.
 */
export function layerStyleScale(posterWidth: number, posterHeight: number): number {
  const shortSide = Math.min(posterWidth, posterHeight)
  return Number.isFinite(shortSide) && shortSide > 0 ? Math.max(0.5, shortSide / 1080) : 1
}

export function scaledLayerStyleDefaults(scale: number): typeof LAYER_STYLE_DEFAULTS {
  const k = scale > 0 ? scale : 1
  const d = LAYER_STYLE_DEFAULTS
  return {
    dropShadow: { ...d.dropShadow, blur: Math.round(d.dropShadow.blur * k), distance: Math.round(d.dropShadow.distance * k) },
    outerGlow: { ...d.outerGlow, size: Math.round(d.outerGlow.size * k) },
    outline: { ...d.outline, width: Math.max(1, Math.round(d.outline.width * k)) },
  }
}

/** One shadow-only draw of the object. Offsets and blur are in poster px. */
export type ShadowPass = {
  color: string
  blur: number
  offsetX: number
  offsetY: number
}

type StyledObject = { [LAYER_STYLE_KEY]?: LayerStyle | null }

export function readLayerStyle(object: unknown): LayerStyle | null {
  const style = (object as StyledObject | null)?.[LAYER_STYLE_KEY]
  return style && typeof style === 'object' ? style : null
}

export function writeLayerStyle(object: FabricObject, style: LayerStyle | null) {
  const next = style && hasAnyStyle(style) ? style : null
  ;(object as unknown as StyledObject)[LAYER_STYLE_KEY] = next
  // Shadows extend past the object's box; mark dirty so caches and the canvas repaint.
  object.set({ dirty: true } as Partial<FabricObject>)
}

export function hasAnyStyle(style: LayerStyle | null | undefined): boolean {
  if (!style) return false
  return Boolean(style.dropShadow || style.outerGlow || style.outline)
}

export function hasActivePasses(style: LayerStyle | null | undefined): boolean {
  if (!style) return false
  return Boolean(style.dropShadow?.enabled || style.outerGlow?.enabled || (style.outline?.enabled && style.outline.width > 0))
}

export function toRgba(hex: string, opacity: number): string {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0').slice(0, 6)
  const value = Number.parseInt(full, 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  const a = Math.min(1, Math.max(0, Number.isFinite(opacity) ? opacity : 1))
  return `rgba(${r}, ${g}, ${b}, ${Math.round(a * 1000) / 1000})`
}

/**
 * Expand a style into shadow passes, back to front: glow, drop shadow, outline.
 * The outline is a ring of hard shadows; the ring density scales with width so large
 * outlines stay solid.
 */
export function layerStylePasses(style: LayerStyle | null | undefined): ShadowPass[] {
  if (!style) return []
  const passes: ShadowPass[] = []
  const glow = style.outerGlow
  if (glow?.enabled && glow.size > 0 && glow.opacity > 0) {
    const color = toRgba(glow.color, glow.opacity)
    // Two passes read as a richer glow than one wide, faint blur.
    passes.push({ color, blur: glow.size, offsetX: 0, offsetY: 0 })
    passes.push({ color, blur: glow.size * 0.45, offsetX: 0, offsetY: 0 })
  }
  const shadow = style.dropShadow
  if (shadow?.enabled && shadow.opacity > 0) {
    const radians = (shadow.angle * Math.PI) / 180
    passes.push({
      color: toRgba(shadow.color, shadow.opacity),
      blur: Math.max(0, shadow.blur),
      // Photoshop convention: the angle points at the light, the shadow falls opposite.
      offsetX: -Math.cos(radians) * shadow.distance,
      offsetY: Math.sin(radians) * shadow.distance,
    })
  }
  const outline = style.outline
  if (outline?.enabled && outline.width > 0 && outline.opacity > 0) {
    const color = toRgba(outline.color, outline.opacity)
    const steps = Math.min(48, Math.max(12, Math.ceil((2 * Math.PI * outline.width) / 3)))
    for (let i = 0; i < steps; i += 1) {
      const t = (i / steps) * Math.PI * 2
      passes.push({ color, blur: 0, offsetX: Math.cos(t) * outline.width, offsetY: Math.sin(t) * outline.width })
    }
  }
  return passes
}

/** Poster-px padding needed around the object's box to contain every pass. */
export function layerStyleBleed(style: LayerStyle | null | undefined): number {
  return layerStylePasses(style).reduce(
    (max, pass) => Math.max(max, Math.hypot(pass.offsetX, pass.offsetY) + pass.blur * 1.5),
    0,
  )
}

type RenderableObject = Omit<FabricObject, 'renderCache' | 'drawCacheOnCanvas' | 'drawObject'> & {
  _setupCompositeOperation(ctx: CanvasRenderingContext2D): void
  _setOpacity(ctx: CanvasRenderingContext2D): void
  renderCache(options?: unknown): void
  drawCacheOnCanvas(ctx: CanvasRenderingContext2D): void
  drawObject(ctx: CanvasRenderingContext2D, forClipping: boolean, context: object): void
}

/** Device-space distance the object is pushed off-canvas for shadow-only passes. */
const FAR_DEVICE_PX = 100_000

function drawSilhouette(object: RenderableObject, ctx: CanvasRenderingContext2D) {
  if (object.shouldCache()) {
    object.renderCache()
    object.drawCacheOnCanvas(ctx)
  } else {
    object.drawObject(ctx, false, {})
  }
}

/** Draw one shadow-only pass. `ctx` must carry the canvas-level transform. */
function drawShadowPass(object: RenderableObject, ctx: CanvasRenderingContext2D, pass: ShadowPass, devicePerPoster: number) {
  ctx.save()
  object.transform(ctx)
  object._setOpacity(ctx)
  const local = ctx.getTransform()
  const localScale = Math.hypot(local.a, local.b) || 1
  const far = FAR_DEVICE_PX / localScale
  ctx.translate(-far, 0)
  ctx.shadowColor = pass.color
  ctx.shadowBlur = pass.blur * devicePerPoster
  ctx.shadowOffsetX = local.a * far + pass.offsetX * devicePerPoster
  ctx.shadowOffsetY = local.b * far + pass.offsetY * devicePerPoster
  drawSilhouette(object, ctx)
  ctx.restore()
}

type EffectsCache = {
  key: string
  canvas: HTMLCanvasElement
  /** Buffer origin relative to the object's device-space origin. */
  dx: number
  dy: number
  width: number
  height: number
}

/**
 * Per-object effect rasters. Effects depend on the object's content, style, and
 * linear transform — not its position — so dragging a styled layer just re-blits.
 */
const effectsCache = new WeakMap<object, EffectsCache>()

function objectTransform(object: RenderableObject, ctx: CanvasRenderingContext2D) {
  ctx.save()
  object.transform(ctx)
  const t = ctx.getTransform()
  ctx.restore()
  return t
}

/** Device-space box covering the object plus `pad` device px. */
function deviceBounds(object: RenderableObject, t: DOMMatrix, pad: number) {
  const hx = ((object.width ?? 0) + (object.strokeWidth ?? 0)) / 2
  const hy = ((object.height ?? 0) + (object.strokeWidth ?? 0)) / 2
  const xs: number[] = []
  const ys: number[] = []
  for (const [x, y] of [
    [-hx, -hy],
    [hx, -hy],
    [hx, hy],
    [-hx, hy],
  ]) {
    xs.push(t.a * x + t.c * y + t.e)
    ys.push(t.b * x + t.d * y + t.f)
  }
  const left = Math.floor(Math.min(...xs) - pad)
  const top = Math.floor(Math.min(...ys) - pad)
  return { left, top, width: Math.ceil(Math.max(...xs) + pad) - left, height: Math.ceil(Math.max(...ys) + pad) - top }
}

/** Keep effect buffers bounded (a zoomed-in layer can be far larger than the view). */
const MAX_BUFFER_PIXELS = 16_000_000

/**
 * Render every pass into an offscreen buffer, knock out the layer's own silhouette
 * (Photoshop's "layer knocks out drop shadow"), and composite the result under the
 * layer. Without the knockout, translucent layers show their outline/shadow through
 * their own fill.
 */
function renderLayerStyle(object: RenderableObject, ctx: CanvasRenderingContext2D, passes: ShadowPass[], style: LayerStyle) {
  const base = ctx.getTransform()
  const devicePerPoster = Math.hypot(base.a, base.b) || 1
  const t = objectTransform(object, ctx)
  const pad = layerStyleBleed(style) * devicePerPoster + 2
  let box = deviceBounds(object, t, pad)
  if (box.width <= 0 || box.height <= 0) return

  // Too big to cache whole (deep zoom): render only the part inside the target.
  let cacheable = box.width * box.height <= MAX_BUFFER_PIXELS
  if (!cacheable) {
    const left = Math.max(0, box.left)
    const top = Math.max(0, box.top)
    const right = Math.min(ctx.canvas.width, box.left + box.width)
    const bottom = Math.min(ctx.canvas.height, box.top + box.height)
    box = { left, top, width: right - left, height: bottom - top }
    if (box.width <= 0 || box.height <= 0) return
    cacheable = false
  }

  const key = [
    JSON.stringify(style),
    t.a.toFixed(4),
    t.b.toFixed(4),
    t.c.toFixed(4),
    t.d.toFixed(4),
    devicePerPoster.toFixed(4),
    object.opacity,
    box.width,
    box.height,
  ].join('|')
  let cached = cacheable ? effectsCache.get(object) : undefined
  if (!cached || cached.key !== key || object.dirty) {
    const canvas = cached?.canvas ?? document.createElement('canvas')
    canvas.width = box.width
    canvas.height = box.height
    const bctx = canvas.getContext('2d')
    if (!bctx) return
    bctx.setTransform(base.a, base.b, base.c, base.d, base.e - box.left, base.f - box.top)
    for (const pass of passes) drawShadowPass(object, bctx, pass, devicePerPoster)
    // Knockout: erase where the layer itself will paint, at full strength.
    bctx.globalCompositeOperation = 'destination-out'
    bctx.save()
    object.transform(bctx)
    drawSilhouette(object, bctx)
    bctx.restore()
    bctx.globalCompositeOperation = 'source-over'
    cached = { key, canvas, dx: box.left - t.e, dy: box.top - t.f, width: box.width, height: box.height }
    if (cacheable) effectsCache.set(object, cached)
  }

  ctx.save()
  object._setupCompositeOperation(ctx)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(cached.canvas, Math.round(t.e + cached.dx), Math.round(t.f + cached.dy))
  ctx.restore()
}

let installed = false

/** Wrap `FabricObject.prototype.render` to draw layer-style passes under each object. */
export function installLayerStyleRenderPatch() {
  if (installed) return
  installed = true
  const proto = FabricObject.prototype as unknown as {
    render: (this: RenderableObject, ctx: CanvasRenderingContext2D) => void
    isNotVisible: (this: RenderableObject) => boolean
  }
  const originalRender = proto.render
  proto.render = function renderWithLayerStyles(this: RenderableObject, ctx: CanvasRenderingContext2D) {
    const style = readLayerStyle(this)
    if (style && hasActivePasses(style) && !proto.isNotVisible.call(this)) {
      renderLayerStyle(this as unknown as RenderableObject, ctx, layerStylePasses(style), style)
    }
    originalRender.call(this, ctx)
  }
}
