import {
  Aperture,
  Columns3,
  Copy,
  Crop,
  Droplets,
  Eraser,
  FlipHorizontal,
  Frame,
  Images,
  Layers,
  Printer,
  Repeat,
  Rows3,
  ScanLine,
  Scissors,
  Shuffle,
  Spline,
  Timer,
  Type,
  Wand2,
  Waves,
} from 'lucide-react'
import type { ExpressiveLegibility } from '../lib/editorModel'
import { Slider } from './Slider'
import { ScopeAll, ScopeSel } from './ScopeBadge'

export type InstrumentsPaletteProps = {
  selected: boolean
  selectedIsImage: boolean
  selectedIsText: boolean
  typeLegibility: ExpressiveLegibility
  typeIntensity: number
  xeroxGeneration: number
  accidentIntensity: number
  decayAmount: number
  layerCount: number
  onSliceHorizontal: () => void
  onSliceVertical: () => void
  onScatter: () => void
  onScramble: () => void
  scrambleDisabled?: boolean
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
  onApplyCopyMachine: () => void
  onApplyCopyMachineToPoster: () => void
  onApplyCopyScatterCopyGesture: () => void
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
  onOpenFilterGallery: () => void
  onOpenTextureGallery: () => void
}

export function InstrumentsPalette({
  selected,
  selectedIsImage,
  selectedIsText,
  typeLegibility,
  typeIntensity,
  xeroxGeneration,
  accidentIntensity,
  decayAmount,
  layerCount,
  onSliceHorizontal,
  onSliceVertical,
  onScatter,
  onScramble,
  scrambleDisabled,
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
  onApplyCopyMachine,
  onApplyCopyMachineToPoster,
  onApplyCopyScatterCopyGesture,
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
  onOpenFilterGallery,
  onOpenTextureGallery,
}: InstrumentsPaletteProps) {
  return (
    <aside className="instruments-palette rail glass-panel" aria-label="Instruments">
      <div className="panel-section">
        <h2>Play</h2>
        <div className="preset-row">
          <button
            type="button"
            title="Rearrange every layer into a new structure — Shift+R, then R to re-roll"
            onClick={onScramble}
            disabled={scrambleDisabled}
          >
            <Shuffle size={16} /> Scramble <ScopeAll />
          </button>
          <button
            type="button"
            data-tour="scatter"
            title="Scatter the selected layers — press R to re-roll"
            onClick={onScatter}
            disabled={!selected}
          >
            <Shuffle size={16} /> Scatter <ScopeSel />
          </button>
          <button type="button" title="Browse blur, stylize, color, and Carson print filters with live preview" onClick={onOpenFilterGallery} disabled={!selected}>
            <Wand2 size={16} /> Filters <ScopeSel />
          </button>
          <button type="button" title="Browse print, ink, paper, and grit textures" onClick={onOpenTextureGallery}>
            <Images size={16} /> Textures <ScopeAll />
          </button>
          <button type="button" title="Slice into horizontal strips" onClick={onSliceHorizontal} disabled={!selected}>
            <Rows3 size={16} /> Strips <ScopeSel />
          </button>
          <button type="button" title="Slice into vertical columns" onClick={onSliceVertical} disabled={!selected}>
            <Columns3 size={16} /> Columns <ScopeSel />
          </button>
        </div>
      </div>

      <div className="panel-section">
        <h2>Poster energy</h2>
        <div className="preset-row">
          <button type="button" title="Shift every layer into colliding blend chaos" onClick={() => onApplyPosterStyle('magazine')}>
            Magazine chaos <ScopeAll />
          </button>
          <button type="button" title="Rotate the layout toward oversized type" onClick={() => onApplyPosterStyle('type')}>
            Oversized type <ScopeAll />
          </button>
          <button type="button" title="Fracture the layout around imagery" onClick={() => onApplyPosterStyle('image')}>
            Image fracture <ScopeAll />
          </button>
          <button type="button" title="Reset to black/white/red minimalism" onClick={() => onApplyPosterStyle('minimal')}>
            B/W red <ScopeAll />
          </button>
        </div>
      </div>

      <div className="panel-section">
        <h2>Type</h2>
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
          <button type="button" title="Repeat the selected text as printed strips" onClick={onAddTypeStrip} disabled={!selectedIsText}>
            <Type size={16} /> Type strip <ScopeSel />
          </button>
          <button type="button" title="Break the selected text into loose letters" onClick={onBreakSelectedType} disabled={!selectedIsText}>
            <Spline size={16} /> Break letters <ScopeSel />
          </button>
          <button type="button" title="Bury a ghost copy of the selected text" onClick={onCloneTypeAsTexture} disabled={!selectedIsText}>
            <Layers size={16} /> Bury type <ScopeSel />
          </button>
          <button type="button" title="Stamp three large red echo words across the poster" onClick={onAddRedEchoType}>
            <Type size={16} /> Red echo type <ScopeAll />
          </button>
        </div>
      </div>

      <div className="panel-section">
        <h2>Print</h2>
        <Slider label="Generation" value={xeroxGeneration} min={1} max={10} onChange={onXeroxGenerationChange} onCommit={onXeroxGenerationCommit} />
        <div className="preset-row">
          <button type="button" title="Photocopy warp — source stays editable" onClick={onApplyCopyMachine} disabled={!selected}>
            <Printer size={16} /> Copy machine <ScopeSel />
          </button>
          <button type="button" title="Run every visible layer through the copier" onClick={onApplyCopyMachineToPoster} disabled={layerCount === 0}>
            <Copy size={16} /> Run through copier <ScopeAll />
          </button>
          <button type="button" title="Copy Machine, then Scatter, then Copy Machine" onClick={onApplyCopyScatterCopyGesture} disabled={!selected}>
            <Repeat size={16} /> Copy → Scatter → Copy <ScopeSel />
          </button>
          <button
            type="button"
            data-tour="xerox"
            title="Re-photocopy the selected layer"
            onClick={onApplyXerox}
            disabled={!selected}
          >
            <ScanLine size={16} /> Copy selected <ScopeSel />
          </button>
          <button type="button" title="Add a faint misregistered print echo" onClick={onAddMisprintDuplicate} disabled={!selected}>
            <Layers size={16} /> Misprint offset <ScopeSel />
          </button>
          <button type="button" title="Add photocopier bands across the poster" onClick={onAddPrintScanSurface}>
            <Waves size={16} /> Surface wear <ScopeAll />
          </button>
          <button type="button" title="Sprinkle photocopier specks across the poster" onClick={onAddPhotocopyNoise}>
            <Aperture size={16} /> Photocopy noise <ScopeAll />
          </button>
          <button type="button" title="Stamp decorative crop marks onto the artwork" onClick={onAddCropMarks}>
            <Frame size={16} /> Crop marks/grid <ScopeAll />
          </button>
        </div>
      </div>

      <div className="panel-section">
        <h2>Decay</h2>
        <Slider label="Amount" value={decayAmount} min={0} max={100} onChange={onDecayAmountChange} onCommit={onDecayAmountCommit} />
        <div className="preset-row">
          <button type="button" title="Age the selected layer" onClick={onApplyLayerDecay} disabled={!selected}>
            <Timer size={16} /> Age selected <ScopeSel />
          </button>
          <button type="button" title="Convert the selected layer into harsh grit" onClick={onDistressSelected} disabled={!selected}>
            <Aperture size={16} /> Distress <ScopeSel />
          </button>
          <button type="button" title="Chip ink away from the selected layer" onClick={() => onAddLayerDecayMarks('ink-loss')} disabled={!selected}>
            <Droplets size={16} /> Ink loss <ScopeSel />
          </button>
          <button type="button" title="Add fold creases" onClick={() => onAddLayerDecayMarks('fold')} disabled={!selected}>
            <Rows3 size={16} /> Fold marks <ScopeSel />
          </button>
          <button type="button" title="Add the full wear treatment" onClick={() => onAddLayerDecayMarks('all')} disabled={!selected}>
            <Layers size={16} /> Wear overlay <ScopeSel />
          </button>
          <button type="button" title="Add a faint decayed echo" onClick={onAddLayerDecayOffset} disabled={!selected}>
            <Copy size={16} /> Decay offset <ScopeSel />
          </button>
        </div>
      </div>

      <div className="panel-section">
        <h2>Accident</h2>
        <Slider label="Intensity" value={accidentIntensity} min={0} max={100} onChange={onAccidentIntensityChange} onCommit={onAccidentIntensityCommit} />
        <div className="preset-row">
          <button type="button" title="Clone the selection with accidental drift" onClick={onDuplicateDriftAccident} disabled={!selected}>
            <Copy size={16} /> Duplicate drift <ScopeSel />
          </button>
          <button type="button" title="Crop badly on purpose" onClick={onBadCropAccident} disabled={!selected}>
            <Crop size={16} /> Bad crop <ScopeSel />
          </button>
          <button type="button" title="Add a flipped ghost" onClick={onFlipMistakeAccident} disabled={!selected}>
            <FlipHorizontal size={16} /> Flip mistake <ScopeSel />
          </button>
          <button type="button" title="Pile selected layers into a collision" onClick={onCollideSelectionAccident} disabled={!selected}>
            <Layers size={16} /> Collide selection <ScopeSel />
          </button>
          <button type="button" title="Nudge every layer with accidental drift" onClick={onNudgeLayoutAccident}>
            <Shuffle size={16} /> Nudge layout <ScopeAll />
          </button>
          <button type="button" title="Tear into shifted scraps" onClick={onTearCollage} disabled={!selected}>
            <Scissors size={16} /> Tear collage <ScopeSel />
          </button>
        </div>
      </div>

      <div className="panel-section">
        <h2>Texture</h2>
        <div className="preset-row">
          <button type="button" title="Apply a cold print wash" onClick={onApplyColdWashImage} disabled={!selectedIsImage}>
            <Droplets size={16} /> Cold wash <ScopeSel />
          </button>
          <button type="button" title="Lay diagonal print texture lines" onClick={onAddDiagonalTexture}>
            <ScanLine size={16} /> Diagonal texture <ScopeAll />
          </button>
          <button type="button" title="Scrape white bands across the poster" onClick={onAddWhiteScrapes}>
            <Eraser size={16} /> White scrapes <ScopeAll />
          </button>
        </div>
      </div>

      <div className="panel-section">
        <h2>Crop</h2>
        <div className="preset-row">
          <button type="button" title="Crop tight into the center" onClick={() => onAggressiveCrop('close')} disabled={!selected}>
            <Crop size={16} /> Close crop <ScopeSel />
          </button>
          <button type="button" title="Crop off-center — press R to re-roll" onClick={() => onAggressiveCrop('off-center')} disabled={!selected}>
            <Crop size={16} /> Off-center crop <ScopeSel />
          </button>
          <button type="button" title="Crop hard to one edge" onClick={() => onAggressiveCrop('edge')} disabled={!selected}>
            <Crop size={16} /> Edge crop <ScopeSel />
          </button>
          <button type="button" title="Throw the fragment to the poster border" onClick={onCropToPosterEdge} disabled={!selected}>
            <Scissors size={16} /> Throw to edge <ScopeSel />
          </button>
        </div>
      </div>
    </aside>
  )
}
