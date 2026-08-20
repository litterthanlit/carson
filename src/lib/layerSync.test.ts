import { describe, expect, it } from 'vitest'
import {
  endSuppressLayerSync,
  isLayerSyncSuppressed,
  resetLayerSyncSuppress,
  withLayerSyncSuppressed,
} from './layerSync'

describe('layerSync suppress', () => {
  it('nests suppress depth and restores after the batch', async () => {
    resetLayerSyncSuppress()
    expect(isLayerSyncSuppressed()).toBe(false)

    await withLayerSyncSuppressed(async () => {
      expect(isLayerSyncSuppressed()).toBe(true)
      await withLayerSyncSuppressed(() => {
        expect(isLayerSyncSuppressed()).toBe(true)
      })
      expect(isLayerSyncSuppressed()).toBe(true)
    })

    expect(isLayerSyncSuppressed()).toBe(false)
  })

  it('restores suppress state if the batch throws', async () => {
    resetLayerSyncSuppress()
    await expect(
      withLayerSyncSuppressed(async () => {
        throw new Error('bake failed')
      }),
    ).rejects.toThrow('bake failed')
    expect(isLayerSyncSuppressed()).toBe(false)
  })

  it('endSuppressLayerSync does not go negative', () => {
    resetLayerSyncSuppress()
    endSuppressLayerSync()
    expect(isLayerSyncSuppressed()).toBe(false)
  })
})
