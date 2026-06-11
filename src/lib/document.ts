/**
 * Document model — artboards, variants, print settings, palette (Horizon 2.6, 2.11, 2.12).
 */
import type { PosterPreset, PosterPresetId } from './editorModel'
import { applyPosterPreset } from './editorModel'

export type Artboard = {
  id: string
  name: string
  preset: PosterPreset
  canvas: Record<string, unknown>
}

export type DocumentVariant = {
  id: string
  name: string
  savedAt: string
  canvas: Record<string, unknown>
  thumbnail?: string
}

export type SavedComponent = {
  id: string
  name: string
  canvas: Record<string, unknown>
  thumbnail?: string
}

export type DocumentMeta = {
  dpi: number
  bleedMm: number
  palette: string[]
  artboards: Artboard[]
  activeArtboardId: string
  variants: DocumentVariant[]
  components: SavedComponent[]
}

export function newArtboardId(): string {
  return `artboard-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export function newVariantId(): string {
  return `variant-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export function newComponentId(): string {
  return `component-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export function createDefaultDocument(preset: PosterPreset, canvas: Record<string, unknown>): DocumentMeta {
  const id = newArtboardId()
  return {
    dpi: preset.dpi ?? 300,
    bleedMm: 3,
    palette: ['#111111', '#e11d48', '#05b6d4', '#f6f1e6'],
    artboards: [{ id, name: preset.name, preset, canvas }],
    activeArtboardId: id,
    variants: [],
    components: [],
  }
}

export function getActiveArtboard(doc: DocumentMeta): Artboard | undefined {
  return doc.artboards.find((board) => board.id === doc.activeArtboardId) ?? doc.artboards[0]
}

export function switchArtboard(doc: DocumentMeta, artboardId: string): DocumentMeta {
  if (!doc.artboards.some((board) => board.id === artboardId)) return doc
  return { ...doc, activeArtboardId: artboardId }
}

export function addArtboard(doc: DocumentMeta, presetId: PosterPresetId, name?: string): DocumentMeta {
  const preset = applyPosterPreset(presetId)
  const id = newArtboardId()
  const board: Artboard = {
    id,
    name: name ?? preset.name,
    preset,
    canvas: { version: '7.0.0', objects: [], background: '#f6f1e6' },
  }
  return {
    ...doc,
    artboards: [...doc.artboards, board],
    activeArtboardId: id,
  }
}

export function forkVariant(doc: DocumentMeta, canvas: Record<string, unknown>, name: string): DocumentMeta {
  const variant: DocumentVariant = {
    id: newVariantId(),
    name,
    savedAt: new Date().toISOString(),
    canvas,
  }
  return { ...doc, variants: [variant, ...doc.variants].slice(0, 12) }
}

export function mmToPx(mm: number, dpi: number) {
  return Math.round((mm / 25.4) * dpi)
}

export function bleedInsetsPx(dpi: number, bleedMm: number) {
  const bleed = mmToPx(bleedMm, dpi)
  return { bleed, trim: bleed, safe: bleed + mmToPx(5, dpi) }
}
