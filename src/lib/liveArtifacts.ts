/**
 * Live artifacts — treatments whose companions are cut or printed *from* the
 * source (letter break pieces, a tape lift's print and strip). When the source
 * moves, is retyped, re-masked or re-tuned — by a drag, an edit or an undo —
 * the companions are stale and get rebuilt from the seed.
 */
import type { FabricObject, Textbox } from 'fabric'
import type { Treatment } from './treatments'

export const LIVE_ARTIFACT_SIGNATURE_KEY = 'liveArtifactSignature'
export const LIVE_ARTIFACT_TYPES = new Set(['letter-break', 'tape-lift'])

function liveTreatmentsOf(object: FabricObject): Treatment[] {
  const raw = (object as unknown as Record<string, unknown>).treatments
  return Array.isArray(raw) ? (raw as Treatment[]).filter((item) => LIVE_ARTIFACT_TYPES.has(item.type)) : []
}

const SOURCE_PROPS = [
  'text',
  'width',
  'height',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'fontStyle',
  'fill',
  'stroke',
  'strokeWidth',
  'charSpacing',
  'lineHeight',
  'textAlign',
  'layerMask',
  'globalCompositeOperation',
  'cropX',
  'cropY',
]

/** Everything the companions were made from. */
export function liveArtifactSignature(source: FabricObject): string {
  const record = source as unknown as Record<string, unknown>
  return JSON.stringify([
    source.left,
    source.top,
    source.angle,
    source.scaleX,
    source.scaleY,
    source.skewX,
    source.skewY,
    source.flipX,
    source.flipY,
    ...SOURCE_PROPS.map((key) => record[key]),
    (record.transformBaseline as { opacity?: number } | undefined)?.opacity,
    liveTreatmentsOf(source).map((item) => [item.type, item.enabled, item.seed, item.params]),
  ])
}

export function markLiveArtifactsFresh(source: FabricObject) {
  ;(source as unknown as Record<string, unknown>)[LIVE_ARTIFACT_SIGNATURE_KEY] = liveArtifactSignature(source)
}

/** True when the source changed since its live companions were made, and isn't mid-edit. */
export function isLiveArtifactStale(object: FabricObject): boolean {
  if ((object as Textbox).isEditing) return false
  if (!liveTreatmentsOf(object).some((item) => item.enabled)) return false
  return (object as unknown as Record<string, unknown>)[LIVE_ARTIFACT_SIGNATURE_KEY] !== liveArtifactSignature(object)
}
