import { memo, useEffect, useRef, useState, type RefObject } from 'react'
import {
  Circle,
  CircleDashed,
  Crop,
  Eraser,
  ImagePlus,
  Lasso,
  Layers2,
  Minus,
  MousePointer2,
  Paintbrush,
  PenLine,
  Pencil,
  Scissors,
  Square,
  SquareDashed,
  Star,
  Type,
} from 'lucide-react'
import type { EditorTool, PenKind } from '../types/editor'
import type { SelectionMode } from '../lib/selection'
import {
  EffectsPressIcon,
  FlyoutCornerCaret,
  FrameHandlesIcon,
  MaskIcon,
} from './icons/StudioIcons'

type Flyout = 'shape' | 'select' | 'brush' | 'mask' | null

type ToolRailProps = {
  tool: EditorTool
  penMode: boolean
  penKind: PenKind
  fileInputRef: RefObject<HTMLInputElement | null>
  onToolChange: (tool: EditorTool) => void
  onAddShape: () => void
  onAddEllipse: () => void
  onAddLine: () => void
  onAddStar: () => void
  onTogglePenMode: () => void
  onTogglePencilMode: () => void
  onImageInputChange: (file: File) => void
  onClipToShape: () => void
  onWeave: () => void
  onTearEdges: () => void
  onBrushMask: () => void
  onWhiteScrapes: () => void
  selectMode?: SelectionMode
  onSelectModeChange?: (mode: SelectionMode) => void
  brushErase?: boolean
  onBrushModeChange?: (erase: boolean) => void
}

export const ToolRail = memo(function ToolRail({
  tool,
  penMode,
  penKind,
  fileInputRef,
  onToolChange,
  onAddShape,
  onAddEllipse,
  onAddLine,
  onAddStar,
  onTogglePenMode,
  onTogglePencilMode,
  onImageInputChange,
  onClipToShape,
  onWeave,
  onTearEdges,
  onBrushMask,
  onWhiteScrapes,
  selectMode = 'rect',
  onSelectModeChange,
  brushErase = false,
  onBrushModeChange,
}: ToolRailProps) {
  const SelectIcon = selectMode === 'ellipse' ? CircleDashed : selectMode === 'lasso' ? Lasso : SquareDashed
  const [flyout, setFlyout] = useState<Flyout>(null)
  const rootRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!flyout) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setFlyout(null)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [flyout])

  const selectTool = (next: EditorTool) => {
    onToolChange(next)
    setFlyout(null)
  }

  return (
    <nav className="tool-rail" aria-label="Tools" ref={rootRef}>
      <button
        type="button"
        className={tool === 'move' ? 'active' : undefined}
        title="Move (V)"
        aria-label="Move tool"
        aria-pressed={tool === 'move'}
        onClick={() => selectTool('move')}
      >
        <MousePointer2 size={18} aria-hidden />
      </button>
      <span className="tool-rail-rule" aria-hidden="true" />
      <button
        type="button"
        className={tool === 'text' ? 'active' : undefined}
        title="Text — click the canvas to place (T)"
        aria-label="Text tool"
        aria-pressed={tool === 'text'}
        onClick={() => selectTool('text')}
      >
        <Type size={18} aria-hidden />
      </button>
      <div className="tool-rail-flyout-wrap">
        <button
          type="button"
          className={tool === 'shape' ? 'has-flyout active' : 'has-flyout'}
          title="Shape (S) — Block, ellipse, line, star, pen"
          aria-label="Shape tool"
          aria-pressed={tool === 'shape'}
          aria-expanded={flyout === 'shape'}
          onClick={() => {
            onToolChange('shape')
            setFlyout((current) => (current === 'shape' ? null : 'shape'))
          }}
        >
          <Square size={18} aria-hidden />
          <FlyoutCornerCaret />
        </button>
        {flyout === 'shape' ? (
          <div className="tool-flyout" role="menu" aria-label="Shape tools">
            <button type="button" role="menuitem" title="Add a solid block" onClick={() => { onAddShape(); setFlyout(null) }}>
              <Square size={14} aria-hidden /> Block
            </button>
            <button type="button" role="menuitem" title="Add an ellipse" onClick={() => { onAddEllipse(); setFlyout(null) }}>
              <Circle size={14} aria-hidden /> Ellipse
            </button>
            <button type="button" role="menuitem" title="Add a line" onClick={() => { onAddLine(); setFlyout(null) }}>
              <Minus size={14} aria-hidden /> Line
            </button>
            <button type="button" role="menuitem" title="Add a star" onClick={() => { onAddStar(); setFlyout(null) }}>
              <Star size={14} aria-hidden /> Star
            </button>
            <button
              type="button"
              role="menuitem"
              className={penMode && penKind === 'bezier' ? 'active' : undefined}
              title="Click-to-place bezier pen (P)"
              aria-label="Pen"
              aria-pressed={penMode && penKind === 'bezier'}
              onClick={() => {
                onTogglePenMode()
                setFlyout(null)
              }}
            >
              <PenLine size={14} aria-hidden /> Pen
            </button>
            <button
              type="button"
              role="menuitem"
              className={penMode && penKind === 'freehand' ? 'active' : undefined}
              title="Draw a freehand pencil stroke"
              aria-label="Pencil"
              aria-pressed={penMode && penKind === 'freehand'}
              onClick={() => {
                onTogglePencilMode()
                setFlyout(null)
              }}
            >
              <Pencil size={14} aria-hidden /> Pencil
            </button>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className={tool === 'frame' ? 'active' : undefined}
        title="Frame (F) — drag frame handles onto the poster, or click a layer to frame it"
        aria-label="Frame tool"
        aria-pressed={tool === 'frame'}
        onClick={() => selectTool(tool === 'frame' ? 'move' : 'frame')}
      >
        <FrameHandlesIcon size={18} aria-hidden />
      </button>
      <button
        type="button"
        className={tool === 'image' ? 'active' : undefined}
        title="Import an image"
        aria-label="Image tool"
        aria-pressed={tool === 'image'}
        onClick={() => {
          selectTool('image')
          fileInputRef.current?.click()
        }}
      >
        <ImagePlus size={18} aria-hidden />
      </button>
      <span className="tool-rail-rule" aria-hidden="true" />
      {onSelectModeChange ? (
        <div className="tool-rail-flyout-wrap">
          <button
            type="button"
            className={tool === 'select' ? 'has-flyout active' : 'has-flyout'}
            title="Select (L) — marquee or lasso a region, then mask it or lift it to a new layer"
            aria-label="Select tool"
            aria-pressed={tool === 'select'}
            aria-expanded={flyout === 'select'}
            onClick={() => {
              onToolChange('select')
              setFlyout((current) => (current === 'select' ? null : 'select'))
            }}
          >
            <SelectIcon size={18} aria-hidden />
            <FlyoutCornerCaret />
          </button>
          {flyout === 'select' ? (
            <div className="tool-flyout" role="menu" aria-label="Selection tools">
              {(
                [
                  ['rect', 'Rectangle marquee', SquareDashed],
                  ['ellipse', 'Ellipse marquee', CircleDashed],
                  ['lasso', 'Lasso', Lasso],
                ] as const
              ).map(([mode, label, Icon]) => (
                <button
                  key={mode}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selectMode === mode}
                  onClick={() => {
                    onSelectModeChange(mode)
                    selectTool('select')
                  }}
                >
                  <Icon size={14} aria-hidden /> {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {onBrushModeChange ? (
        <div className="tool-rail-flyout-wrap">
          <button
            type="button"
            className={tool === 'brush' ? 'has-flyout active' : 'has-flyout'}
            title="Brush (B) · Eraser (E) — pressure-sensitive paint on its own layer"
            aria-label="Brush tool"
            aria-pressed={tool === 'brush'}
            aria-expanded={flyout === 'brush'}
            onClick={() => {
              onToolChange('brush')
              setFlyout((current) => (current === 'brush' ? null : 'brush'))
            }}
          >
            {brushErase ? <Eraser size={18} aria-hidden /> : <Paintbrush size={18} aria-hidden />}
            <FlyoutCornerCaret />
          </button>
          {flyout === 'brush' ? (
            <div className="tool-flyout" role="menu" aria-label="Brush tools">
              <button type="button" role="menuitemradio" aria-checked={!brushErase} onClick={() => { onBrushModeChange(false); selectTool('brush') }}>
                <Paintbrush size={14} aria-hidden /> Brush
              </button>
              <button type="button" role="menuitemradio" aria-checked={brushErase} onClick={() => { onBrushModeChange(true); selectTool('brush') }}>
                <Eraser size={14} aria-hidden /> Eraser
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="tool-rail-flyout-wrap">
        <button
          type="button"
          className={tool === 'mask' ? 'has-flyout active' : 'has-flyout'}
          title="Mask (M) — paint alpha, clip to shape, scrapes"
          aria-label="Mask tool"
          aria-pressed={tool === 'mask'}
          aria-expanded={flyout === 'mask'}
          onClick={() => {
            onToolChange('mask')
            setFlyout((current) => (current === 'mask' ? null : 'mask'))
          }}
        >
          <MaskIcon size={18} aria-hidden />
          <FlyoutCornerCaret />
        </button>
        {flyout === 'mask' ? (
          <div className="tool-flyout" role="menu" aria-label="Mask tools">
            <button type="button" role="menuitem" title="Clip the selection to a shape" onClick={() => { onClipToShape(); setFlyout(null) }}>
              <Crop size={14} aria-hidden /> Clip to shape
            </button>
            <button type="button" role="menuitem" title="Thread the selected word over and under the scraps it crosses" onClick={() => { onWeave(); setFlyout(null) }}>
              <Layers2 size={14} aria-hidden /> Weave through
            </button>
            <button type="button" role="menuitem" title="Rip the edges of the selected layer like torn paper" onClick={() => { onTearEdges(); setFlyout(null) }}>
              <Scissors size={14} aria-hidden /> Tear edges
            </button>
            <button type="button" role="menuitem" title="Paint a soft alpha mask on the selected layer" onClick={() => { onBrushMask(); setFlyout(null) }}>
              <MaskIcon size={14} aria-hidden /> Paint mask
            </button>
            <button type="button" role="menuitem" title="Scrape white bands across the poster" onClick={() => { onWhiteScrapes(); setFlyout(null) }}>
              <Eraser size={14} aria-hidden /> White scrapes
            </button>
          </div>
        ) : null}
      </div>
      <span className="tool-rail-rule" aria-hidden="true" />
      <button
        type="button"
        className={tool === 'instruments' ? 'active' : undefined}
        title="Effects (Instruments) — copy machine, scatter, decay, accidents (I)"
        aria-label="Effects"
        aria-pressed={tool === 'instruments'}
        onClick={() => selectTool(tool === 'instruments' ? 'move' : 'instruments')}
      >
        <EffectsPressIcon size={18} aria-hidden />
      </button>
      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onImageInputChange(file)
          event.currentTarget.value = ''
        }}
      />
    </nav>
  )
})
