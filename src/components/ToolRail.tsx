import { memo, useEffect, useRef, useState, type RefObject } from 'react'
import {
  Brush,
  Eraser as EraserIcon,
  Paintbrush,
  Circle,
  CircleDashed,
  Lasso,
  SquareDashed,
  Crop,
  Layers2,
  Scissors,
  Eraser,
  ImagePlus,
  Minus,
  MousePointer2,
  PenLine,
  Pencil,
  Square,
  Star,
  Type,
  VectorSquare,
  Wand2,
} from 'lucide-react'
import type { EditorTool, PenKind } from '../types/editor'
import type { SelectionMode } from '../lib/selection'
import { ariaKeyShortcuts, withShortcut } from '../lib/shortcuts'

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
        title={withShortcut('Move', 'moveTool')}
        aria-label="Move tool"
        aria-keyshortcuts={ariaKeyShortcuts('moveTool')}
        aria-pressed={tool === 'move'}
        onClick={() => selectTool('move')}
      >
        <MousePointer2 size={16} />
      </button>
      <span className="tool-rail-rule" aria-hidden="true" />
      <button
        type="button"
        className={tool === 'text' ? 'active' : undefined}
        title={withShortcut('Text — click the canvas to place', 'textTool')}
        aria-label="Text tool"
        aria-keyshortcuts={ariaKeyShortcuts('textTool')}
        aria-pressed={tool === 'text'}
        onClick={() => selectTool('text')}
      >
        <Type size={16} />
      </button>
      <div className="tool-rail-flyout-wrap">
        <button
          type="button"
          className={tool === 'shape' ? 'active' : undefined}
          title={`${withShortcut('Shape', 'shapeTool')} — block, ellipse, line, star, pen`}
          aria-label="Shape tool"
          aria-keyshortcuts={ariaKeyShortcuts('shapeTool')}
          aria-pressed={tool === 'shape'}
          aria-expanded={flyout === 'shape'}
          onClick={() => {
            onToolChange('shape')
            setFlyout((current) => (current === 'shape' ? null : 'shape'))
          }}
        >
          <Square size={16} />
        </button>
        {flyout === 'shape' ? (
          <div className="tool-flyout" role="menu" aria-label="Shape tools">
            <button type="button" role="menuitem" title="Add a solid block" onClick={() => { onAddShape(); setFlyout(null) }}>
              <Square size={14} /> Block
            </button>
            <button type="button" role="menuitem" title="Add an ellipse" onClick={() => { onAddEllipse(); setFlyout(null) }}>
              <Circle size={14} /> Ellipse
            </button>
            <button type="button" role="menuitem" title="Add a line" onClick={() => { onAddLine(); setFlyout(null) }}>
              <Minus size={14} /> Line
            </button>
            <button type="button" role="menuitem" title="Add a star" onClick={() => { onAddStar(); setFlyout(null) }}>
              <Star size={14} /> Star
            </button>
            <button
              type="button"
              role="menuitem"
              className={penMode && penKind === 'bezier' ? 'active' : undefined}
              title={withShortcut('Click-to-place bezier pen', 'penTool')}
              aria-label="Pen"
              aria-keyshortcuts={ariaKeyShortcuts('penTool')}
              aria-pressed={penMode && penKind === 'bezier'}
              onClick={() => {
                onTogglePenMode()
                setFlyout(null)
              }}
            >
              <PenLine size={14} /> Pen
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
              <Pencil size={14} /> Pencil
            </button>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className={tool === 'frame' ? 'active' : undefined}
        title={`${withShortcut('Frame', 'frameTool')} — drag frame handles onto the poster, or click a layer to frame it`}
        aria-label="Frame tool"
        aria-keyshortcuts={ariaKeyShortcuts('frameTool')}
        aria-pressed={tool === 'frame'}
        onClick={() => selectTool(tool === 'frame' ? 'move' : 'frame')}
      >
        <VectorSquare size={16} />
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
        <ImagePlus size={16} />
      </button>
      <span className="tool-rail-rule" aria-hidden="true" />
      {onSelectModeChange ? (
        <div className="tool-rail-flyout-wrap">
          <button
            type="button"
            className={tool === 'select' ? 'active' : undefined}
            title={`${withShortcut('Select', 'selectTool')} — marquee or lasso a region, then mask it or lift it to a new layer`}
            aria-label="Select tool"
            aria-keyshortcuts={ariaKeyShortcuts('selectTool')}
            aria-pressed={tool === 'select'}
            aria-expanded={flyout === 'select'}
            onClick={() => {
              onToolChange('select')
              setFlyout((current) => (current === 'select' ? null : 'select'))
            }}
          >
            <SelectIcon size={16} />
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
                  <Icon size={14} /> {label}
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
            className={tool === 'brush' ? 'active' : undefined}
            title={`${withShortcut('Brush', 'brushTool')} · ${withShortcut('Eraser', 'eraserTool')} — pressure-sensitive paint on its own layer`}
            aria-label="Brush tool"
            aria-keyshortcuts={ariaKeyShortcuts('brushTool')}
            aria-pressed={tool === 'brush'}
            aria-expanded={flyout === 'brush'}
            onClick={() => {
              onToolChange('brush')
              setFlyout((current) => (current === 'brush' ? null : 'brush'))
            }}
          >
            {brushErase ? <EraserIcon size={16} /> : <Paintbrush size={16} />}
          </button>
          {flyout === 'brush' ? (
            <div className="tool-flyout" role="menu" aria-label="Brush tools">
              <button type="button" role="menuitemradio" aria-checked={!brushErase} onClick={() => { onBrushModeChange(false); selectTool('brush') }}>
                <Paintbrush size={14} /> Brush
              </button>
              <button type="button" role="menuitemradio" aria-checked={brushErase} onClick={() => { onBrushModeChange(true); selectTool('brush') }}>
                <EraserIcon size={14} /> Eraser
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="tool-rail-flyout-wrap">
        <button
          type="button"
          className={tool === 'mask' ? 'active' : undefined}
          title={`${withShortcut('Mask', 'maskTool')} — paint alpha, clip to shape, scrapes`}
          aria-label="Mask tool"
          aria-keyshortcuts={ariaKeyShortcuts('maskTool')}
          aria-pressed={tool === 'mask'}
          aria-expanded={flyout === 'mask'}
          onClick={() => {
            onToolChange('mask')
            setFlyout((current) => (current === 'mask' ? null : 'mask'))
          }}
        >
          <Brush size={16} />
        </button>
        {flyout === 'mask' ? (
          <div className="tool-flyout" role="menu" aria-label="Mask tools">
            <button type="button" role="menuitem" title="Clip the selection to a shape" onClick={() => { onClipToShape(); setFlyout(null) }}>
              <Crop size={14} /> Clip to shape
            </button>
            <button type="button" role="menuitem" title="Thread the selected word over and under the scraps it crosses" onClick={() => { onWeave(); setFlyout(null) }}>
              <Layers2 size={14} /> Weave through
            </button>
            <button type="button" role="menuitem" title="Rip the edges of the selected layer like torn paper" onClick={() => { onTearEdges(); setFlyout(null) }}>
              <Scissors size={14} /> Tear edges
            </button>
            <button type="button" role="menuitem" title="Paint a soft alpha mask on the selected layer" onClick={() => { onBrushMask(); setFlyout(null) }}>
              <Circle size={14} /> Paint mask
            </button>
            <button type="button" role="menuitem" title="Scrape white bands across the poster" onClick={() => { onWhiteScrapes(); setFlyout(null) }}>
              <Eraser size={14} /> White scrapes
            </button>
          </div>
        ) : null}
      </div>
      <span className="tool-rail-rule" aria-hidden="true" />
      <button
        type="button"
        className={tool === 'instruments' ? 'active' : undefined}
        title={`${withShortcut('Instruments', 'instrumentsTool')} — xerox, scatter, decay, accidents`}
        aria-label="Instruments"
        aria-keyshortcuts={ariaKeyShortcuts('instrumentsTool')}
        aria-pressed={tool === 'instruments'}
        onClick={() => selectTool(tool === 'instruments' ? 'move' : 'instruments')}
      >
        <Wand2 size={16} />
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
