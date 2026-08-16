import { describe, expect, it } from 'vitest'
import {
  TEXTURE_ASSETS,
  coverScale,
  layerScale,
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
})
