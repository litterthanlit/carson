import { describe, expect, it } from 'vitest'
import { createDefaultDocument, forkVariant } from './document'
import { applyPosterPreset } from './editorModel'
import { uniqueImportName } from './fileIdentity'
import {
  PROJECT_FILE_VERSION,
  base64ToBytes,
  bytesToBase64,
  parseProjectFile,
  projectFileName,
  serializeProjectFile,
  type EmbeddedFont,
} from './projectFile'
import type { StoredProject } from './storage'

// A parsed file, loosely typed so tests can break it on purpose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EnvelopeJson = Record<string, any>

const photo = `data:image/jpeg;base64,${'A'.repeat(40_000)}`

function sampleProject(): StoredProject {
  const preset = applyPosterPreset('a3')
  const canvas = {
    version: '7.0.0',
    background: '#f6f1e6',
    objects: [
      { type: 'Textbox', id: 'layer-1', text: 'NIGHT BUS', fontFamily: 'Mono Upload', treatments: [{ type: 'scatter', seed: 7, enabled: true }] },
      { type: 'Image', id: 'layer-2', src: photo, name: 'photo.jpg' },
    ],
  }
  let document = createDefaultDocument(preset, canvas)
  document = forkVariant(document, canvas, 'Version 2', 'data:image/jpeg;base64,thumb')
  return {
    id: 'project-1',
    name: 'Night bus',
    savedAt: '2026-11-01T10:00:00.000Z',
    lastUsedAt: '2026-11-02T10:00:00.000Z',
    thumbnail: 'data:image/jpeg;base64,thumb',
    preset,
    canvas,
    document: { ...document, dpi: 150, bleedMm: 5 },
  }
}

const font: EmbeddedFont = {
  family: 'Mono Upload',
  fileName: 'Mono-Upload.woff2',
  mimeType: 'font/woff2',
  data: bytesToBase64(new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 1, 2, 255])),
}

function parsed(text: string) {
  const result = parseProjectFile(text)
  if (!result.ok) throw new Error(`expected a file, got ${result.error.kind}`)
  return result.file
}

describe('project files', () => {
  it('round-trips the project, its document and its fonts', () => {
    const project = sampleProject()
    const text = serializeProjectFile({ project, fonts: [font], app: 'Carson test', savedAt: '2026-11-03T00:00:00.000Z' })
    const file = parsed(text)
    expect(file.savedAt).toBe('2026-11-03T00:00:00.000Z')
    expect(file.app).toBe('Carson test')
    expect(file.fonts).toEqual([font])
    expect(file.project).toEqual({
      name: project.name,
      savedAt: project.savedAt,
      thumbnail: project.thumbnail,
      preset: project.preset,
      canvas: project.canvas,
      document: project.document,
    })
    expect(file.project).not.toHaveProperty('id')
    expect(Array.from(base64ToBytes(file.fonts[0].data))).toEqual([0x77, 0x4f, 0x46, 0x32, 0, 1, 2, 255])
  })

  it('reads bytes as well as text', () => {
    const text = serializeProjectFile({ project: sampleProject() })
    expect(parseProjectFile(new TextEncoder().encode(text)).ok).toBe(true)
    expect(parseProjectFile(new TextEncoder().encode(`\uFEFF${text}`).buffer).ok).toBe(true)
  })

  it('writes an image shared by the poster and its versions once', () => {
    const text = serializeProjectFile({ project: sampleProject() })
    expect(text.split(photo).length - 1).toBe(1)
    expect(text.length).toBeLessThan(photo.length + 5_000)
    // Text a designer typed that happens to look like a reference is left alone.
    const project = sampleProject()
    ;(project.canvas.objects as Record<string, unknown>[])[0].text = 'carson-media:0'
    expect((parsed(serializeProjectFile({ project })).project.canvas.objects as Record<string, unknown>[])[0].text).toBe('carson-media:0')
  })

  it('refuses a file from a newer Carson', () => {
    const envelope = JSON.parse(serializeProjectFile({ project: sampleProject() }))
    envelope.version = PROJECT_FILE_VERSION + 98
    // Even when the newer layout would not validate here.
    envelope.project = { somethingNew: true }
    const result = parseProjectFile(JSON.stringify(envelope))
    expect(result).toMatchObject({ ok: false, error: { kind: 'too-new' } })
    if (!result.ok) expect(result.error.message).toMatch(/newer version of Carson/)
  })

  it('refuses things that are not Carson files', () => {
    for (const input of [
      'Shopping list: milk, eggs',
      '',
      '[1, 2, 3]',
      JSON.stringify({ format: 'something-else', version: 1 }),
      JSON.stringify({ version: 1, project: {} }),
      new Uint8Array([0xff, 0xfe, 0x00, 0x89]),
    ]) {
      const result = parseProjectFile(input)
      expect(result, String(input)).toMatchObject({ ok: false, error: { kind: 'not-carson' } })
      if (!result.ok) expect(result.error.message).toMatch(/isn’t a Carson poster/)
    }
  })

  it('reports a truncated file as damaged', () => {
    const text = serializeProjectFile({ project: sampleProject(), fonts: [font] })
    for (const cut of [40, Math.floor(text.length / 2), text.length - 1]) {
      const result = parseProjectFile(text.slice(0, cut))
      expect(result, `cut at ${cut}`).toMatchObject({ ok: false, error: { kind: 'damaged' } })
      if (!result.ok) expect(result.error.message).toMatch(/damaged or incomplete/)
    }
  })

  it('reports a valid-JSON file with broken fields as damaged', () => {
    const envelope = JSON.parse(serializeProjectFile({ project: sampleProject() }))
    for (const breakIt of [
      (file: EnvelopeJson) => delete file.project.canvas,
      (file: EnvelopeJson) => (file.project.preset.width = 'wide'),
      (file: EnvelopeJson) => (file.project.document.artboards = []),
      (file: EnvelopeJson) => (file.media = []),
      (file: EnvelopeJson) => (file.fonts = [{ family: 'X', fileName: 'x', mimeType: 'font/woff2', data: 'not base64!' }]),
    ]) {
      const copy = structuredClone(envelope)
      breakIt(copy)
      expect(parseProjectFile(JSON.stringify(copy))).toMatchObject({ ok: false, error: { kind: 'damaged' } })
    }
  })

  it('ignores unknown extra fields', () => {
    const envelope = JSON.parse(serializeProjectFile({ project: sampleProject() }))
    envelope.futureThing = { anything: [1, 2, 3] }
    envelope.project.futureField = 'kept with the project'
    envelope.project.preset.id = 'tabloid'
    const file = parsed(JSON.stringify(envelope))
    expect(file).not.toHaveProperty('futureThing')
    expect(file.project.name).toBe('Night bus')
    expect(file.project.preset.id).toBe('custom')
    expect(file.project.canvas).toEqual(sampleProject().canvas)
  })

  it('names files safely', () => {
    expect(projectFileName('Night bus')).toBe('Night bus.carson')
    expect(projectFileName('a/b\\c:d*e?f"g<h>i|j')).toBe('a b c d e f g h i j.carson')
    expect(projectFileName('  ..hidden.  ')).toBe('hidden.carson')
    expect(projectFileName('   ')).toBe('Untitled poster.carson')
    expect(projectFileName('CON')).toBe('CON poster.carson')
    expect(projectFileName('x'.repeat(300))).toBe(`${'x'.repeat(120)}.carson`)
  })

  it('stores a poster opened twice under distinct names', () => {
    expect(uniqueImportName('Night bus', [])).toBe('Night bus')
    expect(uniqueImportName('Night bus', ['Night bus'])).toBe('Night bus (2)')
    expect(uniqueImportName('Night bus', ['Night bus', 'Night bus (2)'])).toBe('Night bus (3)')
  })
})
