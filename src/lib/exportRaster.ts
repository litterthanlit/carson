/**
 * Tiled raster export — keeps huge print sizes off a single canvas allocation.
 * Print guides live in after:render chrome and are not painted by toCanvasElement.
 */

export const EXPORT_DEST_TILE = 2048
export const EXPORT_MAX_EDGE = 16384
export const EXPORT_TILE_PIXELS = 8_000_000

export type ExportTileRect = {
  left: number
  top: number
  width: number
  height: number
}

export type TiledExportCanvas = {
  getWidth: () => number
  getHeight: () => number
  toCanvasElement: (
    multiplier?: number,
    options?: { left?: number; top?: number; width?: number; height?: number },
  ) => HTMLCanvasElement
}

export type SvgExportCanvas = {
  toSVG: (options?: { suppressPreamble?: boolean }) => string
}

export function exportPixelSize(width: number, height: number, multiplier: number) {
  return {
    width: Math.max(1, Math.round(width * multiplier)),
    height: Math.max(1, Math.round(height * multiplier)),
  }
}

export function sourceTileSize(multiplier: number, destTile = EXPORT_DEST_TILE) {
  const safeMultiplier = Math.max(0.01, multiplier)
  return Math.max(64, Math.floor(destTile / safeMultiplier))
}

export function shouldTileExport(width: number, height: number, multiplier: number) {
  const dest = exportPixelSize(width, height, multiplier)
  return dest.width > 4096 || dest.height > 4096 || dest.width * dest.height > EXPORT_TILE_PIXELS
}

export function tileRects(width: number, height: number, tile: number): ExportTileRect[] {
  const size = Math.max(1, Math.floor(tile))
  const tiles: ExportTileRect[] = []
  for (let top = 0; top < height; top += size) {
    for (let left = 0; left < width; left += size) {
      tiles.push({
        left,
        top,
        width: Math.min(size, width - left),
        height: Math.min(size, height - top),
      })
    }
  }
  return tiles
}

export function rasterizeCanvasTiled(
  canvas: TiledExportCanvas,
  multiplier = 1,
): HTMLCanvasElement {
  const width = canvas.getWidth()
  const height = canvas.getHeight()
  const dest = exportPixelSize(width, height, multiplier)
  if (dest.width > EXPORT_MAX_EDGE || dest.height > EXPORT_MAX_EDGE) {
    throw new Error('Export exceeds the maximum printable edge')
  }
  if (!shouldTileExport(width, height, multiplier)) {
    return canvas.toCanvasElement(multiplier)
  }

  const output = document.createElement('canvas')
  output.width = dest.width
  output.height = dest.height
  const ctx = output.getContext('2d')
  if (!ctx) throw new Error('Export failed — no 2d context')

  for (const tile of tileRects(width, height, sourceTileSize(multiplier))) {
    const piece = canvas.toCanvasElement(multiplier, tile)
    ctx.drawImage(piece, Math.round(tile.left * multiplier), Math.round(tile.top * multiplier))
  }
  return output
}

export function canvasElementToRgba(element: HTMLCanvasElement): Uint8ClampedArray {
  const ctx = element.getContext('2d')
  if (!ctx) throw new Error('Export failed — no 2d context')
  return ctx.getImageData(0, 0, element.width, element.height).data
}

export function canvasToSvgMarkup(canvas: SvgExportCanvas): string {
  return canvas.toSVG({ suppressPreamble: false })
}
