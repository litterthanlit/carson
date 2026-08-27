import { describe, expect, it } from 'vitest'
import { printPageLayout, printerMarkGeometry, pxToMm, rgbaToTiffBlob } from './print'

describe('print page layout', () => {
  it('converts A3 300dpi pixels to millimetres', () => {
    expect(pxToMm(3508, 300)).toBeCloseTo(297, 0)
    expect(pxToMm(4961, 300)).toBeCloseTo(420, 0)
  })

  it('keeps a digital PDF at trim size when marks are off', () => {
    const layout = printPageLayout(3508, 4961, 300, { printerMarks: false, bleedMm: 3 })
    expect(layout.slugMm).toBe(0)
    expect(layout.bleedMm).toBe(0)
    expect(layout.artworkLeftMm).toBe(0)
    expect(layout.pageWidthMm).toBeCloseTo(layout.trimWidthMm)
  })

  it('expands the sheet for bleed and slug so marks never sit on artwork', () => {
    const layout = printPageLayout(3508, 4961, 300, { printerMarks: true, bleedMm: 3 })
    expect(layout.bleedMm).toBe(3)
    expect(layout.slugMm).toBe(10)
    expect(layout.artworkLeftMm).toBe(13)
    expect(layout.pageWidthMm).toBeCloseTo(layout.trimWidthMm + 26)

    const marks = printerMarkGeometry(layout)
    expect(marks.crop).toHaveLength(8)
    expect(marks.registration).toHaveLength(4)
    for (const line of marks.crop) {
      const onArtworkX =
        line.x1 > layout.trimLeftMm &&
        line.x1 < layout.trimRightMm &&
        line.x2 > layout.trimLeftMm &&
        line.x2 < layout.trimRightMm
      const onArtworkY =
        line.y1 > layout.trimTopMm &&
        line.y1 < layout.trimBottomMm &&
        line.y2 > layout.trimTopMm &&
        line.y2 < layout.trimBottomMm
      expect(onArtworkX && onArtworkY).toBe(false)
    }
  })
})

describe('tiff export', () => {
  it('writes a little-endian RGB TIFF header', () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 0, 0, 0, 255])
    const blob = rgbaToTiffBlob(2, 2, rgba)
    expect(blob.type).toBe('image/tiff')
    return blob.arrayBuffer().then((buffer) => {
      const view = new DataView(buffer)
      expect(view.getUint16(0, true)).toBe(0x4949)
      expect(view.getUint16(8, true)).toBe(10)
    })
  })
})
