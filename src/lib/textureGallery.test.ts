import { describe, expect, it } from 'vitest'
import {
  TEXTURE_ASSETS,
  coverScale,
  grayscaleLuminosity,
  layerScale,
  texturePlacementTransform,
  populatedTextureCategories,
  textureById,
  texturesForCategory,
} from './textureGallery'

describe('textureGallery', () => {
  it('ships a populated catalog', () => {
    expect(TEXTURE_ASSETS.length).toBeGreaterThan(0)
  })

  it('has unique texture ids', () => {
    const ids = TEXTURE_ASSETS.map((texture) => texture.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('only lists categories that have textures', () => {
    const populated = populatedTextureCategories()
    for (const category of populated) {
      expect(texturesForCategory(category.id).length).toBeGreaterThan(0)
    }
  })

  it('looks up textures by id when the catalog is populated', () => {
    const first = TEXTURE_ASSETS[0]
    if (!first) {
      expect(textureById('missing')).toBeUndefined()
      return
    }
    expect(textureById(first.id)).toEqual(first)
    expect(textureById('missing')).toBeUndefined()
  })

  it('covers the poster without letterboxing', () => {
    expect(coverScale(1000, 500, 800, 1200)).toBe(2.4)
    expect(coverScale(400, 800, 800, 1200)).toBe(2)
  })

  it('fits a layer inside the poster with headroom', () => {
    expect(layerScale(400, 300, 800, 1200)).toBe(1)
    expect(layerScale(2000, 1000, 800, 1200)).toBeCloseTo(0.288, 3)
  })

  it('centers a cover texture and bleeds it past the short side', () => {
    expect(texturePlacementTransform('cover', 1000, 500, 800, 1200)).toEqual({
      left: (800 - 1000 * 2.4) / 2,
      top: 0,
      scale: 2.4,
      angle: 0,
    })
  })

  it('places a layer texture off-center with a slight tilt', () => {
    expect(texturePlacementTransform('layer', 400, 300, 800, 1200)).toEqual({ left: 96, top: 240, scale: 1, angle: -2 })
  })

  it('desaturates with Fabric’s luminosity weights and keeps alpha', () => {
    const pixels = new Uint8ClampedArray([255, 0, 0, 200, 0, 255, 0, 255, 10, 10, 10, 0])
    grayscaleLuminosity(pixels)
    expect(Array.from(pixels)).toEqual([54, 54, 54, 200, 184, 184, 184, 255, 10, 10, 10, 0])
  })
})
