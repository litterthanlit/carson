import { describe, expect, it } from 'vitest'
import { Rect } from 'fabric'
import { isLiveArtifactStale, markLiveArtifactsFresh } from './liveArtifacts'

describe('live artifacts', () => {
  const lifted = () => {
    const rect = new Rect({ left: 10, top: 10, width: 100, height: 50 })
    rect.set({ treatments: [{ id: 't1', type: 'tape-lift', seed: 4, enabled: true, params: { pressure: 60 } }] } as never)
    return rect
  }

  it('is stale until its companions are made, then fresh', () => {
    const rect = lifted()
    expect(isLiveArtifactStale(rect)).toBe(true)
    markLiveArtifactsFresh(rect)
    expect(isLiveArtifactStale(rect)).toBe(false)
  })

  it('goes stale when the source moves or the treatment is re-tuned', () => {
    const rect = lifted()
    markLiveArtifactsFresh(rect)
    rect.set({ left: 40 })
    expect(isLiveArtifactStale(rect)).toBe(true)
    markLiveArtifactsFresh(rect)
    rect.set({ treatments: [{ id: 't1', type: 'tape-lift', seed: 5, enabled: true, params: { pressure: 60 } }] } as never)
    expect(isLiveArtifactStale(rect)).toBe(true)
  })

  it('ignores layers without an enabled live treatment', () => {
    const plain = new Rect({ width: 10, height: 10 })
    expect(isLiveArtifactStale(plain)).toBe(false)
    plain.set({ treatments: [{ id: 't2', type: 'tape-lift', seed: 1, enabled: false, params: {} }] } as never)
    expect(isLiveArtifactStale(plain)).toBe(false)
  })
})
