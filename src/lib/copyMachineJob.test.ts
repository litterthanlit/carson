import { describe, expect, it } from 'vitest'
import { applyCopyMachineChain, COPY_MACHINE_DEFAULTS } from './copyMachine'
import { cloneImageDataPixels, runCopyMachineJob } from './copyMachineJob'

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

function fixture(): ImageData {
  const imageData = new ImageData(8, 8)
  for (let i = 0; i < imageData.data.length; i += 4) {
    imageData.data[i] = i % 255
    imageData.data[i + 1] = 40
    imageData.data[i + 2] = 80
    imageData.data[i + 3] = 255
  }
  return imageData
}

describe('copyMachineJob', () => {
  it('matches the main-thread chain for the same seed and params', () => {
    const source = fixture()
    const treatments = [
      { seed: 4719, enabled: true, params: { ...COPY_MACHINE_DEFAULTS } },
    ]
    const direct = applyCopyMachineChain(source, treatments)
    const job = runCopyMachineJob({
      id: 'job-1',
      width: source.width,
      height: source.height,
      pixels: cloneImageDataPixels(source),
      treatments,
      exportScale: 1,
      tensionScale: 1,
    })
    expect(job.width).toBe(direct.width)
    expect(job.height).toBe(direct.height)
    expect(Array.from(new Uint8ClampedArray(job.pixels))).toEqual(Array.from(direct.data))
  })
})
