/**
 * Frame handles — design-tool selection chrome used as a graphic: a hairline
 * frame, small square handles at its corners and midpoints, and construction
 * lines that run on past the corners to the poster edge. The look of a layout
 * caught mid-edit, the way a screenshot of a design file reads on a poster.
 *
 * A frame is one layer. Its line weight and handle size are in poster pixels and
 * hold still however the frame is resized or stretched, as real chrome does.
 * The frame color is the layer's `fill`, so the ordinary color controls, the
 * palette and the CMYK soft proof all reach it. Clicks fall through the open
 * middle of a frame to the art beneath: only the lines and handles are hit.
 */
import { classRegistry, Rect, util, type StaticCanvas, type TClassProperties } from 'fabric'

export const FRAME_KEY = 'frame'
/** The cyan of screen chrome — the reference poster's frame color. */
export const FRAME_COLOR = '#1aa9d8'

export type FrameHandlePosition = 'tl' | 't' | 'tr' | 'r' | 'br' | 'b' | 'bl' | 'l'
export type FrameExtendSide = 'top' | 'right' | 'bottom' | 'left'
/** Handle interior: see-through, filled with the line color, or knocked out to a flat color. */
export type FrameHandleFill = 'open' | 'solid' | 'knockout'
export type FrameDash = 'solid' | 'dashed' | 'dotted'

export type FrameSpec = {
  /** Line weight, poster px. */
  weight: number
  /** Side of each handle square, poster px. */
  handleSize: number
  /** Which of the eight handle spots carry a square. */
  handles: FrameHandlePosition[]
  handleFill: FrameHandleFill
  /** Handle interior when `handleFill` is `knockout`. */
  knockout: string
  /** Draw the frame's own rectangle (off leaves handles and construction lines only). */
  outline: boolean
  dash: FrameDash
  /** The frame's edge lines run on past the corners to the poster edge, toward these sides. */
  extend: FrameExtendSide[]
}

/** Reading order: clockwise from the top-left corner. */
export const FRAME_HANDLE_POSITIONS: FrameHandlePosition[] = ['tl', 't', 'tr', 'r', 'br', 'b', 'bl', 'l']
export const FRAME_CORNERS: FrameHandlePosition[] = ['tl', 'tr', 'br', 'bl']
export const FRAME_MIDPOINTS: FrameHandlePosition[] = ['t', 'r', 'b', 'l']
export const FRAME_EXTEND_SIDES: FrameExtendSide[] = ['top', 'right', 'bottom', 'left']

const HANDLE_FILLS: FrameHandleFill[] = ['open', 'solid', 'knockout']
const DASHES: FrameDash[] = ['solid', 'dashed', 'dotted']

/** Line weight and handle size scale with the poster: ~2px and ~20px on a 1500px sheet. */
export function frameScaleDefaults(posterWidth: number, posterHeight: number) {
  const long = Math.max(1, posterWidth, posterHeight)
  return {
    weight: Math.max(1, Math.round(long * 0.0014 * 2) / 2),
    handleSize: Math.max(6, Math.round(long * 0.0135)),
  }
}

/** Slider ranges for a poster of this size. */
export function frameRanges(posterWidth: number, posterHeight: number) {
  const long = Math.max(1, posterWidth, posterHeight)
  return {
    weight: { min: 0.5, max: Math.max(4, Math.round(long * 0.008)) },
    handleSize: { min: 2, max: Math.max(24, Math.round(long * 0.05)) },
  }
}

export function defaultFrameSpec(posterWidth: number, posterHeight: number, knockout = '#ffffff'): FrameSpec {
  return {
    ...frameScaleDefaults(posterWidth, posterHeight),
    handles: [...FRAME_CORNERS],
    handleFill: 'knockout',
    knockout,
    outline: true,
    dash: 'solid',
    extend: [],
  }
}

const isColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value)
const finite = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback

/** Keep only known values, in canonical order, without repeats. */
function pickOrdered<T extends string>(value: unknown, order: T[], fallback: T[]): T[] {
  if (!Array.isArray(value)) return [...fallback]
  return order.filter((item) => value.includes(item))
}

/** Validate a stored or pasted spec against a fallback; unknown fields are dropped. */
export function normalizeFrameSpec(raw: unknown, fallback: FrameSpec): FrameSpec {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof FrameSpec, unknown>>
  return {
    weight: finite(value.weight, fallback.weight, 0.25, 1000),
    handleSize: finite(value.handleSize, fallback.handleSize, 0, 4000),
    handles: pickOrdered(value.handles, FRAME_HANDLE_POSITIONS, fallback.handles),
    handleFill: HANDLE_FILLS.includes(value.handleFill as FrameHandleFill) ? (value.handleFill as FrameHandleFill) : fallback.handleFill,
    knockout: isColor(value.knockout) ? value.knockout : fallback.knockout,
    outline: typeof value.outline === 'boolean' ? value.outline : fallback.outline,
    dash: DASHES.includes(value.dash as FrameDash) ? (value.dash as FrameDash) : fallback.dash,
    extend: pickOrdered(value.extend, FRAME_EXTEND_SIDES, fallback.extend),
  }
}

/** Rescale weight and handle size when the poster changes size, so frames keep their look. */
export function rescaleFrameSpec(spec: FrameSpec, factor: number): FrameSpec {
  if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return spec
  return {
    ...spec,
    weight: Math.max(0.5, Math.round(spec.weight * factor * 2) / 2),
    handleSize: Math.max(2, Math.round(spec.handleSize * factor)),
  }
}

/**
 * A new layout of handles and construction lines: corners mostly, an edge
 * midpoint now and then, and lines run out toward one or two sides.
 */
export function shuffleFrameSpec(spec: FrameSpec, random: () => number): FrameSpec {
  const corners = FRAME_CORNERS.filter(() => random() < 0.62)
  if (corners.length === 0) corners.push(FRAME_CORNERS[Math.floor(random() * 4) % 4])
  const midpoints = FRAME_MIDPOINTS.filter(() => random() < 0.12)
  const extend = FRAME_EXTEND_SIDES.filter(() => random() < 0.38)
  if (extend.length === 0 && random() < 0.75) extend.push(FRAME_EXTEND_SIDES[Math.floor(random() * 4) % 4])
  return {
    ...spec,
    handles: FRAME_HANDLE_POSITIONS.filter((position) => corners.includes(position) || midpoints.includes(position)),
    extend: FRAME_EXTEND_SIDES.filter((side) => extend.includes(side)),
  }
}

export type FrameSegment = { x1: number; y1: number; x2: number; y2: number }
export type FrameHandleMark = { position: FrameHandlePosition; x: number; y: number }

/** Handle centers for a w × h frame centered on the origin. */
export function frameHandlePoints(width: number, height: number, handles: FrameHandlePosition[]): FrameHandleMark[] {
  const hx = width / 2
  const hy = height / 2
  const at: Record<FrameHandlePosition, [number, number]> = {
    tl: [-hx, -hy],
    t: [0, -hy],
    tr: [hx, -hy],
    r: [hx, 0],
    br: [hx, hy],
    b: [0, hy],
    bl: [-hx, hy],
    l: [-hx, 0],
  }
  return FRAME_HANDLE_POSITIONS.filter((position) => handles.includes(position)).map((position) => ({
    position,
    x: at[position][0],
    y: at[position][1],
  }))
}

export type FrameRay = { x: number; y: number; dx: number; dy: number }

/**
 * Construction rays for a w × h frame centered on the origin: toward `top`, the
 * two vertical edges run on upward from the top corners; toward `left`, the two
 * horizontal edges run on leftward from the left corners; and so on.
 */
export function frameExtensionRays(width: number, height: number, extend: FrameExtendSide[]): FrameRay[] {
  const hx = width / 2
  const hy = height / 2
  const rays: FrameRay[] = []
  if (extend.includes('top')) rays.push({ x: -hx, y: -hy, dx: 0, dy: -1 }, { x: hx, y: -hy, dx: 0, dy: -1 })
  if (extend.includes('right')) rays.push({ x: hx, y: -hy, dx: 1, dy: 0 }, { x: hx, y: hy, dx: 1, dy: 0 })
  if (extend.includes('bottom')) rays.push({ x: -hx, y: hy, dx: 0, dy: 1 }, { x: hx, y: hy, dx: 0, dy: 1 })
  if (extend.includes('left')) rays.push({ x: -hx, y: -hy, dx: -1, dy: 0 }, { x: -hx, y: hy, dx: -1, dy: 0 })
  return rays
}

export type SceneRect = { left: number; top: number; right: number; bottom: number }

/**
 * Liang–Barsky: the [t0, t1] part of the segment p0→p1 inside `rect`, or null
 * when the segment misses it.
 */
export function clipSegmentToRect(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  rect: SceneRect,
): [number, number] | null {
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  let t0 = 0
  let t1 = 1
  const edges: [number, number][] = [
    [-dx, p0.x - rect.left],
    [dx, rect.right - p0.x],
    [-dy, p0.y - rect.top],
    [dy, rect.bottom - p0.y],
  ]
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null
      continue
    }
    const t = q / p
    if (p < 0) {
      if (t > t1) return null
      if (t > t0) t0 = t
    } else {
      if (t < t0) return null
      if (t < t1) t1 = t
    }
  }
  return t1 - t0 > 1e-9 ? [t0, t1] : null
}

type Interval = [number, number]

/** Remove `cut` from each interval. */
function subtractInterval(intervals: Interval[], cut: Interval): Interval[] {
  const out: Interval[] = []
  for (const [a, b] of intervals) {
    if (cut[1] <= a || cut[0] >= b) {
      out.push([a, b])
      continue
    }
    if (cut[0] > a) out.push([a, cut[0]])
    if (cut[1] < b) out.push([cut[1], b])
  }
  return out
}

/** Cut an axis-aligned segment where it passes through any handle square. */
function cutThroughHandles(segment: FrameSegment, handles: FrameHandleMark[], size: number): FrameSegment[] {
  const half = size / 2
  const horizontal = Math.abs(segment.y1 - segment.y2) < 1e-9
  const along = horizontal ? ([segment.x1, segment.x2] as const) : ([segment.y1, segment.y2] as const)
  const fixed = horizontal ? segment.y1 : segment.x1
  const lo = Math.min(along[0], along[1])
  const hi = Math.max(along[0], along[1])
  let intervals: Interval[] = [[lo, hi]]
  for (const handle of handles) {
    const across = horizontal ? handle.y : handle.x
    if (Math.abs(across - fixed) >= half) continue
    const center = horizontal ? handle.x : handle.y
    intervals = subtractInterval(intervals, [center - half, center + half])
  }
  return intervals
    .filter(([a, b]) => b - a > 1e-6)
    .map(([a, b]) => (horizontal ? { x1: a, y1: fixed, x2: b, y2: fixed } : { x1: fixed, y1: a, x2: fixed, y2: b }))
}

export type FrameGeometry = {
  segments: FrameSegment[]
  handles: FrameHandleMark[]
}

/**
 * Everything a frame draws, in its own unscaled space (centered on the origin).
 * `clipRay` trims a construction ray from its corner to the poster edge and
 * returns the visible [t0, t1] of the ray's `reach`; without it rays stop at `reach`.
 */
export function frameGeometry(
  width: number,
  height: number,
  spec: FrameSpec,
  options: { clipRay?: (from: { x: number; y: number }, to: { x: number; y: number }) => [number, number] | null; reach?: number } = {},
): FrameGeometry {
  const hx = width / 2
  const hy = height / 2
  const segments: FrameSegment[] = []
  if (spec.outline) {
    segments.push(
      { x1: -hx, y1: -hy, x2: hx, y2: -hy },
      { x1: hx, y1: -hy, x2: hx, y2: hy },
      { x1: hx, y1: hy, x2: -hx, y2: hy },
      { x1: -hx, y1: hy, x2: -hx, y2: -hy },
    )
  }
  const reach = options.reach ?? Math.max(width, height) * 4
  for (const ray of frameExtensionRays(width, height, spec.extend)) {
    const from = { x: ray.x, y: ray.y }
    const to = { x: ray.x + ray.dx * reach, y: ray.y + ray.dy * reach }
    const span = options.clipRay ? options.clipRay(from, to) : [0, 1]
    if (!span) continue
    const [t0, t1] = span
    segments.push({
      x1: from.x + (to.x - from.x) * t0,
      y1: from.y + (to.y - from.y) * t0,
      x2: from.x + (to.x - from.x) * t1,
      y2: from.y + (to.y - from.y) * t1,
    })
  }
  const handles = spec.handleSize > 0 ? frameHandlePoints(width, height, spec.handles) : []
  // Open handles are windows: the lines stop at their edge so the art shows through.
  const visible =
    spec.handleFill === 'open' && handles.length > 0
      ? segments.flatMap((segment) => cutThroughHandles(segment, handles, spec.handleSize))
      : segments
  return { segments: visible, handles }
}

/**
 * Dash pattern for square-capped lines (a cap adds half the weight to each end
 * of every dash, so dashes are drawn one weight short). Dotted is zero-length
 * dashes: square dots one weight across.
 */
export function frameDashPattern(dash: FrameDash, weight: number): number[] {
  if (dash === 'dashed') return [weight * 4, weight * 5]
  if (dash === 'dotted') return [0, weight * 2.5]
  return []
}

/** Rectangle from a drag. Shift makes it square, Alt draws it out from the anchor. */
export function frameRectFromDrag(
  anchor: { x: number; y: number },
  current: { x: number; y: number },
  options: { square?: boolean; fromCenter?: boolean } = {},
) {
  let dx = current.x - anchor.x
  let dy = current.y - anchor.y
  if (options.square) {
    const side = Math.max(Math.abs(dx), Math.abs(dy))
    dx = Math.sign(dx || 1) * side
    dy = Math.sign(dy || 1) * side
  }
  if (options.fromCenter) {
    return { left: anchor.x - Math.abs(dx), top: anchor.y - Math.abs(dy), width: Math.abs(dx) * 2, height: Math.abs(dy) * 2 }
  }
  return {
    left: Math.min(anchor.x, anchor.x + dx),
    top: Math.min(anchor.y, anchor.y + dy),
    width: Math.abs(dx),
    height: Math.abs(dy),
  }
}

/** Snap one coordinate to the nearest target within `threshold`. */
export function snapToTargets(value: number, targets: number[], threshold: number): { value: number; guide: number | null } {
  let best: number | null = null
  for (const target of targets) {
    if (Math.abs(target - value) > threshold) continue
    if (best === null || Math.abs(target - value) < Math.abs(best - value)) best = target
  }
  return best === null ? { value, guide: null } : { value: best, guide: best }
}

/**
 * The frame that sits exactly on a layer: its four scene corners [tl, tr, br, bl]
 * give the size; the layer's angle turns the frame with it.
 */
export function frameBoxForCorners(
  corners: { x: number; y: number }[],
  angle: number,
): { left: number; top: number; width: number; height: number; angle: number } {
  const [tl, tr, , bl] = corners
  const width = Math.hypot(tr.x - tl.x, tr.y - tl.y)
  const height = Math.hypot(bl.x - tl.x, bl.y - tl.y)
  // Left/top origin: the frame pivots on its top-left corner, so place that corner on the layer's.
  const radians = (angle * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const cx = (corners[0].x + corners[2].x) / 2
  const cy = (corners[0].y + corners[2].y) / 2
  return {
    left: cx - (width / 2) * cos + (height / 2) * sin,
    top: cy - (width / 2) * sin - (height / 2) * cos,
    width,
    height,
    angle,
  }
}

type FrameHandlesOptions = Partial<TClassProperties<Rect>> & { frame?: Partial<FrameSpec> }

/** A canvas's visible scene rectangle (the poster, or one tile while exporting). */
function sceneRectOf(canvas: StaticCanvas | undefined): SceneRect | null {
  if (!canvas) return null
  const [a, , , d, e, f] = canvas.viewportTransform
  const zoomX = a || 1
  const zoomY = d || 1
  const left = -e / zoomX
  const top = -f / zoomY
  return { left, top, right: left + canvas.width / zoomX, bottom: top + canvas.height / zoomY }
}

const escapeAttr = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
const num = (value: number) => String(Math.round(value * 1000) / 1000)

export class FrameHandles extends Rect {
  static type = 'FrameHandles'
  /** Always serialized, whatever property list the caller passes (clone, history, save). */
  static customProperties = [FRAME_KEY]

  declare frame: FrameSpec

  constructor(options: FrameHandlesOptions = {}) {
    const { frame, ...rest } = options
    super({
      fill: FRAME_COLOR,
      // The frame draws its own lines; a stroke here would only pad the bounding box.
      stroke: null,
      strokeWidth: 0,
      // Handles and construction lines reach past the bounds a cache canvas would clip to.
      objectCaching: false,
      // Hit only on lines and handles (see `_render`): clicks inside reach the art beneath.
      perPixelTargetFind: true,
      ...rest,
    })
    this.frame = normalizeFrameSpec(frame, defaultFrameSpec(1500, 1500))
  }

  shouldCache() {
    return false
  }

  /** Construction lines reach the poster edge from anywhere, so never cull an extended frame. */
  isOnScreen() {
    return this.frame.extend.length > 0 || super.isOnScreen()
  }

  /** Line color: the layer's fill (a gradient fill falls back to the default cyan). */
  frameColor() {
    return typeof this.fill === 'string' && this.fill ? this.fill : FRAME_COLOR
  }

  /** Geometry in this frame's unscaled space, construction lines trimmed to `rect`. */
  geometryWithin(rect: SceneRect | null): FrameGeometry & { width: number; height: number } {
    const sx = Math.abs(this.scaleX || 1)
    const sy = Math.abs(this.scaleY || 1)
    const width = (this.width ?? 0) * sx
    const height = (this.height ?? 0) * sy
    const matrix = this.calcTransformMatrix()
    const toScene = (point: { x: number; y: number }) => util.transformPoint({ x: point.x / sx, y: point.y / sy }, matrix)
    const reach = rect ? 4 * (rect.right - rect.left + rect.bottom - rect.top) + 4 * (width + height) : undefined
    const geometry = frameGeometry(width, height, this.frame, {
      reach,
      clipRay: rect ? (from, to) => clipSegmentToRect(toScene(from), toScene(to), rect) : undefined,
    })
    return { ...geometry, width, height }
  }

  _render(ctx: CanvasRenderingContext2D) {
    const spec = this.frame
    const sx = Math.abs(this.scaleX || 1)
    const sy = Math.abs(this.scaleY || 1)
    ctx.save()
    // Draw in poster pixels whatever the frame's scale: weights and handles never stretch.
    ctx.scale(1 / sx, 1 / sy)
    const canvas = this.canvas as (StaticCanvas & { pixelFindContext?: CanvasRenderingContext2D }) | undefined
    const hitTest = Boolean(canvas && ctx === canvas.pixelFindContext)
    const { segments, handles } = this.geometryWithin(sceneRectOf(canvas))
    // While hit-testing, lines and handles widen to a band about a selection handle across.
    const slop = hitTest ? Math.max(this.cornerSize || 13, 2) * 0.7 : 0
    // Hit-testing reads alpha, so paint opaque whatever the frame's color.
    const color = hitTest ? '#000000' : this.frameColor()
    const weight = Math.max(spec.weight, slop * 2)
    if (segments.length > 0) {
      ctx.beginPath()
      for (const segment of segments) {
        ctx.moveTo(segment.x1, segment.y1)
        ctx.lineTo(segment.x2, segment.y2)
      }
      ctx.lineWidth = weight
      ctx.lineCap = 'square'
      ctx.lineJoin = 'miter'
      ctx.strokeStyle = color
      ctx.setLineDash(hitTest ? [] : frameDashPattern(spec.dash, spec.weight))
      ctx.stroke()
      ctx.setLineDash([])
    }
    const size = Math.max(spec.handleSize, slop * 2)
    for (const handle of handles) {
      const x = handle.x - size / 2
      const y = handle.y - size / 2
      if (hitTest || spec.handleFill === 'solid') {
        ctx.fillStyle = color
        ctx.fillRect(x, y, size, size)
      } else if (spec.handleFill === 'knockout') {
        ctx.fillStyle = spec.knockout
        ctx.fillRect(x, y, size, size)
      }
      if (!hitTest) {
        ctx.lineWidth = spec.weight
        ctx.strokeStyle = color
        ctx.strokeRect(x, y, size, size)
      }
    }
    ctx.restore()
  }

  _toSVG(): string[] {
    const spec = this.frame
    const sx = Math.abs(this.scaleX || 1)
    const sy = Math.abs(this.scaleY || 1)
    const { segments, handles } = this.geometryWithin(sceneRectOf(this.canvas as StaticCanvas | undefined))
    const color = escapeAttr(this.frameColor())
    const markup = ['<g ', 'COMMON_PARTS', '>\n', `<g transform="scale(${1 / sx} ${1 / sy})">\n`]
    if (segments.length > 0) {
      const d = segments.map((s) => `M${num(s.x1)} ${num(s.y1)}L${num(s.x2)} ${num(s.y2)}`).join('')
      const dash = frameDashPattern(spec.dash, spec.weight)
      markup.push(
        `<path d="${d}" fill="none" stroke="${color}" stroke-width="${num(spec.weight)}" stroke-linecap="square"`,
        dash.length ? ` stroke-dasharray="${dash.map(num).join(' ')}"` : '',
        ' />\n',
      )
    }
    const fill = spec.handleFill === 'solid' ? color : spec.handleFill === 'knockout' ? escapeAttr(spec.knockout) : 'none'
    for (const handle of handles) {
      const half = spec.handleSize / 2
      markup.push(
        `<rect x="${num(handle.x - half)}" y="${num(handle.y - half)}" width="${num(spec.handleSize)}" height="${num(spec.handleSize)}" fill="${fill}" stroke="${color}" stroke-width="${num(spec.weight)}" />\n`,
      )
    }
    markup.push('</g>\n</g>\n')
    return markup
  }
}

classRegistry.setClass(FrameHandles)

export function isFrameHandles(object: unknown): object is FrameHandles {
  return object instanceof FrameHandles
}

export function readFrameSpec(object: unknown): FrameSpec | undefined {
  return isFrameHandles(object) ? object.frame : undefined
}
