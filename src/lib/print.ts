/**
 * Print export helpers (Horizon 2.6) — loaded on demand from export.
 */
import { registrationMarks } from './printGuides'

export async function downloadPdfFromImageData(
  dataUrl: string,
  fileName: string,
  widthPx: number,
  heightPx: number,
  dpi: number,
  options?: { registrationMarks?: boolean },
) {
  const { jsPDF } = await import('jspdf')
  const widthMm = (widthPx / dpi) * 25.4
  const heightMm = (heightPx / dpi) * 25.4
  const orientation = widthMm >= heightMm ? 'landscape' : 'portrait'
  const pdf = new jsPDF({ orientation, unit: 'mm', format: [widthMm, heightMm] })
  pdf.addImage(dataUrl, 'PNG', 0, 0, widthMm, heightMm)
  if (options?.registrationMarks) {
    const inset = 4
    const size = 6
    const marks = registrationMarks(
      { width: widthPx, height: heightPx },
      (inset / widthPx) * widthMm,
      (size / widthPx) * widthMm,
    )
    pdf.setDrawColor(0)
    pdf.setLineWidth(0.2)
    for (const mark of marks) {
      const x = (mark.left / widthPx) * widthMm
      const y = (mark.top / heightPx) * heightMm
      const w = (mark.width / widthPx) * widthMm
      const h = (mark.height / heightPx) * heightMm
      pdf.rect(x, y, w, h, 'F')
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
    bytes[cursor++] = rgba[i]
    bytes[cursor++] = rgba[i + 1]
    bytes[cursor++] = rgba[i + 2]
  }

  return new Blob([buffer], { type: 'image/tiff' })
}
