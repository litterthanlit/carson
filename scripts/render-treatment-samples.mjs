#!/usr/bin/env node
/**
 * Photograph every treatment in the catalog on the seed poster, for the treatment browser's tiles.
 *
 *   npm run dev                                   # in one terminal
 *   npm run render-samples                        # every treatment
 *   npm run render-samples -- scatter ink-loss    # just these
 *
 * Writes public/treatment-samples/<id>.webp. Each sample starts from a fresh seed poster with
 * Math.random seeded from the treatment's id, so a re-render only changes when the treatment does.
 * Set CARSON_URL to point at a dev server on another port, and CHROMIUM_PATH to use a Chromium
 * that Playwright didn't install itself.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const url = process.env.CARSON_URL ?? 'http://localhost:5173/'
const only = process.argv.slice(2)
const size = 240
const outDir = new URL('../public/treatment-samples/', import.meta.url)

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light' })
await page.addInitScript(() => {
  let state = 1
  // Deterministic accidents: the renderer reseeds this before every sample.
  window.__seedRandom = (seed) => {
    state = seed >>> 0 || 1
  }
  Math.random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
})

try {
  await page.goto(url)
  await page.waitForFunction(() => window.__carsonSamples, null, { timeout: 30000 })
  const ids = await page.evaluate(() => window.__carsonSamples.ids)
  const unknown = only.filter((id) => !ids.includes(id))
  if (unknown.length > 0) throw new Error(`Not in the catalog: ${unknown.join(', ')}`)
  await mkdir(outDir, { recursive: true })

  for (const id of only.length > 0 ? only : ids) {
    const seed = [...id].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261)
    await page.evaluate((value) => window.__seedRandom(value), seed)
    await page.evaluate(() => window.__carsonSamples.loadSeed())
    await page.waitForFunction(() => window.__carsonSamples.ready(), null, { timeout: 30000 })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(250)
    const dataUrl = await page.evaluate(([entry, px]) => window.__carsonSamples.render(entry, px), [id, size])
    const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
    await writeFile(new URL(`${id}.webp`, outDir), bytes)
    console.log(`${id}.webp  ${(bytes.length / 1024).toFixed(1)} KB`)
  }
} finally {
  await browser.close()
}
