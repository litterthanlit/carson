import type { RefObject } from 'react'
import {
  Circle,
  Crop,
  FlipHorizontal,
  ImagePlus,
  Layers,
  Minus,
  PenLine,
  ScanLine,
  Scissors,
  Shuffle,
  Sparkles,
  Square,
  Star,
  Trash2,
  Type,
} from 'lucide-react'
import type { ExpressiveLegibility, PosterPresetId } from '../lib/editorModel'
import { Slider } from './Slider'
import { ScopeAll, ScopeSel } from './ScopeBadge'

export type LeftRailProps = {
  fileInputRef: RefObject<HTMLInputElement | null>
  penMode: boolean
  showInstruments: boolean
  selected: boolean
  selectedIsImage: boolean
  selectedIsText: boolean
  presetId: PosterPresetId
  customSize: { width: number; height: number }
  typeLegibility: ExpressiveLegibility
  typeIntensity: number
  xeroxGeneration: number
  accidentIntensity: number
  decayAmount: number
  layerCount: number
  onAddText: () => void
  onImageInputChange: (file: File) => void
  onAddShape: () => void
  onAddEllipse: () => void
  onAddLine: () => void
  onAddStar: () => void
  onTogglePenMode: () => void
  onDuplicateSelected: () => void
  onSliceHorizontal: () => void
  onSliceVertical: () => void
  onScatter: () => void
  onDeleteSelected: () => void
  onToggleInstruments: () => void
  onPresetChange: (presetId: PosterPresetId) => void
  onCustomSizeChange: (size: { width: number; height: number }) => void
  onApplyPosterStyle: (style: 'magazine' | 'type' | 'image' | 'minimal') => void
  onTypeLegibilityChange: (value: ExpressiveLegibility) => void
  onTypeIntensityChange: (value: number) => void
  onTypeIntensityCommit: () => void
  onXeroxGenerationChange: (value: number) => void
  onXeroxGenerationCommit: () => void
  onAccidentIntensityChange: (value: number) => void
  onAccidentIntensityCommit: () => void
  onDecayAmountChange: (value: number) => void
  onDecayAmountCommit: () => void
  onAddTypeStrip: () => void
  onDistressSelected: () => void
  onAddPhotocopyNoise: () => void
  onTearCollage: () => void
  onAddCropMarks: () => void
  onBreakSelectedType: () => void
  onCloneTypeAsTexture: () => void
  onApplyXerox: () => void
  onAddMisprintDuplicate: () => void
  onAddPrintScanSurface: () => void
  onApplyLayerDecay: () => void
  onAddLayerDecayMarks: (kind: 'ink-loss' | 'fold' | 'all') => void
  onAddLayerDecayOffset: () => void
  onDuplicateDriftAccident: () => void
  onBadCropAccident: () => void
  onFlipMistakeAccident: () => void
  onCollideSelectionAccident: () => void
  onNudgeLayoutAccident: () => void
  onApplyColdWashImage: () => void
  onAddDiagonalTexture: () => void
  onAddWhiteScrapes: () => void
  onAddRedEchoType: () => void
  onAggressiveCrop: (mode: 'close' | 'edge' | 'off-center') => void
  onCropToPosterEdge: () => void
  onOpenLayersPanel: () => void
}

export function LeftRail({
  fileInputRef,
  penMode,
  showInstruments,
  selected,
  selectedIsImage,
  selectedIsText,
  presetId,
  customSize,
  typeLegibility,
  typeIntensity,
  xeroxGeneration,
  accidentIntensity,
  decayAmount,
  layerCount,
  onAddText,
  onImageInputChange,
  onAddShape,
  onAddEllipse,
  onAddLine,
  onAddStar,
  onTogglePenMode,
  onDuplicateSelected,
  onSliceHorizontal,
  onSliceVertical,
  onScatter,
  onDeleteSelected,
  onToggleInstruments,
  onPresetChange,
  onCustomSizeChange,
  onApplyPosterStyle,
  onTypeLegibilityChange,
  onTypeIntensityChange,
  onTypeIntensityCommit,
  onXeroxGenerationChange,
  onXeroxGenerationCommit,
  onAccidentIntensityChange,
  onAccidentIntensityCommit,
  onDecayAmountChange,
  onDecayAmountCommit,
  onAddTypeStrip,
  onDistressSelected,
  onAddPhotocopyNoise,
  onTearCollage,
  onAddCropMarks,
  onBreakSelectedType,
  onCloneTypeAsTexture,
  onApplyXerox,
  onAddMisprintDuplicate,
  onAddPrintScanSurface,
  onApplyLayerDecay,
  onAddLayerDecayMarks,
  onAddLayerDecayOffset,
  onDuplicateDriftAccident,
  onBadCropAccident,
  onFlipMistakeAccident,
  onCollideSelectionAccident,
  onNudgeLayoutAccident,
  onApplyColdWashImage,
  onAddDiagonalTexture,
  onAddWhiteScrapes,
  onAddRedEchoType,
  onAggressiveCrop,
  onCropToPosterEdge,
  onOpenLayersPanel,
}: LeftRailProps) {
  return (
    <aside className="rail left-rail glass-panel" aria-label="Tools and layers">
      <div className="panel-section">
        <h2>Tools</h2>
        <div className="tool-grid">
          <button type="button" title="Add a text layer (T)" onClick={onAddText}>
            <Type size={17} />
            Text
          </button>
          <button type="button" title="Import an image from your computer" onClick={() => fileInputRef.current?.click()}>
            <ImagePlus size={17} />
            Image
          </button>
          <button type="button" title="Add a solid block (B)" onClick={onAddShape}>
            <Square size={17} />
            Block
          </button>
          <button type="button" title="Add an ellipse" onClick={onAddEllipse}>
            <Circle size={17} />
            Ellipse
          </button>
          <button type="button" title="Add a line" onClick={onAddLine}>
            <Minus size={17} />
            Line
          </button>
          <button type="button" title="Add a star" onClick={onAddStar}>
            <Star size={17} />
            Star
          </button>
          <button
            type="button"
            title="Draw freehand strokes (P)"
            className={penMode ? 'active' : undefined}
            onClick={onTogglePenMode}
          >
            <PenLine size={17} />
            Pen
          </button>
          <button type="button" title="Duplicate the selected layer (Cmd+D)" onClick={onDuplicateSelected} disabled={!selected}>
            <FlipHorizontal size={17} />
            Copy
          </button>
          <button type="button" title="Slice the selected layer into horizontal strips" onClick={onSliceHorizontal} disabled={!selected}>
            <Scissors size={17} />
            Strips
          </button>
          <button type="button" title="Slice the selected layer into vertical columns" onClick={onSliceVertical} disabled={!selected}>
            <Scissors size={17} />
            Columns
          </button>
          <button
            type="button"
            title="Scatter the selected layers with seeded randomness — press R to re-roll"
            onClick={onScatter}
            disabled={!selected}
          >
            <Shuffle size={17} />
            Scatter
          </button>
          <button type="button" title="Delete the selected layer (Delete)" onClick={onDeleteSelected} disabled={!selected}>
            <Trash2 size={17} />
            Delete
          </button>
          <button
            type="button"
            title={showInstruments ? 'Hide chaos instruments' : 'Show Xerox, decay, accidents, texture, and crop tools'}
            className={showInstruments ? 'active' : undefined}
            onClick={onToggleInstruments}
          >
            <Sparkles size={17} />
            Instruments
          </button>
        </div>
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
      </div>

      {showInstruments ? (
        <>
          <div className="panel-section">
            <h2>Poster</h2>
            <label>
              Size
              <select value={presetId} onChange={(event) => onPresetChange(event.target.value as PosterPresetId)}>
                <option value="a3">A3 portrait</option>
                <option value="a2">A2 portrait</option>
                <option value="instagram">Instagram portrait</option>
                <option value="square">Square</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            {presetId === 'custom' ? (
              <div className="split-inputs">
                <label>
                  W
                  <input
                    type="number"
                    min={320}
                    max={10000}
                    value={customSize.width}
                    onChange={(event) => onCustomSizeChange({ ...customSize, width: Number(event.target.value) })}
                  />
                </label>
                <label>
                  H
                  <input
                    type="number"
                    min={320}
                    max={10000}
                    value={customSize.height}
                    onChange={(event) => onCustomSizeChange({ ...customSize, height: Number(event.target.value) })}
                  />
                </label>
              </div>
            ) : null}
            <div className="preset-row">
              <button type="button" title="Shift every layer into colliding blend chaos — affects the whole poster" onClick={() => onApplyPosterStyle('magazine')}>
                Magazine chaos <ScopeAll />
              </button>
              <button type="button" title="Rotate the whole layout toward oversized type — affects the whole poster" onClick={() => onApplyPosterStyle('type')}>
                Oversized type <ScopeAll />
              </button>
              <button type="button" title="Fracture the layout around imagery — affects the whole poster" onClick={() => onApplyPosterStyle('image')}>
                Image fracture <ScopeAll />
              </button>
              <button type="button" title="Reset to black/white/red minimalism — affects the whole poster" onClick={() => onApplyPosterStyle('minimal')}>
                B/W red <ScopeAll />
              </button>
            </div>
          </div>

          <div className="panel-section">
            <h2>Manual Effects</h2>
            <div className="preset-row">
              <button type="button" title="Repeat the selected text as printed strips below it" onClick={onAddTypeStrip} disabled={!selectedIsText}>
                <Type size={17} />
                Type strip <ScopeSel />
              </button>
              <button type="button" title="Convert the selected layer into harsh black & white grit (rasterizes it)" onClick={onDistressSelected} disabled={!selected}>
                <Sparkles size={17} />
                Distress <ScopeSel />
              </button>
              <button type="button" title="Sprinkle photocopier specks, scratches, and scanlines across the poster" onClick={onAddPhotocopyNoise}>
                <ScanLine size={17} />
                Photocopy noise <ScopeAll />
              </button>
              <button type="button" title="Tear the selected layer into shifted scraps — remove Tear in Treatments to restore" onClick={onTearCollage} disabled={!selected}>
                <Scissors size={17} />
                Tear collage <ScopeSel />
              </button>
              <button type="button" title="Stamp decorative crop marks and a faint grid onto the artwork" onClick={onAddCropMarks}>
                <Crop size={17} />
                Crop marks/grid <ScopeAll />
              </button>
            </div>
          </div>

          <div className="panel-section">
            <h2>Expressive Type Lab</h2>
            <label>
              Legibility
              <select value={typeLegibility} onChange={(event) => onTypeLegibilityChange(event.target.value as ExpressiveLegibility)}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <Slider label="Intensity" value={typeIntensity} min={0} max={100} onChange={onTypeIntensityChange} onCommit={onTypeIntensityCommit} />
            <div className="preset-row">
              <button type="button" title="Break the selected text into loose, expressive letters" onClick={onBreakSelectedType} disabled={!selectedIsText}>
                <Type size={17} />
                Break letters <ScopeSel />
              </button>
              <button type="button" title="Bury a ghost copy of the selected text behind the layout" onClick={onCloneTypeAsTexture} disabled={!selectedIsText}>
                <Layers size={17} />
                Bury type <ScopeSel />
              </button>
            </div>
          </div>

          <div className="panel-section">
            <h2>Xerox / Print-Scan</h2>
            <Slider label="Generation" value={xeroxGeneration} min={1} max={10} onChange={onXeroxGenerationChange} onCommit={onXeroxGenerationCommit} />
            <div className="preset-row">
              <button type="button" title="Re-photocopy the selected layer at the chosen generation (rasterizes it)" onClick={onApplyXerox} disabled={!selected}>
                <ScanLine size={17} />
                Copy selected <ScopeSel />
              </button>
              <button type="button" title="Add a faint misregistered print echo behind the selected layer" onClick={onAddMisprintDuplicate} disabled={!selected}>
                <Layers size={17} />
                Misprint offset <ScopeSel />
              </button>
              <button type="button" title="Add photocopier bands and scanner drift across the poster" onClick={onAddPrintScanSurface}>
                <Sparkles size={17} />
                Surface wear <ScopeAll />
              </button>
            </div>
          </div>

          <div className="panel-section">
            <h2>Layer Decay</h2>
            <Slider label="Amount" value={decayAmount} min={0} max={100} onChange={onDecayAmountChange} onCommit={onDecayAmountCommit} />
            <div className="preset-row">
              <button type="button" title="Age the selected layer with contrast, noise, and drift (rasterizes it)" onClick={onApplyLayerDecay} disabled={!selected}>
                <Sparkles size={17} />
                Age selected <ScopeSel />
              </button>
              <button type="button" title="Chip ink away from the selected layer" onClick={() => onAddLayerDecayMarks('ink-loss')} disabled={!selected}>
                <Scissors size={17} />
                Ink loss <ScopeSel />
              </button>
              <button type="button" title="Add fold creases across the selected layer" onClick={() => onAddLayerDecayMarks('fold')} disabled={!selected}>
                <ScanLine size={17} />
                Fold marks <ScopeSel />
              </button>
              <button type="button" title="Add the full wear treatment to the selected layer" onClick={() => onAddLayerDecayMarks('all')} disabled={!selected}>
                <Layers size={17} />
                Wear overlay <ScopeSel />
              </button>
              <button type="button" title="Add a faint decayed echo behind the selected layer" onClick={onAddLayerDecayOffset} disabled={!selected}>
                <Shuffle size={17} />
                Decay offset <ScopeSel />
              </button>
            </div>
          </div>

          <div className="panel-section">
            <h2>Accident Engine</h2>
            <Slider label="Intensity" value={accidentIntensity} min={0} max={100} onChange={onAccidentIntensityChange} onCommit={onAccidentIntensityCommit} />
            <div className="preset-row">
              <button type="button" title="Clone the selection with accidental drift — press R to re-roll" onClick={onDuplicateDriftAccident} disabled={!selected}>
                <Shuffle size={17} />
                Duplicate drift <ScopeSel />
              </button>
              <button type="button" title="Crop the selection badly on purpose — remove Bad crop in Treatments to restore" onClick={onBadCropAccident} disabled={!selected}>
                <Crop size={17} />
                Bad crop <ScopeSel />
              </button>
              <button type="button" title="Add a flipped ghost of the selection" onClick={onFlipMistakeAccident} disabled={!selected}>
                <FlipHorizontal size={17} />
                Flip mistake <ScopeSel />
              </button>
              <button type="button" title="Pile the selected layers into a collision (needs 2+ selected)" onClick={onCollideSelectionAccident} disabled={!selected}>
                <Layers size={17} />
                Collide selection <ScopeSel />
              </button>
              <button type="button" title="Nudge every layer with accidental drift — press R to re-roll" onClick={onNudgeLayoutAccident}>
                <Sparkles size={17} />
                Nudge layout <ScopeAll />
              </button>
            </div>
          </div>

          <div className="panel-section">
            <h2>Texture Tools</h2>
            <div className="preset-row">
              <button type="button" title="Apply a cold, tinted print wash to the selected image" onClick={onApplyColdWashImage} disabled={!selectedIsImage}>
                <ImagePlus size={17} />
                Cold wash <ScopeSel />
              </button>
              <button type="button" title="Lay diagonal print texture lines across the poster" onClick={onAddDiagonalTexture}>
                <ScanLine size={17} />
                Diagonal texture <ScopeAll />
              </button>
              <button type="button" title="Scrape white bands with grit across the poster" onClick={onAddWhiteScrapes}>
                <Scissors size={17} />
                White scrapes <ScopeAll />
              </button>
              <button type="button" title="Stamp three large red echo words across the poster" onClick={onAddRedEchoType}>
                <Type size={17} />
                Red echo type <ScopeAll />
              </button>
            </div>
          </div>

          <div className="panel-section">
            <h2>Aggressive Crop Tools</h2>
            <div className="preset-row">
              <button type="button" title="Crop tight into the center — source stays editable; remove Crop in Treatments to restore" onClick={() => onAggressiveCrop('close')} disabled={!selected}>
                <Crop size={17} />
                Close crop <ScopeSel />
              </button>
              <button type="button" title="Crop off-center — press R to re-roll; remove Crop in Treatments to restore source" onClick={() => onAggressiveCrop('off-center')} disabled={!selected}>
                <Crop size={17} />
                Off-center crop <ScopeSel />
              </button>
              <button type="button" title="Crop hard to one edge — remove Crop in Treatments to restore source" onClick={() => onAggressiveCrop('edge')} disabled={!selected}>
                <Crop size={17} />
                Edge crop <ScopeSel />
              </button>
              <button type="button" title="Crop to edge and throw the fragment to the poster border" onClick={onCropToPosterEdge} disabled={!selected}>
                <Scissors size={17} />
                Throw to edge <ScopeSel />
              </button>
              <button type="button" title="Slice the selection into vertical strips" onClick={onSliceVertical} disabled={!selected}>
                <Scissors size={17} />
                Crop strips <ScopeSel />
              </button>
            </div>
          </div>
        </>
      ) : null}

      <div className="panel-section layer-section compact">
        <div className="panel-title">
          <h2>Layers</h2>
          <button type="button" className="toolbar-button" onClick={onOpenLayersPanel}>
            Open panel
          </button>
        </div>
        <p className="hint">
          {layerCount} layer{layerCount === 1 ? '' : 's'} — reorder, hide, and lock in the Layers tab.
        </p>
      </div>
    </aside>
  )
}
