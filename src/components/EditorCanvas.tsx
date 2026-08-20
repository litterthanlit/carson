import type { CSSProperties, DragEvent, MouseEvent, ReactNode, RefObject } from 'react'
import { LayoutGuidesOverlay } from './LayoutGuidesOverlay'
import type { LayoutGuide } from '../lib/grid'
import { Dices, Grid3x3, Maximize, ZoomIn, ZoomOut } from 'lucide-react'
import type { PosterPreset, PosterPresetId } from '../lib/editorModel'
import type { DocumentMeta } from '../lib/document'
import { ExplorationTrail } from './ExplorationTrail'

type EditorCanvasProps = {
  poster: PosterPreset
  displayScale: number
  status: string
  isPanMode: boolean
  documentMeta: DocumentMeta | null
  lastChaos: { label: string; seed: number } | null
  projectName: string
  presetId: PosterPresetId
  customSize: { width: number; height: number }
  canvasEl: RefObject<HTMLCanvasElement | null>
  scrollRef: RefObject<HTMLDivElement | null>
  hud?: ReactNode
  stackBar?: ReactNode
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
  onRestoreVariant: (variantId: string) => void
  onForkVariant: () => void
  showLayoutGrid: boolean
  onToggleLayoutGrid: () => void
  layoutGuides: LayoutGuide[]
  onAddLayoutGuide: (axis: 'v' | 'h', position: number) => void
  onMoveLayoutGuide: (id: string, position: number) => void
  onRemoveLayoutGuide: (id: string) => void
}

export function EditorCanvas({
  poster,
  displayScale,
  status,
  isPanMode,
  documentMeta,
  lastChaos,
  projectName,
  presetId,
  customSize,
  canvasEl,
  scrollRef,
  hud,
  stackBar,
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
  onRestoreVariant,
  onForkVariant,
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
  }

  return (
    <section className="canvas-stage" aria-label="Poster canvas">
      <div className="stage-toolbar glass-bar">
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
          <span>
            {poster.width} × {poster.height}px
            {poster.dpi ? ` @ ${poster.dpi}dpi` : ''}
          </span>
        )}
        {documentMeta && documentMeta.artboards.length > 1 ? (
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
        ) : null}
        <span className="zoom-controls">
          <button type="button" className="icon-button" aria-label="Zoom out" title="Zoom out (Cmd+-)" onClick={() => onStepZoom(-1)}>
            <ZoomOut size={15} />
          </button>
          <button type="button" className="zoom-readout" title="Reset to 100% (Cmd+1)" onClick={onZoom100}>
            {Math.round(displayScale * 100)}%
          </button>
          <button type="button" className="icon-button" aria-label="Zoom in" title="Zoom in (Cmd+=)" onClick={() => onStepZoom(1)}>
            <ZoomIn size={15} />
          </button>
          <button type="button" className="icon-button" aria-label="Fit poster to view" title="Fit to view (Cmd+0)" onClick={onZoomFit}>
            <Maximize size={15} />
          </button>
          <button
            type="button"
            className={showLayoutGrid ? 'icon-button active' : 'icon-button'}
            aria-label="Toggle layout grid"
            aria-pressed={showLayoutGrid}
            title="Layout grid (G)"
            onClick={onToggleLayoutGrid}
          >
            <Grid3x3 size={15} />
          </button>
        </span>
        {lastChaos ? (
          <button
            type="button"
            className="reroll-button"
            title={`Undo and re-run ${lastChaos.label} with a new seed (R)`}
            onClick={onReroll}
          >
            <Dices size={14} />
            Re-roll {lastChaos.label} #{lastChaos.seed}
          </button>
        ) : null}
        <span role="status" aria-live="polite" className="stage-status">
          {status}
        </span>
      </div>
      {stackBar}
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
      <ExplorationTrail
        variants={documentMeta?.variants ?? []}
        activeLabel={projectName}
        onSelect={onRestoreVariant}
        onFork={onForkVariant}
      />
    </section>
  )
}
