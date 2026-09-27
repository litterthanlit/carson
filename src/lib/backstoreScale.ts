/**
 * Resolution of the on-screen canvas backing store, as a multiple of poster pixels.
 *
 * The poster canvas keeps poster-unit coordinates (a 300dpi A3 is 3508 × 4961) and is
 * CSS-scaled into the viewport. Fabric's default retina scaling allocates
 * poster × devicePixelRatio pixels for both the lower and upper canvas — ~70MP each
 * for A3 on a 2× display — even when the poster is shown at 13%. Every render and
 * every drag frame then rasterizes 140MP just to be downsampled by the browser.
 *
 * Instead we allocate exactly what the screen can show: poster × zoom × DPR, capped
 * at full retina and at a pixel budget that stays inside browser canvas limits.
 * Exports are unaffected — `toCanvasElement` disables retina scaling and renders at
 * the explicit multiplier.
 */

/** Keep each canvas well under the ~268MP Chromium / 16.7MP–67MP WebKit ceilings. */
export const BACKSTORE_MAX_PIXELS = 24_000_000
/** Quantize so small zoom changes (wheel, pinch) don't reallocate on every tick. */
const STEPS_PER_UNIT = 8
const MIN_SCALE = 1 / STEPS_PER_UNIT

export function backstoreScale(
  displayScale: number,
  devicePixelRatio: number,
  posterWidth: number,
  posterHeight: number,
  maxPixels = BACKSTORE_MAX_PIXELS,
): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1
  const zoom = Number.isFinite(displayScale) && displayScale > 0 ? displayScale : 1
  const area = Math.max(1, posterWidth * posterHeight)
  const budget = Math.sqrt(maxPixels / area)
  // Round *up* to the next step so the backing store is never softer than the screen.
  const wanted = Math.ceil(zoom * dpr * STEPS_PER_UNIT) / STEPS_PER_UNIT
  const capped = Math.min(wanted, dpr, budget)
  return Math.max(Math.min(MIN_SCALE, budget), capped)
}

type BackstoreCanvas = {
  getWidth(): number
  getHeight(): number
  setDimensions(size: { width: number; height: number }): void
  getRetinaScaling(): number
  lowerCanvasEl: HTMLCanvasElement
  upperCanvasEl?: HTMLCanvasElement
  getContext(): CanvasRenderingContext2D
  contextTop?: CanvasRenderingContext2D
}

/**
 * Point a Fabric canvas at a dynamic backing-store scale.
 *
 * Fabric's own retina path only engages above 1× (`setCanvasDimensions` ignores
 * scales ≤ 1), so zoomed-out posters would still allocate full poster pixels. We
 * let Fabric size the elements, then shrink them ourselves. Pointer mapping stays
 * correct because Fabric divides by `getRetinaScaling()` and multiplies by
 * `element.width / cssWidth`; text-edit textarea placement uses the same ratio.
 */
export function installDynamicBackstore(canvas: BackstoreCanvas, readScale: () => number) {
  canvas.getRetinaScaling = readScale
  applyBackstore(canvas)
}

export function applyBackstore(canvas: BackstoreCanvas) {
  const width = canvas.getWidth()
  const height = canvas.getHeight()
  canvas.setDimensions({ width, height })
  const scale = canvas.getRetinaScaling()
  if (scale >= 1) return
  const pairs: [HTMLCanvasElement | undefined, CanvasRenderingContext2D | undefined][] = [
    [canvas.lowerCanvasEl, canvas.getContext()],
    [canvas.upperCanvasEl, canvas.contextTop],
  ]
  for (const [element, ctx] of pairs) {
    if (!element || !ctx) continue
    // Resizing resets the context transform; re-apply the scale Fabric expects.
    element.width = Math.max(1, Math.round(width * scale))
    element.height = Math.max(1, Math.round(height * scale))
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
  }
}
