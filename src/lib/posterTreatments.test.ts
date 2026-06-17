import { describe, expect, it } from 'vitest'
import { applyPosterPreset } from './editorModel'
import { createDefaultDocument } from './document'
import { addPosterTreatment, readPosterTreatments, posterTreatmentLabel } from './posterTreatments'

describe('posterTreatments', () => {
  it('stores scrape treatments per artboard', () => {
    const preset = applyPosterPreset('a3')
    const doc = createDefaultDocument(preset, { objects: [] })
    const board = doc.artboards[0]
    const { artboard, treatment } = addPosterTreatment(board, 'scrape', { count: 5 }, 42)
    expect(readPosterTreatments(artboard)).toHaveLength(1)
    expect(treatment.type).toBe('scrape')
    expect(posterTreatmentLabel(treatment)).toBe('Scrape·5')
  })

  it('replaces an existing scrape treatment on the same artboard', () => {
    const preset = applyPosterPreset('a3')
    const doc = createDefaultDocument(preset, { objects: [] })
    const first = addPosterTreatment(doc.artboards[0], 'scrape', { count: 3 }, 1)
    const second = addPosterTreatment(first.artboard, 'scrape', { count: 7 }, 2)
    expect(readPosterTreatments(second.artboard)).toHaveLength(1)
    expect(readPosterTreatments(second.artboard)[0]?.params.count).toBe(7)
  })
})
