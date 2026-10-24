/**
 * The press's ink trains as a picture — a guide for placing type on the wet
 * and dry parts of the sheet. Ink-blue where the run went wet, amber where it
 * went dry, clear where it printed clean; the sheet's folds dashed across it.
 * Never exported.
 */
import { pressFolds, pressInkPlane, type Press, type SheetFold } from './press'

export type InkMapOverlay = {
  image: HTMLCanvasElement
  /** Feed direction in degrees, for the arrow drawn beside the map. */
  feedAngle: number
  /** The sheet's folds, drawn as dashed creases. */
  folds: SheetFold[]
}

/** Map resolution: the trains are broad, so a few hundred px covers any sheet. */
export function inkMapSize(press: Pick<Press, 'width' | 'height'>, longEdge = 320): { width: number; height: number } {
  const scale = longEdge / Math.max(press.width, press.height)
  return {
    width: Math.max(2, Math.round(press.width * scale)),
    height: Math.max(2, Math.round(press.height * scale)),
  }
}

const WET = [28, 64, 214] as const
const DRY = [236, 150, 36] as const

/** RGBA pixels of the ink map at `width` × `height`, covering the whole sheet. */
export function inkMapPixels(press: Press, width: number, height: number): Uint8ClampedArray<ArrayBuffer> {
  const trains = pressInkPlane({ press, originX: 0, originY: 0, unit: press.width / width }, width, height)
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let p = 0, i = 0; p < trains.length; p++, i += 4) {
    const value = trains[p]
    const strength = Math.min(1, Math.max(0, (Math.abs(value) - 0.08) / 0.75))
    const eased = strength * strength * (3 - 2 * strength)
    const color = value >= 0 ? WET : DRY
    pixels[i] = color[0]
    pixels[i + 1] = color[1]
    pixels[i + 2] = color[2]
    pixels[i + 3] = Math.round(eased * (value >= 0 ? 150 : 120))
  }
  return pixels
}

export function renderInkMap(press: Press): InkMapOverlay | null {
  if (typeof document === 'undefined') return null
  const { width, height } = inkMapSize(press)
  const image = document.createElement('canvas')
  image.width = width
  image.height = height
  const context = image.getContext('2d')
  if (!context) return null
  context.putImageData(new ImageData(inkMapPixels(press, width, height), width, height), 0, 0)
  return { image, feedAngle: press.feedAngle, folds: pressFolds(press) }
}

/** Draw the map over the poster and a feed arrow in its corner, sized for the screen. */
export function drawInkMap(
  ctx: CanvasRenderingContext2D,
  overlay: InkMapOverlay,
  sheet: { width: number; height: number },
  displayScale: number,
) {
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(overlay.image, 0, 0, sheet.width, sheet.height)
  const unit = 1 / Math.max(1e-3, displayScale)
  ctx.lineWidth = 1.5 * unit
  ctx.strokeStyle = 'rgba(17, 17, 17, 0.55)'
  ctx.setLineDash([8 * unit, 6 * unit])
  for (const fold of overlay.folds ?? []) {
    const tilt = Math.tan((fold.angle * Math.PI) / 180)
    ctx.beginPath()
    if (fold.axis === 'x') {
      ctx.moveTo(fold.position + (0 - sheet.height / 2) * tilt, 0)
      ctx.lineTo(fold.position + (sheet.height / 2) * tilt, sheet.height)
    } else {
      ctx.moveTo(0, fold.position + (0 - sheet.width / 2) * tilt)
      ctx.lineTo(sheet.width, fold.position + (sheet.width / 2) * tilt)
    }
    ctx.stroke()
  }
  const length = 26 * unit
  const cx = 22 * unit + length / 2
  const cy = 22 * unit + length / 2
  const angle = (overlay.feedAngle * Math.PI) / 180
  const ux = Math.cos(angle)
  const uy = Math.sin(angle)
  ctx.lineWidth = 2 * unit
  ctx.strokeStyle = 'rgba(28, 64, 214, 0.9)'
  ctx.fillStyle = 'rgba(28, 64, 214, 0.9)'
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(cx - (ux * length) / 2, cy - (uy * length) / 2)
  ctx.lineTo(cx + (ux * length) / 2, cy + (uy * length) / 2)
  ctx.stroke()
  const head = 7 * unit
  const tipX = cx + (ux * length) / 2
  const tipY = cy + (uy * length) / 2
  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(tipX - ux * head - uy * head * 0.6, tipY - uy * head + ux * head * 0.6)
  ctx.lineTo(tipX - ux * head + uy * head * 0.6, tipY - uy * head - ux * head * 0.6)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}
