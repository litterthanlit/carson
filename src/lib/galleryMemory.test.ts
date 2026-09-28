/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FILTER_GALLERY_KEY,
  clearGalleryMemory,
  loadFilterGalleryState,
  loadTextureGalleryState,
  resolveFilterGalleryState,
  resolveTextureGalleryState,
  saveFilterGalleryState,
  saveTextureGalleryState,
} from './galleryMemory'
import { TEXTURE_ASSETS, populatedTextureCategories, texturesForCategory } from './textureGallery'

const categories = populatedTextureCategories()

beforeEach(() => clearGalleryMemory())
afterEach(() => vi.restoreAllMocks())

describe('resolveFilterGalleryState', () => {
  it('restores the remembered filter and clamps its settings to the slider ranges', () => {
    expect(
      resolveFilterGalleryState({ category: 'blur', presetId: 'motion-blur', params: { distance: 999, angle: 90 } }, true),
    ).toEqual({ category: 'blur', presetId: 'motion-blur', params: { distance: 200, angle: 90 } })
  })

  it('ignores unknown and non-numeric params', () => {
    const state = resolveFilterGalleryState({ presetId: 'gaussian-soft', params: { radius: 'x', bogus: 5 } }, true)
    expect(state.params).toEqual({ radius: 18 })
  })

  it('takes the category from the preset, not from stale storage', () => {
    expect(resolveFilterGalleryState({ category: 'wash', presetId: 'contrast' }, true).category).toBe('color')
  })

  it('falls back to the category’s first fitting filter when the remembered one does not fit', () => {
    // Cold wash is image-only; on a text layer the Wash category has nothing else, so it stays shown but unapplied.
    expect(resolveFilterGalleryState({ category: 'wash', presetId: 'cold-wash' }, false)).toMatchObject({
      category: 'wash',
      presetId: 'cold-wash',
    })
    expect(resolveFilterGalleryState({ category: 'print', presetId: 'renamed-preset' }, true)).toEqual({
      category: 'print',
      presetId: 'xerox-light',
      params: { generation: 2 },
    })
  })

  it('opens on Blur › Gaussian with nothing (or garbage) stored', () => {
    for (const saved of [null, 'oops', 42, { category: 'nope' }]) {
      expect(resolveFilterGalleryState(saved, true)).toEqual({
        category: 'blur',
        presetId: 'gaussian-soft',
        params: { radius: 18 },
      })
    }
  })
})

describe('resolveTextureGalleryState', () => {
  const ink = texturesForCategory('ink')
  const inkTexture = ink[2] ?? ink[0]!

  it('restores the texture with the blend, opacity and fit last chosen for it', () => {
    expect(
      resolveTextureGalleryState(
        { category: 'ink', textureId: inkTexture.id, blend: 'screen', opacity: 72, fit: 'layer' },
        categories,
      ),
    ).toEqual({ category: 'ink', textureId: inkTexture.id, blend: 'screen', opacity: 72, fit: 'layer' })
  })

  it('replaces invalid settings with the texture’s own defaults and clamps opacity', () => {
    const state = resolveTextureGalleryState(
      { textureId: inkTexture.id, blend: 'hard-mix', opacity: 400, fit: 'tile' },
      categories,
    )
    expect(state.blend).toBe(inkTexture.defaultBlend)
    expect(state.opacity).toBe(100)
    expect(state.fit).toBe(inkTexture.hasAlpha ? 'layer' : 'cover')
  })

  it('falls back to the remembered category’s first texture when the texture is gone', () => {
    const first = texturesForCategory('paper')[0]!
    expect(resolveTextureGalleryState({ category: 'paper', textureId: 'deleted' }, categories)).toMatchObject({
      category: 'paper',
      textureId: first.id,
      blend: first.defaultBlend,
    })
  })

  it('opens on the first category with nothing stored', () => {
    const first = TEXTURE_ASSETS.find((texture) => texture.category === categories[0]!.id)!
    expect(resolveTextureGalleryState(null, categories)).toMatchObject({ category: categories[0]!.id, textureId: first.id })
  })
})

describe('gallery memory storage', () => {
  it('round-trips through localStorage', () => {
    saveFilterGalleryState({ category: 'color', presetId: 'contrast', params: { amount: -30 } })
    expect(JSON.parse(localStorage.getItem(FILTER_GALLERY_KEY)!)).toMatchObject({ presetId: 'contrast' })
    expect(loadFilterGalleryState(true)).toEqual({ category: 'color', presetId: 'contrast', params: { amount: -30 } })
  })

  it('keeps working for the session when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    const texture = texturesForCategory('grunge')[0]!
    saveTextureGalleryState({ category: 'grunge', textureId: texture.id, blend: 'overlay', opacity: 40, fit: 'cover' })
    expect(loadTextureGalleryState(categories)).toEqual({
      category: 'grunge',
      textureId: texture.id,
      blend: 'overlay',
      opacity: 40,
      fit: 'cover',
    })
  })

  it('ignores corrupt JSON', () => {
    localStorage.setItem(FILTER_GALLERY_KEY, '{not json')
    expect(loadFilterGalleryState(true).presetId).toBe('gaussian-soft')
  })
})
