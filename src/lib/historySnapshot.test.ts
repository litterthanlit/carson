import { describe, expect, it } from 'vitest'
import {
  historySourcePoolSize,
  internSnapshotSources,
  parseHistorySnapshot,
  resolveSnapshotSources,
  serializeHistorySnapshot,
} from './historySnapshot'

const bigImage = `data:image/png;base64,${'A'.repeat(50_000)}`

function scene() {
  return {
    version: '7',
    objects: [
      { type: 'Image', src: bigImage, left: 1 },
      { type: 'Group', objects: [{ type: 'Image', src: bigImage }], clipPath: { type: 'Image', src: bigImage } },
      { type: 'Image', src: 'https://example.com/a.png' },
      { type: 'Image', src: 'data:image/png;base64,short' },
      { type: 'Textbox', text: 'data:not-an-image-field' },
    ],
  }
}

describe('history snapshot interning', () => {
  it('replaces large data URLs with shared references and restores them', () => {
    const before = historySourcePoolSize()
    const interned = internSnapshotSources(scene())
    const serialized = JSON.stringify(interned)
    expect(serialized.length).toBeLessThan(1000)
    expect(historySourcePoolSize() - before).toBeLessThanOrEqual(1)
    expect(resolveSnapshotSources(interned)).toEqual(scene())
  })

  it('leaves remote URLs, short data URLs, and non-src fields alone', () => {
    const interned = internSnapshotSources(scene()) as ReturnType<typeof scene>
    expect(interned.objects[2].src).toBe('https://example.com/a.png')
    expect(interned.objects[3].src).toBe('data:image/png;base64,short')
    expect(interned.objects[4].text).toBe('data:not-an-image-field')
  })

  it('round-trips through the canvas-facing helpers', () => {
    const canvas = { toObject: () => scene() }
    const snapshot = serializeHistorySnapshot(canvas, [])
    expect(snapshot.length).toBeLessThan(1000)
    expect(parseHistorySnapshot(snapshot)).toEqual(scene())
  })

  it('does not mutate the input', () => {
    const input = scene()
    internSnapshotSources(input)
    expect(input.objects[0].src).toBe(bigImage)
  })
})
