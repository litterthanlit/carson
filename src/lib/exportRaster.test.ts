import { describe, expect, it } from 'vitest'
import {
  exportPixelSize,
  shouldTileExport,
  sourceTileSize,
  tileRects,
} from './exportRaster'

describe('tiled export layout', () => {
  it('scales print pixels for 2x export', () => {
    expect(exportPixelSize(3508, 4961, 2)).toEqual({ width: 7016, height: 9922 })
  })

  it('tiles A3@300dpi instead of allocating one giant canvas', () => {
    expect(shouldTileExport(3508, 4961, 1)).toBe(true)
    expect(shouldTileExport(1080, 1350, 1)).toBe(false)
  })

  it('shrinks source tiles as the export multiplier grows', () => {
    expect(sourceTileSize(1)).toBe(2048)
    expect(sourceTileSize(2)).toBe(1024)
    expect(sourceTileSize(4)).toBe(512)
  })

  it('covers the source without overlapping tiles', () => {
    const tiles = tileRects(5000, 1200, 2048)
    expect(tiles).toHaveLength(3)
    const area = tiles.reduce((sum, tile) => sum + tile.width * tile.height, 0)
    expect(area).toBe(5000 * 1200)
    expect(tiles[0]).toEqual({ left: 0, top: 0, width: 2048, height: 1200 })
    expect(tiles.at(-1)).toEqual({ left: 4096, top: 0, width: 904, height: 1200 })
  })
})
