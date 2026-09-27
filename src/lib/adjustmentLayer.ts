/**
 * Adjustment layers: non-destructive color adjustments that affect every layer
 * painted beneath them (within the same parent — inside a group they only touch the
 * group's content, like a clipped adjustment in Photoshop).
 *
 * The layer draws nothing itself. When rendered, it reads back the pixels already on
 * the target context under its bounds, applies its adjustment, and writes them back.
 * Because every adjustment is a point operation this is exact on screen, in PNG/PDF
 * export, and across export tiles.
 */
import { classRegistry, Rect, type TClassProperties } from 'fabric'
import { applyAdjustment, defaultAdjustment, type Adjustment } from './adjustments'

export const ADJUSTMENT_KEY = 'adjustment'

type AdjustmentLayerOptions = Partial<TClassProperties<Rect>> & { adjustment?: Adjustment }

export class AdjustmentLayer extends Rect {
  static type = 'AdjustmentLayer'
  /** Always serialized, whatever property list the caller passes (clone, history, save). */
  static customProperties = [ADJUSTMENT_KEY]

  declare adjustment: Adjustment

  constructor(options: AdjustmentLayerOptions = {}) {
    super({
      fill: 'transparent',
      strokeWidth: 0,
      objectCaching: false,
      // Picked from the Layers panel; clicks on the canvas go to the art beneath.
      evented: false,
      hasControls: false,
      lockMovementX: true,
      lockMovementY: true,
      ...options,
    })
    this.adjustment = options.adjustment ?? defaultAdjustment('levels')
  }


  shouldCache() {
    return false
  }

  render(ctx: CanvasRenderingContext2D) {
    if (this.isNotVisible()) return
    applyAdjustmentLayer(this, ctx)
  }
}

classRegistry.setClass(AdjustmentLayer)

export function isAdjustmentLayer(object: unknown): object is AdjustmentLayer {
  return object instanceof AdjustmentLayer
}

export function readAdjustment(object: unknown): Adjustment | undefined {
  const value = (object as { [ADJUSTMENT_KEY]?: Adjustment } | null)?.[ADJUSTMENT_KEY]
  return value && typeof value === 'object' && 'type' in value ? value : undefined
}

/** Device-space rectangle covered by the layer, clipped to the target canvas. */
function deviceRect(layer: AdjustmentLayer, ctx: CanvasRenderingContext2D) {
  ctx.save()
  layer.transform(ctx)
  const t = ctx.getTransform()
  ctx.restore()
  const hx = (layer.width ?? 0) / 2
  const hy = (layer.height ?? 0) / 2
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
  const left = Math.max(0, Math.floor(Math.min(...xs)))
  const top = Math.max(0, Math.floor(Math.min(...ys)))
  const right = Math.min(ctx.canvas.width, Math.ceil(Math.max(...xs)))
  const bottom = Math.min(ctx.canvas.height, Math.ceil(Math.max(...ys)))
  return { left, top, width: right - left, height: bottom - top }
}

export function applyAdjustmentLayer(layer: AdjustmentLayer, ctx: CanvasRenderingContext2D) {
  const adjustment = readAdjustment(layer)
  if (!adjustment) return
  const rect = deviceRect(layer, ctx)
  if (rect.width <= 0 || rect.height <= 0) return
  let image: ImageData
  try {
    image = ctx.getImageData(rect.left, rect.top, rect.width, rect.height)
  } catch {
    // Tainted canvas (cross-origin image without CORS): leave pixels untouched.
    return
  }
  applyAdjustment(image.data, adjustment, layer.opacity ?? 1)
  ctx.putImageData(image, rect.left, rect.top)
}
