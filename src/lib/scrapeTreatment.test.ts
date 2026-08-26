import { describe, expect, it } from 'vitest'
import { createPhotocopyNoise, createScrapeMasks } from './editorModel'
import { createSeededRandom } from './random'
import { rasterizeScrapeMask } from './scrapeTreatment'

describe('scrapeTreatment mask', () => {
  it('punches scrape bands as transparent holes without touching source pixels', () => {
    const poster = { width: 200, height: 200 }
    const random = createSeededRandom(42)
    const bands = createScrapeMasks(poster, { count: 3, random })
    const grit = createPhotocopyNoise(poster, { specks: 4, scratches: 1, scanlines: 0, random })
    const image = rasterizeScrapeMask(poster, bands, grit, 80, 80)
    const corner = 3
    expect(image.data[corner]).toBe(255)

    let punched = 0
    for (let i = 3; i < image.data.length; i += 4) {
      if (image.data[i] < 200) punched += 1
    }
    expect(punched).toBeGreaterThan(20)
    expect(punched).toBeLessThan(image.width * image.height * 0.8)
  })

  it('is deterministic for a seed', () => {
    const poster = { width: 120, height: 160 }
    const bandsA = createScrapeMasks(poster, { count: 4, random: createSeededRandom(7) })
    const bandsB = createScrapeMasks(poster, { count: 4, random: createSeededRandom(7) })
    const a = rasterizeScrapeMask(poster, bandsA, [], 40, 50)
    const b = rasterizeScrapeMask(poster, bandsB, [], 40, 50)
    expect(Array.from(a.data)).toEqual(Array.from(b.data))
  })
})
