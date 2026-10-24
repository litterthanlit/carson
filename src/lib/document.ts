/**
 * Document model — artboards, variants, print settings, palette (Horizon 2.6, 2.11, 2.12).
 */
import type { PosterPreset, PosterPresetId } from './editorModel'
import { applyPosterPreset } from './editorModel'
import type { Gesture } from './gestures'
import {
  upsertSavedInstrument as prependSavedInstrument,
  type SavedInstrument,
} from './instrumentAssets'
import { newPressRun, readPressRun, type PressRun } from './press'
import type { Treatment } from './treatments'
import type { CharacterStyleDef, ParagraphStyleDef } from './textStyles'

export type Artboard = {
  id: string
  name: string
  preset: PosterPreset
  canvas: Record<string, unknown>
  posterTreatments?: Treatment[]
  /**
   * The run this poster prints in — every ink effect on it shares one sheet,
   * one ink map and one plate slip. Missing on posters made before the press
   * (and when turned off): each effect then inks on its own, as it always did.
   */
  press?: PressRun
}

export type DocumentVariant = {
  id: string
  name: string
  savedAt: string
  canvas: Record<string, unknown>
  thumbnail?: string
}

export type ComponentKind = 'object' | 'stack'

export type SavedComponent = {
  id: string
  name: string
  canvas: Record<string, unknown>
  thumbnail?: string
  kind?: ComponentKind
}

export type DocumentMeta = {
  dpi: number
  bleedMm: number
  palette: string[]
  artboards: Artboard[]
  activeArtboardId: string
  variants: DocumentVariant[]
  components: SavedComponent[]
  instruments: SavedInstrument[]
  gestures: Gesture[]
  characterStyles: CharacterStyleDef[]
  paragraphStyles: ParagraphStyleDef[]
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

export function newGestureId(): string {
  return `gesture-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export function newSavedInstrumentId(): string {
  return `instrument-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export function createDefaultDocument(preset: PosterPreset, canvas: Record<string, unknown>): DocumentMeta {
  const id = newArtboardId()
  return {
    dpi: preset.dpi ?? 300,
    bleedMm: 3,
    palette: ['#111111', '#e11d48', '#05b6d4', '#f6f1e6'],
    artboards: [{ id, name: preset.name, preset, canvas, press: newPressRun() }],
    activeArtboardId: id,
    variants: [],
    components: [],
    instruments: [],
    gestures: [],
    characterStyles: [],
    paragraphStyles: [],
  }
}

export function normalizeDocumentMeta(doc: DocumentMeta): DocumentMeta {
  return {
    ...doc,
    artboards: (doc.artboards ?? []).map(normalizeArtboardPress),
    instruments: doc.instruments ?? [],
    gestures: doc.gestures ?? [],
    characterStyles: doc.characterStyles ?? [],
    paragraphStyles: doc.paragraphStyles ?? [],
    components: (doc.components ?? []).map((component) => ({
      ...component,
      kind: component.kind ?? 'object',
    })),
  }
}

/** A stored press must be a real run; anything else means the poster has none. */
function normalizeArtboardPress(board: Artboard): Artboard {
  if (board.press === undefined) return board
  const press = readPressRun(board.press)
  if (press) return { ...board, press }
  const rest = { ...board }
  delete rest.press
  return rest
}

export function readArtboardPress(board: Artboard | undefined): PressRun | null {
  return board ? readPressRun(board.press) : null
}

/** Put the poster on a run (or take it off any, with null). */
export function writeArtboardPress(board: Artboard, press: PressRun | null): Artboard {
  if (press) return { ...board, press: newPressRun(press.seed, press.feedAngle) }
  const rest = { ...board }
  delete rest.press
  return rest
}

export function findComponent(doc: DocumentMeta, componentId: string): SavedComponent | undefined {
  return doc.components.find((component) => component.id === componentId)
}

export function upsertComponent(doc: DocumentMeta, component: SavedComponent): DocumentMeta {
  return {
    ...doc,
    components: [component, ...doc.components.filter((item) => item.id !== component.id)].slice(0, 24),
  }
}

export function upsertDocumentInstrument(doc: DocumentMeta, asset: SavedInstrument): DocumentMeta {
  return {
    ...doc,
    instruments: prependSavedInstrument(doc.instruments ?? [], asset),
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
    press: newPressRun(),
  }
  return {
    ...doc,
    artboards: [...doc.artboards, board],
    activeArtboardId: id,
  }
}

export function findVariant(doc: DocumentMeta, variantId: string): DocumentVariant | undefined {
  return doc.variants.find((variant) => variant.id === variantId)
}

export function forkVariant(
  doc: DocumentMeta,
  canvas: Record<string, unknown>,
  name: string,
  thumbnail?: string,
): DocumentMeta {
  const variant: DocumentVariant = {
    id: newVariantId(),
    name,
    savedAt: new Date().toISOString(),
    canvas,
    thumbnail,
  }
  return { ...doc, variants: [variant, ...doc.variants].slice(0, 12) }
}

export function renameVariant(doc: DocumentMeta, variantId: string, name: string): DocumentMeta {
  return {
    ...doc,
    variants: doc.variants.map((variant) => (variant.id === variantId ? { ...variant, name } : variant)),
  }
}

export function mergeVariantCanvas(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const currentObjects = Array.isArray(current.objects) ? [...current.objects] : []
  const incomingObjects = Array.isArray(incoming.objects) ? incoming.objects : []
  const existingIds = new Set(
    currentObjects.map((object) => (object as { id?: string }).id).filter(Boolean),
  )
  const merged = [
    ...currentObjects,
    ...incomingObjects.filter((object) => {
      const id = (object as { id?: string }).id
      return !id || !existingIds.has(id)
    }),
  ]
  return { ...current, objects: merged }
}

export function updateArtboardPreset(
  doc: DocumentMeta,
  artboardId: string,
  preset: PosterPreset,
  name?: string,
): DocumentMeta {
  return {
    ...doc,
    artboards: doc.artboards.map((board) =>
      board.id === artboardId ? { ...board, preset, name: name ?? board.name } : board,
    ),
  }
}

export function mmToPx(mm: number, dpi: number) {
  return Math.round((mm / 25.4) * dpi)
}

export function bleedInsetsPx(dpi: number, bleedMm: number) {
  const bleed = mmToPx(bleedMm, dpi)
  return { bleed, trim: bleed, safe: bleed + mmToPx(5, dpi) }
}

export function withPrintSettings(doc: DocumentMeta, dpi: number, bleedMm: number): DocumentMeta {
  return { ...doc, dpi, bleedMm }
}
