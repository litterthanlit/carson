/**
 * Progressive refinement for deep zoom.
 *
 * The on-screen backing store is capped (see backstoreScale.ts) so huge posters
 * stay inside browser canvas limits; past that cap, zooming in shows a slightly
 * soft image. Once the canvas settles, this renders just the visible viewport at
 * full device resolution and lays it over the base canvas — between Fabric's lower
 * (art) and upper (selection controls) canvases, so handles stay on top.
 *
 * Any new render of the base canvas, a pointer-down, or a scroll/zoom hides the
 * detail layer until the next idle refresh, so it is never stale.
 */
import type { Canvas } from 'fabric'

export type DetailViewport = {
  /** Visible region in poster px. */
  left: number
  top: number
  width: number
  height: number
  /** CSS px per poster px. */
  scale: number
  dpr: number
}

export type DetailOverlay = {
  invalidate: () => void
  dispose: () => void
}

const SETTLE_MS = 140
/** Keep the detail render bounded even on very large, very dense displays. */
const MAX_DETAIL_PIXELS = 20_000_000

/** Whether the base canvas is already sharp at this zoom (within 2%). */
export function needsDetail(backstoreScale: number, displayScale: number, dpr: number): boolean {
  return backstoreScale < displayScale * dpr * 0.98
}

export function installDetailOverlay(canvas: Canvas, getViewport: () => DetailViewport | null): DetailOverlay {
  let layer: HTMLCanvasElement | null = null
  let timer: number | null = null
  let pointerDown = false
  let refreshing = false
  let disposed = false

  const hide = () => {
    if (layer) layer.style.visibility = 'hidden'
  }

  const schedule = () => {
    if (disposed) return
    hide()
    if (timer != null) window.clearTimeout(timer)
    timer = window.setTimeout(refresh, SETTLE_MS)
  }

  const refresh = () => {
    timer = null
    if (disposed) return
    if (pointerDown) {
      schedule()
      return
    }
    const viewport = getViewport()
    if (!viewport || viewport.width <= 0 || viewport.height <= 0) return hide()
    if (!needsDetail(canvas.getRetinaScaling(), viewport.scale, viewport.dpr)) return hide()
    let multiplier = viewport.scale * viewport.dpr
    const pixels = viewport.width * viewport.height * multiplier * multiplier
    if (pixels > MAX_DETAIL_PIXELS) multiplier *= Math.sqrt(MAX_DETAIL_PIXELS / pixels)

    refreshing = true
    let rendered: HTMLCanvasElement
    try {
      rendered = canvas.toCanvasElement(multiplier, {
        left: viewport.left,
        top: viewport.top,
        width: viewport.width,
        height: viewport.height,
      })
    } catch {
      refreshing = false
      return hide()
    } finally {
      refreshing = false
    }
    rendered.className = 'detail-overlay'
    Object.assign(rendered.style, {
      position: 'absolute',
      pointerEvents: 'none',
      left: `${viewport.left * viewport.scale}px`,
      top: `${viewport.top * viewport.scale}px`,
      width: `${viewport.width * viewport.scale}px`,
      height: `${viewport.height * viewport.scale}px`,
      visibility: 'visible',
    })
    const lower = canvas.lowerCanvasEl
    if (layer) layer.replaceWith(rendered)
    else lower.after(rendered)
    layer = rendered
  }

  const onAfterRender = (event: { ctx?: CanvasRenderingContext2D }) => {
    // toCanvasElement renders through the same pipeline; ignore our own renders.
    if (refreshing) return
    if (event?.ctx && event.ctx !== canvas.getContext()) return
    schedule()
  }
  const onDown = () => {
    pointerDown = true
    hide()
  }
  const onUp = () => {
    pointerDown = false
    schedule()
  }

  canvas.on('after:render', onAfterRender as never)
  canvas.on('mouse:down', onDown)
  canvas.on('mouse:up', onUp)

  return {
    invalidate: schedule,
    dispose: () => {
      disposed = true
      if (timer != null) window.clearTimeout(timer)
      canvas.off('after:render', onAfterRender as never)
      canvas.off('mouse:down', onDown)
      canvas.off('mouse:up', onUp)
      layer?.remove()
      layer = null
    },
  }
}
