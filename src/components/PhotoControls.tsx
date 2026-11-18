import { useSyncExternalStore } from 'react'
import { AlertTriangle, Crop, ImageUp, RotateCcw } from 'lucide-react'
import { describeResolution } from '../lib/imageResolution'
import type { ResolutionStore } from '../lib/resolutionStore'

type PhotoControlsProps = {
  layerId: string
  resolutionStore: ResolutionStore
  cropped: boolean
  /** Why crop is unavailable for this photo, said under the buttons. */
  cropBlocked: string | null
  cropping: boolean
  onCrop: () => void
  onResetCrop: () => void
  onReplace: () => void
}

/** The live resolution note for one photo layer; re-renders only when its number changes. */
export function ResolutionNote({ layerId, store }: { layerId: string; store: ResolutionStore }) {
  const resolution = useSyncExternalStore(store.subscribe, () => store.get(layerId))
  if (!resolution) return null
  const { text, warning } = describeResolution(resolution)
  return (
    <div className={warning ? 'resolution-note low' : 'resolution-note'} role="status" aria-live="polite">
      <p className="resolution-value">{text}</p>
      {warning ? (
        <p className="resolution-warning">
          <AlertTriangle size={13} aria-hidden />
          <span>{warning}</span>
        </p>
      ) : null}
    </div>
  )
}

/** Properties for a photo layer: resolution, Crop, Reset crop, Replace image. */
export function PhotoControls({ layerId, resolutionStore, cropped, cropBlocked, cropping, onCrop, onResetCrop, onReplace }: PhotoControlsProps) {
  return (
    <div className="photo-controls">
      <p className="property-kicker">Photo</p>
      <ResolutionNote layerId={layerId} store={resolutionStore} />
      <div className="button-row">
        <button type="button" title="Crop this image in place (C, or double-click it)" onClick={onCrop} disabled={cropping || Boolean(cropBlocked)} aria-describedby={cropBlocked ? `${layerId}-crop-blocked` : undefined}>
          <Crop size={14} aria-hidden />
          Crop
        </button>
        <button type="button" title="Reset crop: show the whole image again" aria-label="Reset crop" onClick={onResetCrop} disabled={cropping || !cropped || Boolean(cropBlocked)}>
          <RotateCcw size={14} aria-hidden />
          Reset
        </button>
        <button type="button" title="Swap in another picture, keeping this layer's place, size and effects" aria-label="Replace image" onClick={onReplace} disabled={cropping}>
          <ImageUp size={14} aria-hidden />
          Replace…
        </button>
      </div>
      {cropBlocked ? (
        <p className="hint" id={`${layerId}-crop-blocked`}>
          {cropBlocked}
        </p>
      ) : null}
    </div>
  )
}
