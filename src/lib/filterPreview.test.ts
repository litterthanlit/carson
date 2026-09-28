import { describe, expect, it, vi } from 'vitest'
import type { FabricObject } from 'fabric'
import { presetById } from './filterGallery'
import {
  SNAPSHOT_MULTIPLIER,
  clearFilterPreviewCache,
  debounce,
  previewBlendMode,
  previewMultiplier,
  previewPixelRatio,
  renderOriginalPreview,
  scalePreviewParams,
} from './filterPreview'

describe('filterPreview sizing', () => {
  it('renders the long side at the target size, within bounds', () => {
    expect(previewMultiplier(1600, 800, 640)).toBe(0.4)
    expect(previewMultiplier(200, 400, 640)).toBe(1.6)
    // Hairline rules and giant rasters stay within sane limits.
    expect(previewMultiplier(2, 1, 640)).toBe(2)
    expect(previewMultiplier(100_000, 10, 640)).toBe(0.02)
  })

  it('compares preview pixels with the pixels the filter really runs on', () => {
    // Type is snapshotted at 2×, so a 1× preview has half the pixels.
    expect(previewPixelRatio(1, false, 1)).toBe(1 / SNAPSHOT_MULTIPLIER)
    // An image shown at 25% holds 4 element pixels per poster unit.
    expect(previewPixelRatio(0.5, true, 0.25)).toBe(0.125)
    expect(previewPixelRatio(0.5, true, -0.25)).toBe(0.125)
  })

  it('scales only pixel-measured params', () => {
    expect(scalePreviewParams('motion-blur', { distance: 40, angle: 30 }, 0.25)).toEqual({ distance: 10, angle: 30 })
    expect(scalePreviewParams('pixelate', { blocksize: 12 }, 0.5)).toEqual({ blocksize: 6 })
    const gaussian = { radius: 18 }
    expect(scalePreviewParams('gaussian-blur', gaussian, 0.25)).toBe(gaussian)
    expect(scalePreviewParams(undefined, gaussian, 0.25)).toBe(gaussian)
  })

  it('multiplies print treatments over the preview paper', () => {
    expect(previewBlendMode(presetById('xerox-office')!)).toBe('multiply')
    expect(previewBlendMode(presetById('decay-aged')!)).toBe('multiply')
    expect(previewBlendMode(presetById('gaussian-soft')!)).toBeUndefined()
  })
})

describe('debounce', () => {
  it('can be cancelled', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const run = debounce(fn, 100)
    run()
    run.cancel()
    vi.advanceTimersByTime(200)
    expect(fn).not.toHaveBeenCalled()
    run()
    vi.advanceTimersByTime(200)
    expect(fn).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})

describe('renderOriginalPreview', () => {
  it('returns the shared source raster instead of rasterizing again', async () => {
    // Node has no Image; a stand-in that "loads" as soon as it gets a src is enough here.
    class FakeImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      private url = ''
      get src() {
        return this.url
      }
      set src(value: string) {
        this.url = value
        queueMicrotask(() => this.onload?.())
      }
    }
    vi.stubGlobal('Image', FakeImage)
    clearFilterPreviewCache()
    const toDataURL = vi.fn(() => 'data:image/png;base64,ORIGINAL')
    const layer = {
      id: 'layer-1',
      type: 'textbox',
      scaleX: 1,
      getBoundingRect: () => ({ left: 0, top: 0, width: 1280, height: 320 }),
      toDataURL,
    } as unknown as FabricObject

    await expect(renderOriginalPreview(layer, 640)).resolves.toBe('data:image/png;base64,ORIGINAL')
    await expect(renderOriginalPreview(layer, 640)).resolves.toBe('data:image/png;base64,ORIGINAL')
    expect(toDataURL).toHaveBeenCalledTimes(1)
    expect(toDataURL).toHaveBeenCalledWith({ format: 'png', multiplier: 0.5 })

    clearFilterPreviewCache()
    vi.unstubAllGlobals()
  })
})
