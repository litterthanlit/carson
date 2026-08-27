/**
 * Print export helpers (Horizon 2.6) — PDF page geometry, printer's marks, TIFF.
 * jsPDF stays behind a dynamic import so first paint stays light.
 */
import { PRINT_SLUG_MM } from './printGuides'

export type PrintPageLayout = {
  trimWidthMm: number
  trimHeightMm: number
  bleedMm: number
  slugMm: number
  pageWidthMm: number
  pageHeightMm: number
  artworkLeftMm: number
  artworkTopMm: number
  trimLeftMm: number
  trimTopMm: number
  trimRightMm: number
  trimBottomMm: number
}

export type CropMarkLine = { x1: number; y1: number; x2: number; y2: number }
export type RegistrationTarget = { x: number; y: number; radius: number }

export const CROP_MARK_MM = 5

export function pxToMm(px: number, dpi: number) {
  const safeDpi = dpi > 0 ? dpi : 300
  return (px / safeDpi) * 25.4
}

export function printPageLayout(
  widthPx: number,
  heightPx: number,
  dpi: number,
  options?: { bleedMm?: number; slugMm?: number; printerMarks?: boolean },
): PrintPageLayout {
  const trimWidthMm = pxToMm(widthPx, dpi)
  const trimHeightMm = pxToMm(heightPx, dpi)
  const printerMarks = options?.printerMarks ?? false
  const bleedMm = printerMarks ? Math.max(0, options?.bleedMm ?? 0) : 0
  const slugMm = printerMarks ? Math.max(0, options?.slugMm ?? PRINT_SLUG_MM) : 0
  const trimLeftMm = slugMm + bleedMm
  const trimTopMm = slugMm + bleedMm
  return {
    trimWidthMm,
    trimHeightMm,
    bleedMm,
    slugMm,
    pageWidthMm: trimWidthMm + 2 * (bleedMm + slugMm),
    pageHeightMm: trimHeightMm + 2 * (bleedMm + slugMm),
    artworkLeftMm: trimLeftMm,
    artworkTopMm: trimTopMm,
    trimLeftMm,
    trimTopMm,
    trimRightMm: trimLeftMm + trimWidthMm,
    trimBottomMm: trimTopMm + trimHeightMm,
  }
}

/** Crop marks sit in the slug, pointing at trim — never drawn on artwork. */
export function printerMarkGeometry(layout: PrintPageLayout): {
  crop: CropMarkLine[]
  registration: RegistrationTarget[]
} {
  if (layout.slugMm <= 0) return { crop: [], registration: [] }

  const mark = Math.min(CROP_MARK_MM, layout.slugMm - 0.5)
  if (mark <= 0) return { crop: [], registration: [] }

  const { trimLeftMm: left, trimTopMm: top, trimRightMm: right, trimBottomMm: bottom, bleedMm } = layout
  const outer = bleedMm
  const crop: CropMarkLine[] = [
    { x1: left - outer - mark, y1: top, x2: left - outer, y2: top },
    { x1: left, y1: top - outer - mark, x2: left, y2: top - outer },
    { x1: right + outer, y1: top, x2: right + outer + mark, y2: top },
    { x1: right, y1: top - outer - mark, x2: right, y2: top - outer },
    { x1: left - outer - mark, y1: bottom, x2: left - outer, y2: bottom },
    { x1: left, y1: bottom + outer, x2: left, y2: bottom + outer + mark },
    { x1: right + outer, y1: bottom, x2: right + outer + mark, y2: bottom },
    { x1: right, y1: bottom + outer, x2: right, y2: bottom + outer + mark },
  ]

  const radius = 1.6
  const midX = (left + right) / 2
  const midY = (top + bottom) / 2
  const slugCenter = layout.slugMm / 2
  const registration: RegistrationTarget[] = [
    { x: midX, y: slugCenter, radius },
    { x: midX, y: layout.pageHeightMm - slugCenter, radius },
    { x: slugCenter, y: midY, radius },
    { x: layout.pageWidthMm - slugCenter, y: midY, radius },
  ]

  return { crop, registration }
}

export async function downloadPdfFromImageData(
  dataUrl: string,
  fileName: string,
  widthPx: number,
  heightPx: number,
  dpi: number,
  options?: { printerMarks?: boolean; registrationMarks?: boolean; bleedMm?: number },
) {
  const { jsPDF } = await import('jspdf')
  const printerMarks = options?.printerMarks ?? options?.registrationMarks ?? false
  const layout = printPageLayout(widthPx, heightPx, dpi, {
    printerMarks,
    bleedMm: options?.bleedMm,
  })
  const orientation = layout.pageWidthMm >= layout.pageHeightMm ? 'landscape' : 'portrait'
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [layout.pageWidthMm, layout.pageHeightMm],
  })
  pdf.addImage(dataUrl, 'PNG', layout.artworkLeftMm, layout.artworkTopMm, layout.trimWidthMm, layout.trimHeightMm)

  if (printerMarks) {
    const marks = printerMarkGeometry(layout)
    pdf.setDrawColor(0)
    pdf.setLineWidth(0.15)
    for (const line of marks.crop) {
      pdf.line(line.x1, line.y1, line.x2, line.y2)
    }
    for (const target of marks.registration) {
      pdf.circle(target.x, target.y, target.radius, 'S')
      pdf.line(target.x - target.radius - 1.2, target.y, target.x + target.radius + 1.2, target.y)
      pdf.line(target.x, target.y - target.radius - 1.2, target.x, target.y + target.radius + 1.2)
    }
  }

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
  const bytes = new Uint8ClampedArray(buffer)

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
    bytes[cursor++] = rgba[i] ?? 0
    bytes[cursor++] = rgba[i + 1] ?? 0
    bytes[cursor++] = rgba[i + 2] ?? 0
  }

  return new Blob([buffer], { type: 'image/tiff' })
}
