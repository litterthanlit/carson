import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Shuffle,
  type LucideIcon,
} from 'lucide-react'
import {
  FRAME_CORNERS,
  FRAME_EXTEND_SIDES,
  FRAME_HANDLE_POSITIONS,
  frameRanges,
  frameScaleDefaults,
  type FrameDash,
  type FrameExtendSide,
  type FrameHandleFill,
  type FrameHandlePosition,
  type FrameSpec,
} from '../lib/frameHandles'
import { Slider } from './Slider'

type FrameControlsProps = {
  spec: FrameSpec
  color: string
  posterWidth: number
  posterHeight: number
  /** `bar` is the compact floating tool bar; `panel` is the inspector section. */
  layout: 'bar' | 'panel'
  onChange: (patch: Partial<FrameSpec>, label: string) => void
  onColorChange: (color: string) => void
  /** End of a continuous edit (slider release, color picker close). */
  onCommit: (label: string) => void
  onShuffle: () => void
}

const HANDLE_LABELS: Record<FrameHandlePosition, string> = {
  tl: 'top-left corner',
  t: 'top edge',
  tr: 'top-right corner',
  r: 'right edge',
  br: 'bottom-right corner',
  b: 'bottom edge',
  bl: 'bottom-left corner',
  l: 'left edge',
}

const EXTEND: Record<FrameExtendSide, { label: string; Icon: LucideIcon }> = {
  top: { label: 'Run lines up to the top edge', Icon: ArrowUpToLine },
  right: { label: 'Run lines across to the right edge', Icon: ArrowRightToLine },
  bottom: { label: 'Run lines down to the bottom edge', Icon: ArrowDownToLine },
  left: { label: 'Run lines across to the left edge', Icon: ArrowLeftToLine },
}

const FILLS: { value: FrameHandleFill; label: string; title: string }[] = [
  { value: 'knockout', label: 'Knockout', title: 'Handles filled flat, like selection chrome' },
  { value: 'open', label: 'Open', title: 'See-through handles: the art shows inside' },
  { value: 'solid', label: 'Solid', title: 'Handles filled with the line color' },
]

const DASHES: { value: FrameDash; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
]

const formatPx = (value: number) => `${Math.round(value * 10) / 10}px`

type HandlePreset = 'corners' | 'all' | 'none'

const HANDLE_PRESETS: { value: HandlePreset; label: string; handles: FrameHandlePosition[] }[] = [
  { value: 'corners', label: 'Handles on the corners', handles: FRAME_CORNERS },
  { value: 'all', label: 'Handles on corners and edges', handles: FRAME_HANDLE_POSITIONS },
  { value: 'none', label: 'No handles', handles: [] },
]

const sameHandles = (a: FrameHandlePosition[], b: FrameHandlePosition[]) =>
  a.length === b.length && a.every((item) => b.includes(item))

/** A tiny frame with its handles, for the preset buttons. */
function HandlesGlyph({ preset }: { preset: HandlePreset }) {
  const spots = preset === 'none' ? [] : preset === 'corners' ? [[3, 3], [13, 3], [13, 13], [3, 13]] : [[3, 3], [8, 3], [13, 3], [13, 8], [13, 13], [8, 13], [3, 13], [3, 8]]
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1" />
      {spots.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x - 1.75} y={y - 1.75} width="3.5" height="3.5" fill="currentColor" />
      ))}
    </svg>
  )
}

/** Quick handle layouts for the tool bar; the inspector's map sets them one by one. */
function HandlePresets({ handles, onChange }: { handles: FrameHandlePosition[]; onChange: (handles: FrameHandlePosition[]) => void }) {
  return (
    <div className="frame-segmented" role="radiogroup" aria-label="Handles">
      {HANDLE_PRESETS.map((preset) => (
        <button
          key={preset.value}
          type="button"
          role="radio"
          className="icon-button"
          aria-checked={sameHandles(handles, preset.handles)}
          aria-label={preset.label}
          title={preset.label}
          onClick={() => onChange([...preset.handles])}
        >
          <HandlesGlyph preset={preset.value} />
        </button>
      ))}
    </div>
  )
}

/**
 * The frame's handle spots drawn as a little frame: click a spot to put a
 * handle there; the middle toggles every corner at once.
 */
function HandleMap({ handles, onChange }: { handles: FrameHandlePosition[]; onChange: (handles: FrameHandlePosition[]) => void }) {
  const allCorners = FRAME_CORNERS.every((corner) => handles.includes(corner))
  const toggle = (position: FrameHandlePosition) =>
    onChange(FRAME_HANDLE_POSITIONS.filter((item) => (item === position ? !handles.includes(item) : handles.includes(item))))
  return (
    <div className="frame-handle-map" role="group" aria-label="Handles">
      <span className="frame-handle-map-frame" aria-hidden="true" />
      {FRAME_HANDLE_POSITIONS.map((position) => (
        <button
          key={position}
          type="button"
          className={`frame-handle-spot is-${position}`}
          aria-pressed={handles.includes(position)}
          aria-label={`Handle on the ${HANDLE_LABELS[position]}`}
          title={`Handle on the ${HANDLE_LABELS[position]}`}
          onClick={() => toggle(position)}
        />
      ))}
      <button
        type="button"
        className="frame-handle-spot is-center"
        aria-label={allCorners ? 'Clear every handle' : 'Handles on all four corners'}
        title={allCorners ? 'Clear every handle' : 'Handles on all four corners'}
        onClick={() => onChange(allCorners ? [] : FRAME_HANDLE_POSITIONS.filter((item) => FRAME_CORNERS.includes(item) || handles.includes(item)))}
      />
    </div>
  )
}

export function FrameControls({ spec, color, posterWidth, posterHeight, layout, onChange, onColorChange, onCommit, onShuffle }: FrameControlsProps) {
  const ranges = frameRanges(posterWidth, posterHeight)
  const defaults = frameScaleDefaults(posterWidth, posterHeight)
  const bar = layout === 'bar'
  const toggleSide = (side: FrameExtendSide) =>
    onChange(
      { extend: FRAME_EXTEND_SIDES.filter((item) => (item === side ? !spec.extend.includes(item) : spec.extend.includes(item))) },
      spec.extend.includes(side) ? 'Pulled construction lines back' : 'Ran construction lines to the edge',
    )

  const colorInput = (
    <label className="frame-color" title="Line color">
      <input
        type="color"
        aria-label="Frame line color"
        value={color}
        onChange={(event) => onColorChange(event.target.value)}
        onBlur={() => onCommit('Changed frame color')}
      />
      {bar ? null : <span>Line</span>}
    </label>
  )

  const sliders = (
    <>
      <div className={bar ? 'brush-field' : undefined}>
        <Slider
          size={bar ? 'sm' : 'md'}
          label="Weight"
          value={spec.weight}
          min={ranges.weight.min}
          max={ranges.weight.max}
          step={0.5}
          defaultValue={defaults.weight}
          format={formatPx}
          releaseFocusOnPointerUp={bar}
          onChange={(weight) => onChange({ weight }, 'Changed frame weight')}
          onCommit={() => onCommit('Changed frame weight')}
        />
      </div>
      <div className={bar ? 'brush-field' : undefined}>
        <Slider
          size={bar ? 'sm' : 'md'}
          label="Handle"
          value={spec.handleSize}
          min={ranges.handleSize.min}
          max={ranges.handleSize.max}
          defaultValue={defaults.handleSize}
          format={formatPx}
          releaseFocusOnPointerUp={bar}
          onChange={(handleSize) => onChange({ handleSize }, 'Changed handle size')}
          onCommit={() => onCommit('Changed handle size')}
        />
      </div>
    </>
  )

  const fills = (
    <div className="frame-segmented" role="radiogroup" aria-label="Handle fill">
      {FILLS.map((fill) => (
        <button
          key={fill.value}
          type="button"
          role="radio"
          className={bar ? 'icon-button' : undefined}
          aria-checked={spec.handleFill === fill.value}
          aria-label={bar ? `${fill.label} handles` : undefined}
          title={fill.title}
          onClick={() => onChange({ handleFill: fill.value }, `${fill.label} handles`)}
        >
          <span className={`frame-fill-glyph is-${fill.value}`} aria-hidden="true" />
          {bar ? null : fill.label}
        </button>
      ))}
    </div>
  )

  const knockout =
    spec.handleFill === 'knockout' ? (
      <label className="frame-color" title="Handle fill color">
        <input
          type="color"
          aria-label="Handle fill color"
          value={spec.knockout}
          onChange={(event) => onChange({ knockout: event.target.value }, 'Changed handle fill')}
          onBlur={() => onCommit('Changed handle fill')}
        />
        {bar ? null : <span>Fill</span>}
      </label>
    ) : null

  const extend = (
    <div className="frame-extend" role="group" aria-label="Construction lines to the poster edge">
      {FRAME_EXTEND_SIDES.map((side) => {
        const { label, Icon } = EXTEND[side]
        return (
          <button key={side} type="button" className="icon-button" aria-pressed={spec.extend.includes(side)} aria-label={label} title={label} onClick={() => toggleSide(side)}>
            <Icon size={14} aria-hidden />
          </button>
        )
      })}
    </div>
  )

  const shuffle = (
    <button type="button" className={bar ? 'icon-button' : undefined} title="Shuffle handles and construction lines" aria-label={bar ? 'Shuffle handles and construction lines' : undefined} onClick={onShuffle}>
      <Shuffle size={14} aria-hidden />
      {bar ? null : 'Shuffle'}
    </button>
  )

  if (bar) {
    return (
      <>
        {colorInput}
        {sliders}
        <HandlePresets handles={spec.handles} onChange={(handles) => onChange({ handles }, 'Changed handles')} />
        {fills}
        {knockout}
        {extend}
        {shuffle}
      </>
    )
  }

  return (
    <div className="frame-controls">
      <div className="frame-controls-row">
        {colorInput}
        {knockout}
      </div>
      {sliders}
      <div className="frame-controls-handles">
        <HandleMap handles={spec.handles} onChange={(handles) => onChange({ handles }, 'Changed handles')} />
        <div className="frame-controls-stack">
          <p className="property-kicker">Handles</p>
          {fills}
        </div>
      </div>
      <div className="frame-controls-stack">
        <p className="property-kicker">Lines</p>
        <div className="frame-controls-row">
          <label className="toggle-row">
            <input type="checkbox" role="switch" checked={spec.outline} onChange={(event) => onChange({ outline: event.target.checked }, event.target.checked ? 'Drew frame outline' : 'Hid frame outline')} />
            Outline
          </label>
          <div className="frame-segmented" role="radiogroup" aria-label="Line style">
            {DASHES.map((dash) => (
              <button key={dash.value} type="button" role="radio" aria-checked={spec.dash === dash.value} onClick={() => onChange({ dash: dash.value }, `${dash.label} frame lines`)}>
                {dash.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="frame-controls-stack">
        <p className="property-kicker">Run to the edge</p>
        <div className="frame-controls-row">
          {extend}
          {shuffle}
        </div>
      </div>
    </div>
  )
}

const noCommit = () => undefined

/** Floating options for the Frame tool: the style of the next frame drawn. */
export function FrameBar(props: Omit<FrameControlsProps, 'layout' | 'onCommit'>) {
  return (
    <div className="brush-bar frame-bar" role="toolbar" aria-label="Frame options">
      <FrameControls {...props} layout="bar" onCommit={noCommit} />
      <span className="brush-target">Drag to draw · click a layer to frame it</span>
    </div>
  )
}
