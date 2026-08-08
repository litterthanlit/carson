/**
 * Character and paragraph styles as documentMeta assets (Horizon 2.2 Phase C).
 */
import type { FabricObject, Textbox } from 'fabric'
import { readObjectProp } from './canvasUtils'
import type { OpenTypeFeatures } from './textTypography'
import { normalizeOpenTypeFeatures, readOpenTypeFeatures } from './textTypography'

export type CharacterStyleProps = {
  fontFamily?: string
  fontSize?: number
  fontWeight?: string | number
  fontStyle?: '' | 'normal' | 'italic' | 'oblique'
  fill?: string
  charSpacing?: number
  underline?: boolean
  deltaY?: number
}

export type ParagraphStyleProps = {
  fontFamily?: string
  fontSize?: number
  fontWeight?: string | number
  fill?: string
  charSpacing?: number
  lineHeight?: number
  textAlign?: 'left' | 'center' | 'right' | 'justify'
}

export type CharacterStyleDef = {
  id: string
  name: string
  props: CharacterStyleProps
  openTypeFeatures?: OpenTypeFeatures
}

export type ParagraphStyleDef = {
  id: string
  name: string
  props: ParagraphStyleProps
  openTypeFeatures?: OpenTypeFeatures
}

export type TextSelectionRange = {
  start: number
  end: number
}

export function newCharacterStyleId(): string {
  return `char-style-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export function newParagraphStyleId(): string {
  return `para-style-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export function hasTextSelection(range: TextSelectionRange | null): boolean {
  return Boolean(range && range.end > range.start)
}

function asTextbox(object: FabricObject | null): Textbox | null {
  if (!object || object.type !== 'textbox') return null
  return object as Textbox
}

export function readTextSelection(object: FabricObject | null): TextSelectionRange | null {
  const text = asTextbox(object)
  if (!text || !text.isEditing) return null
  const start = text.selectionStart ?? 0
  const end = text.selectionEnd ?? 0
  if (end <= start) return null
  return { start, end }
}

export function captureCharacterStyleFromText(
  object: FabricObject,
  range?: TextSelectionRange | null,
): CharacterStyleProps {
  const text = asTextbox(object)
  if (!text) return {}

  if (range && hasTextSelection(range)) {
    const [style] = text.getSelectionStyles(range.start, range.end, true)
    return {
      fontFamily: style?.fontFamily ?? String(readObjectProp(text, 'fontFamily') ?? ''),
      fontSize: style?.fontSize ?? Number(readObjectProp(text, 'fontSize') ?? 48),
      fontWeight: style?.fontWeight ?? readObjectProp(text, 'fontWeight') as string | number,
      fontStyle: (style?.fontStyle ?? readObjectProp(text, 'fontStyle') ?? 'normal') as CharacterStyleProps['fontStyle'],
      fill: typeof style?.fill === 'string' ? style.fill : String(readObjectProp(text, 'fill') ?? '#111111'),
      charSpacing: Number(readObjectProp(text, 'charSpacing') ?? 0),
      underline: style?.underline ?? Boolean(readObjectProp(text, 'underline')),
      deltaY: style?.deltaY ?? 0,
    }
  }

  return {
    fontFamily: String(readObjectProp(text, 'fontFamily') ?? ''),
    fontSize: Number(readObjectProp(text, 'fontSize') ?? 48),
    fontWeight: readObjectProp(text, 'fontWeight') as string | number,
    fontStyle: (readObjectProp(text, 'fontStyle') ?? 'normal') as CharacterStyleProps['fontStyle'],
    fill: String(readObjectProp(text, 'fill') ?? '#111111'),
    charSpacing: Number(readObjectProp(text, 'charSpacing') ?? 0),
    underline: Boolean(readObjectProp(text, 'underline')),
    deltaY: 0,
  }
}

export function captureParagraphStyleFromText(object: FabricObject): ParagraphStyleProps {
  const text = asTextbox(object)
  if (!text) return {}
  return {
    fontFamily: String(readObjectProp(text, 'fontFamily') ?? ''),
    fontSize: Number(readObjectProp(text, 'fontSize') ?? 48),
    fontWeight: readObjectProp(text, 'fontWeight') as string | number,
    fill: String(readObjectProp(text, 'fill') ?? '#111111'),
    charSpacing: Number(readObjectProp(text, 'charSpacing') ?? 0),
    lineHeight: Number(readObjectProp(text, 'lineHeight') ?? 1),
    textAlign: (readObjectProp(text, 'textAlign') ?? 'left') as ParagraphStyleProps['textAlign'],
  }
}

export function applyCharacterStyleToText(
  object: FabricObject,
  style: CharacterStyleDef,
  range?: TextSelectionRange | null,
): boolean {
  const text = asTextbox(object)
  if (!text) return false

  if (range && hasTextSelection(range)) {
    text.setSelectionStyles(style.props, range.start, range.end)
  } else {
    text.set(style.props as Partial<FabricObject>)
    if (style.openTypeFeatures) {
      text.set({ openTypeFeatures: normalizeOpenTypeFeatures(style.openTypeFeatures) } as Partial<FabricObject>)
    }
  }

  text.initDimensions()
  text.setCoords()
  return true
}

export function applyParagraphStyleToText(object: FabricObject, style: ParagraphStyleDef): boolean {
  const text = asTextbox(object)
  if (!text) return false

  text.set(style.props as Partial<FabricObject>)
  if (style.openTypeFeatures) {
    text.set({ openTypeFeatures: normalizeOpenTypeFeatures(style.openTypeFeatures) } as Partial<FabricObject>)
  }
  text.initDimensions()
  text.setCoords()
  return true
}

export function applySelectionCharacterPatch(
  object: FabricObject,
  patch: Partial<CharacterStyleProps>,
  range: TextSelectionRange,
): boolean {
  const text = asTextbox(object)
  if (!text || !hasTextSelection(range)) return false
  text.setSelectionStyles(patch, range.start, range.end)
  text.initDimensions()
  text.setCoords()
  return true
}

export function createCharacterStyleFromText(
  name: string,
  object: FabricObject,
  range?: TextSelectionRange | null,
): CharacterStyleDef {
  return {
    id: newCharacterStyleId(),
    name,
    props: captureCharacterStyleFromText(object, range),
    openTypeFeatures: readOpenTypeFeatures(object),
  }
}

export function createParagraphStyleFromText(name: string, object: FabricObject): ParagraphStyleDef {
  return {
    id: newParagraphStyleId(),
    name,
    props: captureParagraphStyleFromText(object),
    openTypeFeatures: readOpenTypeFeatures(object),
  }
}
