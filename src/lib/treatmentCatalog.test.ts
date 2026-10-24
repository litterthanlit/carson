import { describe, expect, it } from 'vitest'
import {
  CATALOG_CATEGORIES,
  TREATMENT_CATALOG,
  catalogAvailability,
  catalogSamplePath,
  searchCatalog,
  type CatalogEntry,
  type CatalogId,
} from './treatmentCatalog'

const entries = TREATMENT_CATALOG as readonly CatalogEntry[]
// The rendered samples on disk, as '../../public/treatment-samples/<id>.webp'.
const sampleFiles = new Set(Object.keys(import.meta.glob('../../public/treatment-samples/*.webp')))
const onDisk = (path: string) => sampleFiles.has(`../../public/${path}`)

describe('treatment catalog', () => {
  it('has unique ids', () => {
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length)
  })

  it('files every entry under a known category, and leaves no category empty', () => {
    const categories = new Set(CATALOG_CATEGORIES.map((category) => category.id))
    for (const entry of entries) expect(categories.has(entry.category), entry.id).toBe(true)
    for (const category of CATALOG_CATEGORIES) {
      expect(entries.some((entry) => entry.category === category.id), category.id).toBe(true)
    }
  })

  it('has a rendered sample for every tile that shows one (run npm run render-samples)', () => {
    for (const entry of entries) {
      if (entry.sample === 'none') continue
      expect(onDisk(catalogSamplePath(entry.id as CatalogId)), `${entry.id} sample`).toBe(true)
    }
  })

  it('keeps no samples for treatments that are gone', () => {
    const wanted = new Set(entries.filter((entry) => entry.sample !== 'none').map((entry) => `../../public/${catalogSamplePath(entry.id as CatalogId)}`))
    expect([...sampleFiles].filter((file) => !wanted.has(file))).toEqual([])
  })
})

describe('searchCatalog', () => {
  const ids = (query: string) => searchCatalog(query).map((entry) => entry.id)

  it('matches names, keywords and descriptions', () => {
    expect(ids('xerox')).toContain('xerox')
    expect(ids('tear')).toEqual(['tear-collage'])
    expect(ids('grit')).toContain('distress')
  })

  it('needs every word to match', () => {
    expect(ids('ink loss')).toEqual(['ink-loss', 'wear-overlay'])
    expect(ids('crop edge')).toContain('edge-crop')
    expect(ids('crop edge')).not.toContain('close-crop')
  })

  it('matches the category name', () => {
    expect(ids('decay').length).toBeGreaterThan(4)
  })

  it('returns everything for an empty query', () => {
    expect(searchCatalog('  ')).toHaveLength(entries.length)
  })
})

describe('catalogAvailability', () => {
  const none = { hasSelection: false, selectionIsText: false, selectionIsImage: false, layerCount: 0 }

  it('says what to select first', () => {
    expect(catalogAvailability({ needs: 'selection' }, none)).toEqual({ enabled: false, reason: 'Select a layer first' })
    expect(catalogAvailability({ needs: 'text' }, { ...none, hasSelection: true })).toEqual({
      enabled: false,
      reason: 'Select a text layer first',
    })
    expect(catalogAvailability({ needs: 'image' }, { ...none, hasSelection: true, selectionIsImage: true })).toEqual({ enabled: true })
    expect(catalogAvailability({ needs: 'layers' }, none).enabled).toBe(false)
    expect(catalogAvailability({ needs: 'nothing' }, none).enabled).toBe(true)
  })
})
