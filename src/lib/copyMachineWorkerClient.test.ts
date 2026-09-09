import { describe, expect, it } from 'vitest'
import { applyCopyMachineChain, COPY_MACHINE_DEFAULTS } from './copyMachine'
import { applyCopyMachineChainAsync } from './copyMachineWorkerClient'

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

describe('copyMachineWorkerClient', () => {
  it('falls back to the main thread and stays deterministic when Worker is missing', async () => {
    const source = new ImageData(4, 4)
    source.data.fill(180)
    const treatments = [{ seed: 4719, enabled: true, params: { ...COPY_MACHINE_DEFAULTS } }]
    const sync = applyCopyMachineChain(source, treatments)
    const asyncResult = await applyCopyMachineChainAsync(source, treatments)
    expect(Array.from(asyncResult.data)).toEqual(Array.from(sync.data))
  })
})
