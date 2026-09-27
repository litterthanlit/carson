import { memo, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent, type ReactNode, type RefObject } from 'react'
import { LayoutGuidesOverlay } from './LayoutGuidesOverlay'
import { ViewportRulers } from './ViewportRulers'
import type { LayoutGuide } from '../lib/grid'
import { Dices, Grid3x3, ImagePlus, Maximize, RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react'
import { getPosterPreset, type PosterPreset, type PosterPresetId } from '../lib/editorModel'
import { POSTER_PRESET_OPTIONS } from '../lib/editorConstants'
import type { DocumentMeta } from '../lib/document'
import { ExplorationTrail } from './ExplorationTrail'
import type { TrailFrame } from '../lib/explorationTrail'

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
  coach?: ReactNode
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
  /** Image files dropped from the desktop; `point` is in poster pixels (null if off-canvas). */
  onImageFilesDrop: (files: File[], point: { x: number; y: number } | null) => void
  /** Rotate the whole poster (page + every layer) a quarter turn. */
  onRotatePoster: (direction: 1 | -1) => void
  trailFrames: TrailFrame[]
  trailOpIds: string[]
  trailCursor: number
  trailCollapsed: boolean
  onToggleTrailCollapsed: () => void
  onJumpTrail: (opId: string) => void
  onForkVariant: () => void
  onOpenCompsGallery: () => void
  showLayoutGrid: boolean
  onToggleLayoutGrid: () => void
  layoutGuides: LayoutGuide[]
  onAddLayoutGuide: (axis: 'v' | 'h', position: number) => void
  onMoveLayoutGuide: (id: string, position: number) => void
  onRemoveLayoutGuide: (id: string) => void
}

/** Vertical / Horizontal (+ Custom), plus the current size when it is a legacy named preset. */
function PresetOptions({ current, includeCustom = true }: { current: PosterPresetId; includeCustom?: boolean }) {
  const options = POSTER_PRESET_OPTIONS.filter((option) => includeCustom || option.id !== 'custom')
  const legacy = options.some((option) => option.id === current) ? null : getPosterPreset(current)
  return (
    <>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
      {legacy ? <option value={legacy.id}>{legacy.name}</option> : null}
    </>
  )
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
  coach,
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
  onImageFilesDrop,
  onRotatePoster,
  trailFrames,
  trailOpIds,
  trailCursor,
  trailCollapsed,
  onToggleTrailCollapsed,
  onJumpTrail,
  onForkVariant,
  onOpenCompsGallery,
  showLayoutGrid,
  onToggleLayoutGrid,
  layoutGuides,
  onAddLayoutGuide,
  onMoveLayoutGuide,
  onRemoveLayoutGuide,
}: EditorCanvasProps) {
  const dragDepth = useRef(0)
  const [fileDropActive, setFileDropActive] = useState(false)
  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files')

  const dropPoint = (event: DragEvent) => {
    const rect = canvasEl.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return null
    const x = ((event.clientX - rect.left) / rect.width) * poster.width
    const y = ((event.clientY - rect.top) / rect.height) * poster.height
    if (x < 0 || y < 0 || x > poster.width || y > poster.height) return null
    return { x, y }
  }

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    dragDepth.current = 0
    setFileDropActive(false)
    if (hasFiles(event)) {
      const images = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith('image/'))
      if (images.length) onImageFilesDrop(images, dropPoint(event))
      return
    }
    const assetId = event.dataTransfer.getData('text/carson-asset')
    if (assetId) onAssetDrop(assetId)
    const componentId = event.dataTransfer.getData('text/carson-component')
    if (componentId) onComponentDrop(componentId)
  }

  return (
    <section className="canvas-stage" aria-label="Poster canvas">
      <div className="stage-toolbar glass-bar">
        <label className="stage-size">
          <span className="visually-hidden">Poster size</span>
          <select value={presetId} aria-label="Poster size" onChange={(event) => onPresetChange(event.target.value as PosterPresetId)}>
            <PresetOptions current={presetId} />
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
                    <PresetOptions current={board.preset.id} includeCustom={false} />
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
          <button type="button" className="icon-button" aria-label="Rotate poster left" title="Rotate poster 90° left (Shift+Alt+R)" onClick={() => onRotatePoster(-1)}>
            <RotateCcw size={15} />
          </button>
          <button type="button" className="icon-button" aria-label="Rotate poster right" title="Rotate poster 90° right (Alt+R)" onClick={() => onRotatePoster(1)}>
            <RotateCw size={15} />
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
            data-tour="reroll"
            aria-label="Re-roll last accident"
            title={`Undo and re-run ${lastChaos.label} with a new seed (R)`}
            onClick={onReroll}
          >
            <Dices size={14} />
            Re-roll {lastChaos.label} #{lastChaos.seed}
          </button>
        ) : null}
      </div>
      <div className="canvas-viewport">
      {toolBar ? <div className="canvas-tool-float">{toolBar}</div> : stackBar ? <div className="canvas-stack-float">{stackBar}</div> : null}
      <ViewportRulers
        scrollRef={scrollRef}
        displayScale={displayScale}
        posterWidth={poster.width}
        posterHeight={poster.height}
        dpi={poster.dpi}
        onAddGuide={onAddLayoutGuide}
      />
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
        onDragEnter={(event) => {
          if (!hasFiles(event)) return
          dragDepth.current += 1
          setFileDropActive(true)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          if (hasFiles(event)) event.dataTransfer.dropEffect = 'copy'
        }}
        onDragLeave={(event) => {
          if (!hasFiles(event)) return
          dragDepth.current = Math.max(0, dragDepth.current - 1)
          if (dragDepth.current === 0) setFileDropActive(false)
        }}
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
      {fileDropActive ? (
        <div className="canvas-drop-overlay" aria-hidden="true">
          <ImagePlus size={24} strokeWidth={1.5} />
          <strong>Drop to place on the poster</strong>
          <small>Images land where you let go</small>
        </div>
      ) : null}
      </div>
      <ExplorationTrail
        frames={trailFrames}
        opIds={trailOpIds}
        cursor={trailCursor}
        collapsed={trailCollapsed}
        variantCount={documentMeta?.variants.length ?? 0}
        status={status}
        onToggleCollapsed={onToggleTrailCollapsed}
        onJump={onJumpTrail}
        onFork={onForkVariant}
        onOpenGallery={onOpenCompsGallery}
      />
      {coach}
    </section>
  )
})
