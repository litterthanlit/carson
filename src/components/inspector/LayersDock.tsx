import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { ChevronDown, Contrast, Copy, Group, Trash2, Ungroup } from 'lucide-react'
import { ADJUSTMENT_LABELS, type AdjustmentType } from '../../lib/adjustments'
import { formatPercent } from '../../lib/canvasUtils'
import { formatModKey } from '../../lib/commands'
import { BlendModePicker } from '../BlendModePicker'
import { LayersPanel } from '../LayersPanel'
import { Slider } from '../Slider'
import type { InspectorPanelProps } from './types'

const LAYERS_HEIGHT_KEY = 'carson.layersHeight.v1'

function readStoredLayersHeight(): number | null {
  try {
    const raw = localStorage.getItem(LAYERS_HEIGHT_KEY)
    const num = raw ? Number(raw) : NaN
    return Number.isFinite(num) && num >= 140 && num <= 560 ? num : null
  } catch {
    return null
  }
}

type LayersDockProps = Pick<
  InspectorPanelProps,
  | 'selected'
  | 'layers'
  | 'selectedLayerIds'
  | 'renamingLayerId'
  | 'dragLayerId'
  | 'onSelectLayer'
  | 'onToggleLayerVisibility'
  | 'onToggleLayerLock'
  | 'onRenameLayerStart'
  | 'onRenameLayerEnd'
  | 'onDragLayerStart'
  | 'onDragLayerOver'
  | 'onDragLayerEnd'
  | 'onZoomToLayer'
  | 'onPreviewBlendMode'
  | 'onApplyBlendMode'
  | 'onUpdateActive'
  | 'onFinalizeActive'
  | 'onAddAdjustment'
  | 'canGroupLayers'
  | 'canUngroupLayers'
  | 'onGroupLayers'
  | 'onUngroupLayers'
  | 'onDuplicateLayer'
  | 'onDeleteLayer'
> & {
  inspectorAsideRef: RefObject<HTMLElement | null>
}

export function LayersDock({
  inspectorAsideRef,
  selected,
  layers,
  selectedLayerIds,
  renamingLayerId,
  dragLayerId,
  onSelectLayer,
  onToggleLayerVisibility,
  onToggleLayerLock,
  onRenameLayerStart,
  onRenameLayerEnd,
  onDragLayerStart,
  onDragLayerOver,
  onDragLayerEnd,
  onZoomToLayer,
  onPreviewBlendMode,
  onApplyBlendMode,
  onUpdateActive,
  onFinalizeActive,
  onAddAdjustment,
  canGroupLayers,
  canUngroupLayers,
  onGroupLayers,
  onUngroupLayers,
  onDuplicateLayer,
  onDeleteLayer,
}: LayersDockProps) {
  const [layersOpen, setLayersOpen] = useState(true)
  const [layersHeight, setLayersHeight] = useState<number | null>(() => readStoredLayersHeight())
  const [collapsedLayerIds, setCollapsedLayerIds] = useState<ReadonlySet<string>>(() => new Set())
  const layersDragRef = useRef<{ startY: number; startHeight: number } | null>(null)

  const toggleLayerCollapsed = useCallback((id: string) => {
    setCollapsedLayerIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleLayersSplitDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !layersOpen) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const dockEl = inspectorAsideRef.current?.querySelector<HTMLElement>('.layers-dock')
    const startHeight = dockEl?.getBoundingClientRect().height ?? layersHeight ?? 260
    layersDragRef.current = { startY: event.clientY, startHeight }
  }

  const handleLayersSplitMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = layersDragRef.current
    if (!drag) return
    const asideHeight = inspectorAsideRef.current?.getBoundingClientRect().height ?? 760
    const maxHeight = Math.max(180, Math.min(560, asideHeight - 200))
    const next = Math.round(Math.min(maxHeight, Math.max(140, drag.startHeight + (drag.startY - event.clientY))))
    setLayersHeight(next)
  }

  const handleLayersSplitEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!layersDragRef.current) return
    layersDragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (layersHeight !== null) {
      try {
        localStorage.setItem(LAYERS_HEIGHT_KEY, String(layersHeight))
      } catch {
        // Ignore storage errors in private mode.
      }
    }
  }

  const resetLayersHeight = () => {
    setLayersHeight(null)
    try {
      localStorage.removeItem(LAYERS_HEIGHT_KEY)
    } catch {
      // Ignore storage errors.
    }
  }

  return (
    <>
      {layersOpen ? (
        <div
          className="layers-splitter"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize layers panel"
          title="Drag to resize · double-click to reset"
          onPointerDown={handleLayersSplitDown}
          onPointerMove={handleLayersSplitMove}
          onPointerUp={handleLayersSplitEnd}
          onPointerCancel={handleLayersSplitEnd}
          onDoubleClick={resetLayersHeight}
        />
      ) : null}

      <section
        className={layersOpen ? 'layers-dock' : 'layers-dock is-collapsed'}
        aria-label="Layers"
        style={layersOpen && layersHeight !== null ? { flex: `0 0 ${layersHeight}px` } : undefined}
      >
        <div className="layers-header">
          <button
            type="button"
            className="layers-toggle"
            aria-expanded={layersOpen}
            aria-controls="layers-dock-body"
            onClick={() => setLayersOpen((open) => !open)}
          >
            <ChevronDown size={14} aria-hidden="true" className="layers-toggle-caret" />
            <h2>Layers</h2>
          </button>
          <span className="layers-count" aria-label={`${layers.length} layers`}>
            {layers.length}
          </span>
        </div>
        <div id="layers-dock-body" className="layers-dock-body" hidden={!layersOpen}>
          <div className={selected ? 'layers-props' : 'layers-props is-disabled'}>
            <div className="layers-blend" title="Blend mode">
              {selected ? (
                <BlendModePicker
                  value={selected.blendMode ?? 'source-over'}
                  onPreview={onPreviewBlendMode}
                  onChange={onApplyBlendMode}
                />
              ) : (
                <button type="button" className="layers-blend-placeholder" disabled>
                  Normal
                </button>
              )}
            </div>
            <Slider
              variant="field"
              label="Opacity"
              defaultValue={100}
              disabled={!selected}
              value={selected ? Math.round(selected.opacity * 100) : 100}
              min={5}
              max={100}
              format={formatPercent}
              onChange={(value) => onUpdateActive({ opacity: value / 100 })}
              onCommit={() => onFinalizeActive('Changed opacity')}
            />
          </div>
          <LayersPanel
            layers={layers}
            selectedIds={selectedLayerIds}
            renamingLayerId={renamingLayerId}
            dragLayerId={dragLayerId}
            onSelect={onSelectLayer}
            onToggleVisibility={onToggleLayerVisibility}
            onToggleLock={onToggleLayerLock}
            onRenameStart={onRenameLayerStart}
            onRenameEnd={onRenameLayerEnd}
            onDragStart={onDragLayerStart}
            onDragOver={onDragLayerOver}
            onDragEnd={onDragLayerEnd}
            onZoomToLayer={onZoomToLayer}
            collapsedIds={collapsedLayerIds}
            onToggleCollapsed={toggleLayerCollapsed}
          />
          <div className="layers-footer" role="toolbar" aria-label="Layer actions">
            {onAddAdjustment ? (
              <label className="layers-footer-button layers-adjustment" title="New adjustment layer">
                <Contrast size={16} aria-hidden="true" />
                <select
                  aria-label="Add adjustment layer"
                  value=""
                  onChange={(event) => {
                    const type = event.target.value as AdjustmentType
                    if (type) onAddAdjustment(type)
                  }}
                >
                  <option value="" disabled>
                    Adjustment layer
                  </option>
                  {(Object.keys(ADJUSTMENT_LABELS) as AdjustmentType[]).map((type) => (
                    <option key={type} value={type}>
                      {ADJUSTMENT_LABELS[type]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button
              type="button"
              className="layers-footer-button"
              title={`Group layers (${formatModKey('g')})`}
              aria-label="Group layers"
              disabled={!canGroupLayers}
              onClick={onGroupLayers}
            >
              <Group size={16} aria-hidden />
            </button>
            <button
              type="button"
              className="layers-footer-button"
              title={`Ungroup (${formatModKey('g', true)})`}
              aria-label="Ungroup"
              disabled={!canUngroupLayers}
              onClick={onUngroupLayers}
            >
              <Ungroup size={16} aria-hidden />
            </button>
            <span className="layers-footer-spacer" />
            {onDuplicateLayer ? (
              <button
                type="button"
                className="layers-footer-button"
                title={`Duplicate layer (${formatModKey('d')})`}
                aria-label="Duplicate layer"
                disabled={!selected}
                onClick={onDuplicateLayer}
              >
                <Copy size={16} aria-hidden />
              </button>
            ) : null}
            {onDeleteLayer ? (
              <button
                type="button"
                className="layers-footer-button"
                title="Delete layer (⌫)"
                aria-label="Delete layer"
                disabled={!selected}
                onClick={onDeleteLayer}
              >
                <Trash2 size={16} aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </>
  )
}
