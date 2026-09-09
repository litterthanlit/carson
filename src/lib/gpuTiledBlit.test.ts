import { describe, expect, it } from 'vitest'
import { detectBlitBackend } from './gpuTiledBlit'

describe('gpu tiled blit', () => {
  it('falls back to canvas2d when WebGPU is unavailable', () => {
    expect(detectBlitBackend()).toBe('canvas2d')
  })
})
