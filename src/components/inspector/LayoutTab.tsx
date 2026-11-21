import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceBetween,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceBetween,
  Trash2,
} from 'lucide-react'
import { formatModKey } from '../../lib/commands'
import { formatPercent } from '../../lib/canvasUtils'
import { ColumnGridIcon, RowGridIcon } from '../icons/StudioIcons'
import { Slider } from '../Slider'
import type { InspectorPanelProps } from './types'

type LayoutTabProps = Pick<
  InspectorPanelProps,
  | 'gridOverlay'
  | 'onGridOverlayChange'
  | 'onGridTensionChange'
  | 'onGridTensionCommit'
  | 'showLayoutGrid'
  | 'onToggleLayoutGrid'
  | 'showBaselineGrid'
  | 'onToggleBaselineGrid'
  | 'snapToGrid'
  | 'onToggleSnapToGrid'
  | 'layoutGuides'
  | 'onAddVerticalGuide'
  | 'onAddHorizontalGuide'
  | 'onRemoveLayoutGuide'
  | 'onClearLayoutGuides'
  | 'onAlignSelection'
  | 'onDistributeSelection'
  | 'onClipSelectionToShape'
  | 'onWeaveSelection'
  | 'onPhotographCollage'
  | 'onFrameSelection'
  | 'onOpenCompsGallery'
  | 'documentMeta'
  | 'onRestoreVariant'
  | 'onOpenVariantCompare'
  | 'onMergeVariant'
  | 'onRenameVariant'
>

export function LayoutTab({
  gridOverlay,
  onGridOverlayChange,
  onGridTensionChange,
  onGridTensionCommit,
  showLayoutGrid,
  onToggleLayoutGrid,
  showBaselineGrid,
  onToggleBaselineGrid,
  snapToGrid,
  onToggleSnapToGrid,
  layoutGuides,
  onAddVerticalGuide,
  onAddHorizontalGuide,
  onRemoveLayoutGuide,
  onClearLayoutGuides,
  onAlignSelection,
  onDistributeSelection,
  onClipSelectionToShape,
  onWeaveSelection,
  onPhotographCollage,
  onFrameSelection,
  onOpenCompsGallery,
  documentMeta,
  onRestoreVariant,
  onOpenVariantCompare,
  onMergeVariant,
  onRenameVariant,
}: LayoutTabProps) {
  return (
    <div className="panel-section">
      <h2>Layout grid</h2>
      <p className="hint">Structure to play against. Click the rulers to drop guides. Looseness loosens the snap.</p>
      <div className="button-row">
        <button type="button" className={showLayoutGrid ? 'active' : undefined} onClick={onToggleLayoutGrid} title="Toggle column grid (G)">
          <ColumnGridIcon size={14} aria-hidden />
          {showLayoutGrid ? 'Columns on' : 'Columns off'}
        </button>
        <button type="button" className={showBaselineGrid ? 'active' : undefined} onClick={onToggleBaselineGrid}>
          <RowGridIcon size={14} aria-hidden />
          {showBaselineGrid ? 'Rows on' : 'Rows off'}
        </button>
      </div>
      <label className="toggle-row">
        <input type="checkbox" role="switch" checked={snapToGrid} onChange={onToggleSnapToGrid} />
        Snap to grid
      </label>
      <span className="layout-field-label">Columns</span>
      <div className="preset-row preset-row-inline">
        {([2, 3, 4, 6, 12] as const).map((count) => (
          <button
            key={count}
            type="button"
            className={gridOverlay.columns === count ? 'active' : undefined}
            onClick={() => onGridOverlayChange({ columns: count })}
          >
            {count}
          </button>
        ))}
      </div>
      <span className="layout-field-label">Rows</span>
      <div className="preset-row preset-row-inline">
        {([4, 6, 8, 12] as const).map((count) => (
          <button
            key={count}
            type="button"
            className={gridOverlay.rows === count ? 'active' : undefined}
            onClick={() => onGridOverlayChange({ rows: count })}
          >
            {count}
          </button>
        ))}
      </div>
      <label>
        Margin
        <input
          type="number"
          min={0}
          max={320}
          value={gridOverlay.margin}
          onChange={(event) => onGridOverlayChange({ margin: Number(event.target.value) })}
        />
      </label>
      <label>
        Gutter
        <input
          type="number"
          min={0}
          max={160}
          value={gridOverlay.gutter}
          onChange={(event) => onGridOverlayChange({ gutter: Number(event.target.value) })}
        />
      </label>
      <Slider
        label="Grid looseness"
        value={gridOverlay.tension}
        min={0}
        max={100}
        format={formatPercent}
        onChange={onGridTensionChange}
        onCommit={onGridTensionCommit}
      />

      <h3>Guides</h3>
      <div className="button-row">
        <button type="button" title="Add a vertical guide at the center" onClick={onAddVerticalGuide}>
          Vertical
        </button>
        <button type="button" title="Add a horizontal guide at the center" onClick={onAddHorizontalGuide}>
          Horizontal
        </button>
      </div>
      {layoutGuides.length === 0 ? (
        <p className="empty">Click a ruler on the poster, or add a center guide.</p>
      ) : (
        <ul className="guide-list">
          {layoutGuides.map((guide) => (
            <li key={guide.id}>
              <span>
                {guide.axis === 'v' ? 'V' : 'H'} {Math.round(guide.position)}px
              </span>
              <button type="button" className="icon-button" title="Remove guide" onClick={() => onRemoveLayoutGuide(guide.id)}>
                <Trash2 size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {layoutGuides.length > 0 ? (
        <button type="button" onClick={onClearLayoutGuides}>
          Clear guides
        </button>
      ) : null}

      <h3>Align &amp; distribute</h3>
      <div className="align-icon-bar" role="group" aria-label="Align selection">
        <button type="button" className="icon-button" aria-label="Left" title="Align left" onClick={() => onAlignSelection('left')}>
          <AlignStartVertical size={14} aria-hidden />
        </button>
        <button type="button" className="icon-button" aria-label="Center" title="Align horizontal center" onClick={() => onAlignSelection('center')}>
          <AlignCenterVertical size={14} aria-hidden />
        </button>
        <button type="button" className="icon-button" aria-label="Right" title="Align right" onClick={() => onAlignSelection('right')}>
          <AlignEndVertical size={14} aria-hidden />
        </button>
        <span className="align-bar-sep" aria-hidden="true" />
        <button type="button" className="icon-button" aria-label="Top" title="Align top" onClick={() => onAlignSelection('top')}>
          <AlignStartHorizontal size={14} aria-hidden />
        </button>
        <button type="button" className="icon-button" aria-label="Middle" title="Align vertical middle" onClick={() => onAlignSelection('middle')}>
          <AlignCenterHorizontal size={14} aria-hidden />
        </button>
        <button type="button" className="icon-button" aria-label="Bottom" title="Align bottom" onClick={() => onAlignSelection('bottom')}>
          <AlignEndHorizontal size={14} aria-hidden />
        </button>
        <span className="align-bar-sep" aria-hidden="true" />
        <button type="button" className="icon-button" aria-label="Distribute H" title="Distribute horizontally" onClick={() => onDistributeSelection('horizontal')}>
          <AlignHorizontalSpaceBetween size={14} aria-hidden />
        </button>
        <button type="button" className="icon-button" aria-label="Distribute V" title="Distribute vertically" onClick={() => onDistributeSelection('vertical')}>
          <AlignVerticalSpaceBetween size={14} aria-hidden />
        </button>
      </div>
      <div className="button-row">
        <button type="button" onClick={onClipSelectionToShape}>
          Clip to shape
        </button>
      </div>
      <h3>Collage</h3>
      <p className="hint">
        Weave threads the biggest word over and under the layers it crosses. Weave again to swap.
      </p>
      <div className="button-row">
        <button type="button" onClick={onWeaveSelection}>
          Weave through
        </button>
        <button type="button" title="Light the selected scraps from one light" onClick={onPhotographCollage}>
          Photograph
        </button>
        {onFrameSelection ? (
          <button type="button" title="Frame handles on each selected layer" onClick={onFrameSelection}>
            Frame each
          </button>
        ) : null}
      </div>
      <h3>Variations</h3>
      <p className="hint">
        Make a new version with <kbd>{formatModKey('b')}</kbd>. The History panel in the right dock is spatial undo. Versions compares named looks.
      </p>
      <div className="button-row">
        <button type="button" onClick={onOpenCompsGallery}>
          Versions
        </button>
      </div>
      {documentMeta && documentMeta.variants.length > 0 ? (
        <ul className="variant-list">
          {documentMeta.variants.map((variant) => (
            <li key={variant.id} className="variant-card">
              {variant.thumbnail ? (
                <img className="variant-thumb" src={variant.thumbnail} alt="" />
              ) : (
                <div className="variant-thumb variant-thumb-placeholder" aria-hidden />
              )}
              <div className="variant-meta">
                <strong>{variant.name}</strong>
                <small>{new Date(variant.savedAt).toLocaleString()}</small>
              </div>
              <div className="variant-actions">
                <button type="button" title={`Restore ${variant.name}`} onClick={() => onRestoreVariant(variant.id)}>
                  Restore
                </button>
                <button type="button" title={`Compare with ${variant.name}`} onClick={() => onOpenVariantCompare(variant.id)}>
                  Compare
                </button>
                <button type="button" title={`Merge ${variant.name} into current`} onClick={() => onMergeVariant(variant.id)}>
                  Merge
                </button>
                <button type="button" title={`Rename ${variant.name}`} onClick={() => onRenameVariant(variant.id)}>
                  Rename
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">No named comps yet.</p>
      )}
    </div>
  )
}
