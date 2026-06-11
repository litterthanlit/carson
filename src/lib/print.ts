/**
 * Print pipeline — bleed/trim guides, export helpers (Horizon 2.6).
 */
import { jsPDF } from 'jspdf'
import { mmToPx } from './document'

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

export function downloadPdfFromImageData(
  dataUrl: string,
  fileName: string,
  widthPx: number,
  heightPx: number,
  dpi: number,
) {
  const widthMm = (widthPx / dpi) * 25.4
  const heightMm = (heightPx / dpi) * 25.4
  const orientation = widthMm >= heightMm ? 'landscape' : 'portrait'
  const pdf = new jsPDF({ orientation, unit: 'mm', format: [widthMm, heightMm] })
  pdf.addImage(dataUrl, 'PNG', 0, 0, widthMm, heightMm)
  pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`)
}

/** Uncompressed RGB TIFF (Horizon 2.6 v1). */
export function rgbaToTiffBlob(width: number, height: number, rgba: Uint8ClampedArray): Blob {
  const headerSize = 8
  const ifdEntries = 10
  const ifdSize = 2 + ifdEntries * 12 + 4
  const stripOffset = headerSize + ifdSize
  const stripSize = width * height * 3
  const buffer = new ArrayBuffer(stripOffset + stripSize)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  view.setUint16(0, 0x4949, true)
  view.setUint32(4, headerSize, true)

  let offset = headerSize
  view.setUint16(offset, ifdEntries, true)
  offset += 2

  const entry = (tag: number, type: number, count: number, value: number) => {
    view.setUint16(offset, tag, true)
    view.setUint16(offset + 2, type, true)
    view.setUint32(offset + 4, count, true)
    view.setUint32(offset + 8, value, true)
    offset += 12
  }

  entry(256, 4, 1, width)
  entry(257, 4, 1, height)
  entry(258, 3, 3, stripOffset - 20)
  entry(259, 3, 1, 1)
  entry(262, 3, 1, 2)
  entry(273, 4, 1, stripOffset)
  entry(277, 3, 1, 3)
  entry(278, 4, 1, height)
  entry(279, 4, 1, stripSize)
  entry(284, 3, 1, 1)

  view.setUint32(offset, 0, true)
  bytes[stripOffset - 20] = 8
  bytes[stripOffset - 19] = 8
  bytes[stripOffset - 18] = 8

  let cursor = stripOffset
  for (let i = 0; i < rgba.length; i += 4) {
    bytes[cursor++] = rgba[i]
    bytes[cursor++] = rgba[i + 1]
    bytes[cursor++] = rgba[i + 2]
  }

  return new Blob([buffer], { type: 'image/tiff' })
}
