import { describe, expect, it, beforeEach } from 'vitest'

class ImageDataPolyfill {
  readonly width: number
  readonly height: number
  readonly data: Uint8ClampedArray

  constructor(
    dataOrWidth: Uint8ClampedArray | number,
    widthOrHeight?: number,
    height?: number,
  ) {
    if (typeof dataOrWidth === 'number') {
      this.width = dataOrWidth
      this.height = widthOrHeight ?? dataOrWidth
      this.data = new Uint8ClampedArray(this.width * this.height * 4)
      return
    }
    this.data = dataOrWidth
    this.width = widthOrHeight ?? 0
    this.height = height ?? 0
  }
}

if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = ImageDataPolyfill as typeof ImageData
}
import type { Treatment } from './treatments'
import {
  clearCopyMachineBakeCache,
  copyMachineBakeCacheKey,
  readCopyMachineBakeCache,
  writeCopyMachineBakeCache,
  invalidateCopyMachineBakesForSource,
} from './copyMachineTreatment'

function treatment(overrides: Partial<Treatment> = {}): Treatment {
  return {
    id: 'cm-1',
    type: 'copy-machine',
    seed: 4719,
    enabled: true,
    params: { wobble: 40, ghost: 20 },
    ...overrides,
  }
}

function pixels(fill: number): ImageData {
  const data = new Uint8ClampedArray(8)
  data.fill(fill)
  return new ImageData(data, 2, 1)
}

describe('copyMachine bake cache', () => {
  beforeEach(() => {
    clearCopyMachineBakeCache()
  })

  it('keys by source, seed, params, tension, and export scale', () => {
    const base = copyMachineBakeCacheKey('layer-1', [treatment()], 1, 1)
    expect(copyMachineBakeCacheKey('layer-1', [treatment()], 1, 1)).toBe(base)
    expect(copyMachineBakeCacheKey('layer-2', [treatment()], 1, 1)).not.toBe(base)
    expect(copyMachineBakeCacheKey('layer-1', [treatment({ seed: 99 })], 1, 1)).not.toBe(base)
    expect(copyMachineBakeCacheKey('layer-1', [treatment({ params: { wobble: 10 } })], 1, 1)).not.toBe(base)
    expect(copyMachineBakeCacheKey('layer-1', [treatment()], 2, 1)).not.toBe(base)
    expect(copyMachineBakeCacheKey('layer-1', [treatment()], 1, 0.5)).not.toBe(base)
    expect(copyMachineBakeCacheKey('layer-1', [treatment()], 1, 1, 'text-a')).not.toBe(
      copyMachineBakeCacheKey('layer-1', [treatment()], 1, 1, 'text-b'),
    )
  })

  it('returns a cache hit for the same key and misses after invalidation or param change', () => {
    const key = copyMachineBakeCacheKey('layer-1', [treatment()], 1, 1)
    const baked = pixels(32)
    writeCopyMachineBakeCache(key, { imageData: baked, dataUrl: 'data:image/png;base64,aaa' })

    const hit = readCopyMachineBakeCache(key)
    expect(hit?.dataUrl).toBe('data:image/png;base64,aaa')
    expect(hit?.imageData.data[0]).toBe(32)

    invalidateCopyMachineBakesForSource('layer-1')
    expect(readCopyMachineBakeCache(key)).toBeNull()

    writeCopyMachineBakeCache(key, { imageData: baked, dataUrl: 'data:image/png;base64,aaa' })
    const otherKey = copyMachineBakeCacheKey('layer-1', [treatment({ params: { wobble: 80 } })], 1, 1)
    expect(readCopyMachineBakeCache(otherKey)).toBeNull()
  })
})
