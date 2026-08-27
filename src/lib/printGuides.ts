/**
 * Print guides — bleed/trim/safe rectangles used by the canvas overlay.
 * Kept separate from PDF/TIFF export so jsPDF stays out of the first paint.
 */
import { mmToPx } from './document'

export const PRINT_SLUG_MM = 10

export type PrintGuideKind = 'bleed' | 'trim' | 'safe' | 'registration'

export type PrintGuideRect = {
  kind: PrintGuideKind
  left: number
  top: number
  width: number
  height: number
}

export function buildPrintGuides(
  canvas: { width: number; height: number },
  dpi: number,
  bleedMm: number,
): PrintGuideRect[] {
  const bleed = mmToPx(bleedMm, dpi)
  const safe = bleed + mmToPx(5, dpi)
  return [
    {
      kind: 'bleed',
      left: -bleed,
      top: -bleed,
      width: canvas.width + bleed * 2,
      height: canvas.height + bleed * 2,
    },
    { kind: 'trim', left: 0, top: 0, width: canvas.width, height: canvas.height },
    {
      kind: 'safe',
      left: safe,
      top: safe,
      width: canvas.width - safe * 2,
      height: canvas.height - safe * 2,
    },
  ]
}

export function registrationMarks(
  canvas: { width: number; height: number },
  inset: number,
  size: number,
): Array<{ left: number; top: number; width: number; height: number }> {
  const corners = [
    { left: inset, top: inset },
    { left: canvas.width - inset - size, top: inset },
    { left: inset, top: canvas.height - inset - size },
    { left: canvas.width - inset - size, top: canvas.height - inset - size },
  ]
  return corners.flatMap(({ left, top }) => [
    { left, top: top + size / 2 - 1, width: size, height: 2 },
    { left: left + size / 2 - 1, top, width: 2, height: size },
  ])
}
