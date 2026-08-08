/**
 * OpenType feature toggles for canvas text (Horizon 2.2 Phase C).
 * Fabric renders via canvas fillText — we patch _setTextStyles to apply
 * fontKerning, fontVariantCaps, and fontFeatureSettings where supported.
 */
import { FabricText, type FabricObject } from 'fabric'
import { readObjectProp } from './canvasUtils'

export type OpenTypeFeatures = {
  kern: boolean
  liga: boolean
  smcp: boolean
}

export const DEFAULT_OPEN_TYPE_FEATURES: OpenTypeFeatures = {
  kern: true,
  liga: true,
  smcp: false,
}

let renderPatchInstalled = false

export function normalizeOpenTypeFeatures(
  value: Partial<OpenTypeFeatures> | undefined,
): OpenTypeFeatures {
  return {
    kern: value?.kern !== false,
    liga: value?.liga !== false,
    smcp: value?.smcp === true,
  }
}

export function readOpenTypeFeatures(object: FabricObject | null): OpenTypeFeatures {
  const raw = readObjectProp(object, 'openTypeFeatures') as Partial<OpenTypeFeatures> | undefined
  return normalizeOpenTypeFeatures(raw)
}

export function openTypeFeatureSettings(features: OpenTypeFeatures): string {
  const parts: string[] = []
  parts.push(features.kern ? '"kern" 1' : '"kern" 0')
  parts.push(features.liga ? '"liga" 1' : '"liga" 0')
  parts.push(features.smcp ? '"smcp" 1' : '"smcp" 0')
  return parts.join(', ')
}

type CanvasFontContext = CanvasRenderingContext2D & {
  fontKerning?: CanvasFontKerning
  fontVariantCaps?: CanvasFontVariantCaps
  fontFeatureSettings?: string
}

export function applyOpenTypeToContext(
  ctx: CanvasRenderingContext2D,
  features: OpenTypeFeatures,
): void {
  const fontCtx = ctx as CanvasFontContext
  if ('fontKerning' in fontCtx) {
    fontCtx.fontKerning = features.kern ? 'normal' : 'none'
  }
  if ('fontVariantCaps' in fontCtx) {
    fontCtx.fontVariantCaps = features.smcp ? 'small-caps' : 'normal'
  }
  if ('fontFeatureSettings' in fontCtx) {
    fontCtx.fontFeatureSettings = openTypeFeatureSettings(features)
  }
}

export function installTextTypographyRenderPatch(): void {
  if (renderPatchInstalled) return
  renderPatchInstalled = true

  const original = FabricText.prototype._setTextStyles
  FabricText.prototype._setTextStyles = function setTextStylesWithOpenType(
    ctx: CanvasRenderingContext2D,
    charStyle?: unknown,
    forMeasuring?: boolean,
  ) {
    original.call(this, ctx, charStyle, forMeasuring)
    applyOpenTypeToContext(ctx, readOpenTypeFeatures(this as unknown as FabricObject))
  }
}
