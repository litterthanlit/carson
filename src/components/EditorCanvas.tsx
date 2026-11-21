import { memo, type CSSProperties, type DragEvent, type MouseEvent, type ReactNode, type RefObject } from 'react'
import { Dices, Eye, Grid3x3, Maximize, ZoomIn, ZoomOut } from 'lucide-react'
import { LayoutGuidesOverlay } from './LayoutGuidesOverlay'
import { ViewportRulers } from './ViewportRulers'
import type { LayoutGuide } from '../lib/grid'
import { formatModKey } from '../lib/commands'
import type { PosterPreset, PosterPresetId } from '../lib/editorModel'
import type { DocumentMeta } from '../lib/document'

type EditorCanvasProps = {
  poster: PosterPreset
  displayScale: number
  /** Extra working space around the poster when zoomed past fit, so zoom can anchor anywhere. */
  pasteboard: { x: number; y: number } | null
  status: string
  isPanMode: boolean
  documentMeta: DocumentMeta | null
  lastChaos: { label: string; seed: number } | null
  presetId: PosterPresetId
  customSize: { width: number; height: number }
  canvasEl: RefObject<HTMLCanvasElement | null>
  scrollRef: RefObject<HTMLDivElement | null>
  hud?: ReactNode
  stackBar?: ReactNode
  /** Floating options for the active tool (e.g. the brush bar). */
  toolBar?: ReactNode
  /** Docked floating effects drawer anchored to the viewport height. */
  palette?: ReactNode
  coach?: ReactNode
  chromeHidden?: boolean
  onRestoreChrome?: () => void
  onPresetChange: (presetId: PosterPresetId) => void
  onCustomSizeChange: (size: { width: number; height: number }) => void
  onSwitchArtboard: (artboardId: string) => void
  onChangeArtboardPreset: (artboardId: string, presetId: string) => void
  onStepZoom: (direction: 1 | -1) => void
  onZoom100: () => void
  onZoomFit: () => void
  onReroll: () => void
  onPanMouseDown: (event: MouseEvent) => void
  onPanMouseMove: (event: MouseEvent) => void
  onPanMouseUp: () => void
  onAssetDrop: (assetId: string) => void
  onComponentDrop: (componentId: string) => void
  showLayoutGrid: boolean
  onToggleLayoutGrid: () => void
  layoutGuides: LayoutGuide[]
  onAddLayoutGuide: (axis: 'v' | 'h', position: number) => void
  onMoveLayoutGuide: (id: string, position: number) => void
  onRemoveLayoutGuide: (id: string) => void
}

export const EditorCanvas = memo(function EditorCanvas({
  poster,
  displayScale,
  pasteboard,
  status,
  isPanMode,
  documentMeta,
  lastChaos,
  presetId,
  customSize,
  canvasEl,
  scrollRef,
  hud,
  stackBar,
  toolBar,
  palette,
  coach,
  chromeHidden = false,
  onRestoreChrome,
  onPresetChange,
  onCustomSizeChange,
  onSwitchArtboard,
  onChangeArtboardPreset,
  onStepZoom,
  onZoom100,
  onZoomFit,
  onReroll,
  onPanMouseDown,
  onPanMouseMove,
  onPanMouseUp,
  onAssetDrop,
  onComponentDrop,
  showLayoutGrid,
  onToggleLayoutGrid,
  layoutGuides,
  onAddLayoutGuide,
  onMoveLayoutGuide,
  onRemoveLayoutGuide,
}: EditorCanvasProps) {
  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    const assetId = event.dataTransfer.getData('text/carson-asset')
    if (assetId) onAssetDrop(assetId)
    const componentId = event.dataTransfer.getData('text/carson-component')
    if (componentId) onComponentDrop(componentId)
  }

  const hasMultipleArtboards = Boolean(documentMeta && documentMeta.artboards.length > 1)

  return (
    <section className={chromeHidden ? 'canvas-stage is-zen' : 'canvas-stage'} aria-label="Poster canvas">
      {!chromeHidden && hasMultipleArtboards && documentMeta ? (
        <div className="artboard-bar">
          <span className="artboard-tabs">
            {documentMeta.artboards.map((board) => (
              <span key={board.id} className="artboard-tab-group">
                <button
                  type="button"
                  className={board.id === documentMeta.activeArtboardId ? 'active' : undefined}
                  onClick={() => onSwitchArtboard(board.id)}
                >
                  {board.name}
                </button>
                {board.id === documentMeta.activeArtboardId ? (
                  <select
                    className="artboard-preset-select"
                    aria-label={`Preset for ${board.name}`}
                    value={board.preset.id}
                    onChange={(event) => onChangeArtboardPreset(board.id, event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <option value="a3">A3</option>
                    <option value="a2">A2</option>
                    <option value="instagram">IG</option>
                    <option value="square">Square</option>
                  </select>
                ) : null}
              </span>
            ))}
          </span>
        </div>
      ) : null}

      <div className="canvas-viewport">
        {!chromeHidden ? palette : null}
        {!chromeHidden ? (
          toolBar ? (
            <div className="canvas-tool-float">{toolBar}</div>
          ) : stackBar ? (
            <div className="canvas-stack-float">{stackBar}</div>
          ) : null
        ) : null}
        {!chromeHidden ? (
          <ViewportRulers
            scrollRef={scrollRef}
            displayScale={displayScale}
            posterWidth={poster.width}
            posterHeight={poster.height}
            dpi={poster.dpi}
            onAddGuide={onAddLayoutGuide}
          />
        ) : null}
        <div
          ref={scrollRef}
          className={isPanMode ? 'canvas-scroll panning' : 'canvas-scroll'}
          tabIndex={0}
          role="application"
          aria-label="Poster canvas workspace. Tab cycles layers. Arrow keys nudge the selection."
          onMouseDown={(event) => {
            scrollRef.current?.focus({ preventScroll: true })
            onPanMouseDown(event)
          }}
          onMouseMove={onPanMouseMove}
          onMouseUp={onPanMouseUp}
          onMouseLeave={onPanMouseUp}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <div
            className="canvas-shell"
            style={
              {
                '--poster-width': `${poster.width}px`,
                '--poster-height': `${poster.height}px`,
                '--poster-display-width': `${poster.width * displayScale}px`,
                '--poster-display-height': `${poster.height * displayScale}px`,
                ...(pasteboard ? { margin: `${pasteboard.y}px ${pasteboard.x}px` } : null),
              } as CSSProperties
            }
          >
            <canvas ref={canvasEl} />
            <LayoutGuidesOverlay
              posterWidth={poster.width}
              posterHeight={poster.height}
              displayScale={displayScale}
              guides={layoutGuides}
              onAddGuide={onAddLayoutGuide}
              onMoveGuide={onMoveLayoutGuide}
              onRemoveGuide={onRemoveLayoutGuide}
            />
            {hud}
          </div>
        </div>

        {!chromeHidden ? (
          <div className="canvas-stage-float" role="toolbar" aria-label="Canvas controls">
            <div className="stage-toolbar stage-pill">
              <span className="zoom-controls">
                <button type="button" className="icon-button" aria-label="Zoom out" title={`Zoom out (${formatModKey('-')})`} onClick={() => onStepZoom(-1)}>
                  <ZoomOut size={14} aria-hidden />
                </button>
                <button type="button" className="zoom-readout" title={`Reset to 100% (${formatModKey('1')})`} onClick={onZoom100}>
                  {Math.round(displayScale * 100)}%
                </button>
                <button type="button" className="icon-button" aria-label="Zoom in" title={`Zoom in (${formatModKey('=')})`} onClick={() => onStepZoom(1)}>
                  <ZoomIn size={14} aria-hidden />
                </button>
                <button type="button" className="icon-button" aria-label="Fit poster to view" title={`Fit to view (${formatModKey('0')})`} onClick={onZoomFit}>
                  <Maximize size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  className={showLayoutGrid ? 'icon-button active' : 'icon-button'}
                  aria-label="Toggle layout grid"
                  aria-pressed={showLayoutGrid}
                  title="Layout grid (G)"
                  onClick={onToggleLayoutGrid}
                >
                  <Grid3x3 size={14} aria-hidden />
                </button>
              </span>
              <span className="stage-pill-sep" aria-hidden="true" />
              <label className="stage-size">
                <span className="visually-hidden">Poster size</span>
                <select value={presetId} aria-label="Poster size" onChange={(event) => onPresetChange(event.target.value as PosterPresetId)}>
                  <option value="a3">A3</option>
                  <option value="a2">A2</option>
                  <option value="instagram">IG</option>
                  <option value="square">Square</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              {presetId === 'custom' ? (
                <span className="stage-custom-size">
                  <input
                    type="number"
                    min={320}
                    max={10000}
                    aria-label="Custom width"
                    value={customSize.width}
                    onChange={(event) => onCustomSizeChange({ ...customSize, width: Number(event.target.value) })}
                  />
                  ×
                  <input
                    type="number"
                    min={320}
                    max={10000}
                    aria-label="Custom height"
                    value={customSize.height}
                    onChange={(event) => onCustomSizeChange({ ...customSize, height: Number(event.target.value) })}
                  />
                </span>
              ) : (
                <span className="stage-dims">
                  {poster.width} × {poster.height}px
                  {poster.dpi ? ` · ${poster.dpi}dpi` : ''}
                </span>
              )}
              <span className="stage-pill-sep stage-status-sep" aria-hidden="true" />
              <span role="status" aria-live="polite" className="stage-pill-status">
                {status}
              </span>
            </div>
            {lastChaos ? (
              <button
                type="button"
                className="reroll-button stage-reroll-pill"
                data-tour="reroll"
                aria-label="Re-roll last accident"
                title={`Undo and re-run ${lastChaos.label} with a new seed (R)`}
                onClick={onReroll}
              >
                <Dices size={14} aria-hidden />
                Re-roll {lastChaos.label} #{lastChaos.seed}
              </button>
            ) : null}
          </div>
        ) : onRestoreChrome ? (
          <button
            type="button"
            className="zen-restore-pill"
            title={`Show interface (${formatModKey('\\')})`}
            onClick={onRestoreChrome}
          >
            <Eye size={14} aria-hidden />
            Show UI
          </button>
        ) : null}
      </div>

      {coach}
    </section>
  )
})
