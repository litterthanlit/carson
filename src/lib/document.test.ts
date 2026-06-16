import { describe, expect, it } from 'vitest'
import { applyPosterPreset } from './editorModel'
import {
  createDefaultDocument,
  findVariant,
  forkVariant,
  mergeVariantCanvas,
  renameVariant,
  type DocumentMeta,
} from './document'

function sampleDoc(): DocumentMeta {
  const preset = applyPosterPreset('a3')
  return createDefaultDocument(preset, { version: '7.0.0', objects: [], background: '#fff' })
}

describe('document variants', () => {
  it('forkVariant prepends a variant with optional thumbnail', () => {
    const doc = sampleDoc()
    const canvas = { version: '7.0.0', objects: [{ type: 'rect' }], background: '#eee' }
    const next = forkVariant(doc, canvas, 'Branch A', 'data:image/jpeg;base64,thumb')

    expect(next.variants).toHaveLength(1)
    expect(next.variants[0]?.name).toBe('Branch A')
    expect(next.variants[0]?.canvas).toEqual(canvas)
    expect(next.variants[0]?.thumbnail).toBe('data:image/jpeg;base64,thumb')
  })

  it('forkVariant caps the list at 12 entries', () => {
    let doc = sampleDoc()
    for (let index = 0; index < 14; index += 1) {
      doc = forkVariant(doc, { index }, `Variant ${index}`)
    }
    expect(doc.variants).toHaveLength(12)
    expect(doc.variants[0]?.name).toBe('Variant 13')
  })

  it('findVariant returns a variant by id', () => {
    const doc = forkVariant(sampleDoc(), { objects: [] }, 'Look 1')
    const variant = doc.variants[0]
    expect(variant).toBeDefined()
    expect(findVariant(doc, variant!.id)?.name).toBe('Look 1')
    expect(findVariant(doc, 'missing')).toBeUndefined()
  })

  it('mergeVariantCanvas adds unique objects from a branch', () => {
    const current = { objects: [{ id: 'a', type: 'rect' }] }
    const incoming = { objects: [{ id: 'a', type: 'rect' }, { id: 'b', type: 'textbox' }] }
    const merged = mergeVariantCanvas(current, incoming)
    expect(merged.objects).toHaveLength(2)
  })

  it('renameVariant updates the display name', () => {
    const doc = forkVariant(sampleDoc(), { objects: [] }, 'Draft 1')
    const id = doc.variants[0]!.id
    const next = renameVariant(doc, id, 'Client A')
    expect(findVariant(next, id)?.name).toBe('Client A')
  })
})
