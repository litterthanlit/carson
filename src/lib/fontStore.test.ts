import { describe, expect, it } from 'vitest'
import { fontBytesKey, fontsFromRecords, planFontWrite, type StoredFontRecord } from './fontStore'

const bytes = (...values: number[]) => new Uint8Array(values)

describe('fontBytesKey', () => {
  it('is stable for the same bytes and differs for different bytes', () => {
    expect(fontBytesKey(bytes(1, 2, 3))).toBe(fontBytesKey(bytes(1, 2, 3)))
    expect(fontBytesKey(bytes(1, 2, 3))).not.toBe(fontBytesKey(bytes(1, 2, 4)))
    expect(fontBytesKey(bytes(1, 2, 3))).not.toBe(fontBytesKey(bytes(3, 2, 1)))
    expect(fontBytesKey(bytes(0))).not.toBe(fontBytesKey(bytes(0, 0)))
  })
})

describe('planFontWrite', () => {
  it('writes nothing when the same file is already stored under that family', () => {
    expect(planFontWrite([{ hash: 'a', families: ['Grit'] }], 'a', 'Grit')).toEqual({ kind: 'unchanged' })
  })

  it('creates a record for a new file', () => {
    expect(planFontWrite([], 'a', 'Grit')).toEqual({ kind: 'write', families: ['Grit'], create: true, update: [], remove: [] })
  })

  it('adds a second family name to a file already stored, without storing the bytes again', () => {
    expect(planFontWrite([{ hash: 'a', families: ['Grit'] }], 'a', 'Grit Two')).toEqual({
      kind: 'write',
      families: ['Grit', 'Grit Two'],
      create: false,
      update: [],
      remove: [],
    })
  })

  it('moves a family name from an older file to the newer one', () => {
    const existing = [
      { hash: 'old', families: ['Grit'] },
      { hash: 'shared', families: ['Grit', 'Other'] },
    ]
    expect(planFontWrite(existing, 'new', 'Grit')).toEqual({
      kind: 'write',
      families: ['Grit'],
      create: true,
      update: [{ hash: 'shared', families: ['Other'] }],
      remove: ['old'],
    })
  })
})

describe('fontsFromRecords', () => {
  const record = (hash: string, families: string[], savedAt: string): StoredFontRecord => ({
    hash,
    families,
    fileName: `${hash}.woff2`,
    mimeType: 'font/woff2',
    bytes: bytes(hash.length),
    savedAt,
  })

  it('lists one font per family, each family resolving to its file', () => {
    const fonts = fontsFromRecords([record('a', ['Grit', 'Grit Alt'], '2026-01-01'), record('b', ['Other'], '2026-01-02')])
    expect(fonts.map((font) => [font.family, font.fileName])).toEqual([
      ['Grit', 'a.woff2'],
      ['Grit Alt', 'a.woff2'],
      ['Other', 'b.woff2'],
    ])
  })

  it('lets the newer file win if two records ever claim one family', () => {
    const fonts = fontsFromRecords([record('new', ['Grit'], '2026-02-01'), record('old', ['Grit'], '2026-01-01')])
    expect(fonts).toHaveLength(1)
    expect(fonts[0].fileName).toBe('new.woff2')
  })
})
