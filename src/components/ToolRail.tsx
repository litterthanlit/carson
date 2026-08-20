import { memo, useEffect, useRef, useState, type RefObject } from 'react'
import {
  BoxSelect,
  Circle,
  Crop,
  Eraser,
  ImagePlus,
  Minus,
  MousePointer2,
  PenLine,
  Square,
  Star,
  Type,
  Wand2,
} from 'lucide-react'
import type { EditorTool } from '../types/editor'

type Flyout = 'shape' | 'mask' | null

type ToolRailProps = {
  tool: EditorTool
  penMode: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  onToolChange: (tool: EditorTool) => void
  onAddShape: () => void
  onAddEllipse: () => void
  onAddLine: () => void
  onAddStar: () => void
  onTogglePenMode: () => void
  onImageInputChange: (file: File) => void
  onClipToShape: () => void
  onBrushMask: () => void
  onWhiteScrapes: () => void
}

export const ToolRail = memo(function ToolRail({
  tool,
  penMode,
  fileInputRef,
  onToolChange,
  onAddShape,
  onAddEllipse,
  onAddLine,
  onAddStar,
  onTogglePenMode,
  onImageInputChange,
  onClipToShape,
  onBrushMask,
  onWhiteScrapes,
}: ToolRailProps) {
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
        <MousePointer2 size={16} />
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
        <Type size={16} />
      </button>
      <div className="tool-rail-flyout-wrap">
        <button
          type="button"
          className={tool === 'shape' ? 'active' : undefined}
          title="Shape (S) — Block, ellipse, line, star, pen"
          aria-label="Shape tool"
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
            <button type="button" role="menuitem" title="Add a solid block (B)" onClick={() => { onAddShape(); setFlyout(null) }}>
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
              className={penMode ? 'active' : undefined}
              title="Draw freehand strokes (P)"
              onClick={() => {
                onTogglePenMode()
                setFlyout(null)
              }}
            >
              <PenLine size={14} /> Pen
            </button>
          </div>
        ) : null}
      </div>
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
      <div className="tool-rail-flyout-wrap">
        <button
          type="button"
          className={tool === 'mask' ? 'active' : undefined}
          title="Mask (M) — clip, brush, scrapes"
          aria-label="Mask tool"
          aria-pressed={tool === 'mask'}
          aria-expanded={flyout === 'mask'}
          onClick={() => {
            onToolChange('mask')
            setFlyout((current) => (current === 'mask' ? null : 'mask'))
          }}
        >
          <BoxSelect size={16} />
        </button>
        {flyout === 'mask' ? (
          <div className="tool-flyout" role="menu" aria-label="Mask tools">
            <button type="button" role="menuitem" title="Clip the selection to a shape" onClick={() => { onClipToShape(); setFlyout(null) }}>
              <Crop size={14} /> Clip to shape
            </button>
            <button type="button" role="menuitem" title="Paint an ellipse clip mask" onClick={() => { onBrushMask(); setFlyout(null) }}>
              <Circle size={14} /> Brush mask
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
        title="Instruments (I) — xerox, scatter, decay, accidents"
        aria-label="Instruments"
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
