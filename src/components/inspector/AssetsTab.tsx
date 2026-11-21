import { FOUND_PAPERS } from '../../lib/foundPaper'
import type { InspectorPanelProps } from './types'

type AssetsTabProps = Pick<
  InspectorPanelProps,
  | 'selected'
  | 'savedInstruments'
  | 'savedGestures'
  | 'storedAssets'
  | 'documentMeta'
  | 'onInsertFoundPaper'
  | 'onPhotographCollage'
  | 'onFrameImages'
  | 'onCrumpleSheet'
  | 'onAddCropMarks'
  | 'onApplySavedInstrument'
  | 'onApplyGesture'
  | 'onInsertAsset'
  | 'onInsertComponent'
  | 'onSaveSelectionAsComponent'
>

export function AssetsTab({
  selected,
  savedInstruments,
  savedGestures,
  storedAssets,
  documentMeta,
  onInsertFoundPaper,
  onPhotographCollage,
  onFrameImages,
  onCrumpleSheet,
  onAddCropMarks,
  onApplySavedInstrument,
  onApplyGesture,
  onInsertAsset,
  onInsertComponent,
  onSaveSelectionAsComponent,
}: AssetsTabProps) {
  return (
    <div className="panel-section">
      <h2>Asset library</h2>
      <p className="hint">Images and components insert onto the canvas. Instruments and Gestures play on the selection.</p>
      <h3 className="property-kicker">Found paper</h3>
      <p className="hint">Torn scraps to build a collage from. Click again for a different tear.</p>
      <div className="preset-row" role="group" aria-label="Found paper">
        {FOUND_PAPERS.map((paper) => (
          <button
            key={paper.kind}
            type="button"
            title={`Paste a torn ${paper.label.toLowerCase()}`}
            onClick={() => onInsertFoundPaper(paper.kind)}
          >
            {paper.label}
          </button>
        ))}
      </div>
      <div className="button-row">
        <button type="button" title="One light over the board: each scrap casts a shadow by how many sheets it lies on" onClick={onPhotographCollage}>
          Photograph the collage
        </button>
        {onFrameImages ? (
          <button type="button" title="Frame handles and construction lines on every image — R for another layout" onClick={onFrameImages}>
            Frame the images
          </button>
        ) : null}
      </div>
      <h3 className="property-kicker">The sheet</h3>
      <div className="button-row">
        <button type="button" title="Fold, ball up and flatten the poster: creases lit from one side" onClick={onCrumpleSheet}>
          Crumple
        </button>
        <button type="button" title="Trim marks and registration targets, as on a proof" onClick={onAddCropMarks}>
          Crop marks
        </button>
      </div>
      {savedInstruments.length > 0 ? (
        <>
          <h3 className="property-kicker">Instruments</h3>
          <div className="preset-row">
            {savedInstruments.map((asset) => (
              <button
                key={asset.id}
                type="button"
                aria-label={`Play instrument ${asset.name}`}
                title={`Play ${asset.name} on the selected layer`}
                onClick={() => onApplySavedInstrument(asset)}
                disabled={!selected}
              >
                {asset.name}
              </button>
            ))}
          </div>
        </>
      ) : null}
      {savedGestures.length > 0 ? (
        <>
          <h3 className="property-kicker">Gestures</h3>
          <div className="preset-row">
            {savedGestures.map((gesture) => (
              <button
                key={gesture.id}
                type="button"
                title={`Play ${gesture.name} on the selected layer`}
                onClick={() => onApplyGesture(gesture)}
                disabled={!selected}
              >
                {gesture.name}
              </button>
            ))}
          </div>
        </>
      ) : null}
      {storedAssets.length === 0 &&
      (!documentMeta || documentMeta.components.filter((item) => item.kind !== 'stack').length === 0) ? (
        savedInstruments.length === 0 && savedGestures.length === 0 ? (
          <p className="empty">Save an Instrument from Applied effects, or import an image.</p>
        ) : null
      ) : (
        <div className="asset-grid">
          {storedAssets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              className="asset-thumb"
              title={asset.name}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('text/carson-asset', asset.id)
              }}
              onClick={() => onInsertAsset(asset)}
            >
              <img src={asset.thumbnail} alt="" />
              <span>{asset.name}</span>
            </button>
          ))}
          {(documentMeta?.components ?? [])
            .filter((component) => component.kind !== 'stack')
            .map((component) => (
              <button
                key={component.id}
                type="button"
                className="asset-thumb"
                title={`Insert ${component.name} as a linked instance`}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/carson-component', component.id)
                }}
                onClick={() => onInsertComponent(component.id)}
              >
                {component.thumbnail ? (
                  <img src={component.thumbnail} alt="" />
                ) : (
                  <span className="asset-thumb-empty" aria-hidden />
                )}
                <span>{component.name}</span>
              </button>
            ))}
        </div>
      )}
      {documentMeta && documentMeta.components.some((component) => component.kind === 'stack') ? (
        <>
          <h3>Treatment stacks</h3>
          <div className="preset-row">
            {documentMeta.components
              .filter((component) => component.kind === 'stack')
              .map((component) => (
                <button
                  key={component.id}
                  type="button"
                  title={`Apply “${component.name}” to the selected layer`}
                  onClick={() => onInsertComponent(component.id)}
                  disabled={!selected}
                >
                  {component.name}
                </button>
              ))}
          </div>
        </>
      ) : null}
      <button type="button" title="Save the current selection as a reusable component with overrides" onClick={onSaveSelectionAsComponent} disabled={!selected}>
        Save selection as component
      </button>
    </div>
  )
}
