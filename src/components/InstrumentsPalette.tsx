import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import {
  Aperture,
  ChevronDown,
  ChevronRight,
  Columns3,
  Contrast,
  Copy,
  Crop,
  Disc,
  Droplet,
  Droplets,
  Eraser,
  Flame,
  FlipHorizontal,
  Frame,
  Images,
  Layers,
  Layers3,
  Move,
  Printer,
  Repeat,
  Rows3,
  Scan,
  ScanLine,
  Scissors,
  ScissorsLineDashed,
  Shuffle,
  Sliders,
  Sparkles,
  Spline,
  SplitSquareHorizontal,
  Stamp,
  Timer,
  Type,
  Waves,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { ExpressiveLegibility } from '../lib/editorModel'
import type { Gesture } from '../lib/gestures'
import type { SavedInstrument } from '../lib/instrumentAssets'
import { Slider } from './Slider'
import { ScopeAll, ScopeSel } from './ScopeBadge'

export type InstrumentsPaletteProps = {
  selected: boolean
  selectedIsImage: boolean
  selectedIsText: boolean
  typeLegibility: ExpressiveLegibility
  recording: boolean
  performanceLabel: string
  canSavePerformance: boolean
  savedInstruments: SavedInstrument[]
  savedGestures: Gesture[]
  onToggleRecording: () => void
  onSavePerformance: () => void
  onClearPerformance: () => void
  onApplySavedInstrument: (asset: SavedInstrument) => void
  onApplySavedGesture: (gesture: Gesture) => void
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
  onBreakCopy?: () => void
  onLetterBreak: () => void
  onCloneTypeAsTexture: () => void
  onApplyXerox: () => void
  onApplyCopyMachine: () => void
  onApplyInkBleed: () => void
  onApplySolventTransfer?: () => void
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
  pressCheckActive: boolean
  onTogglePressCheck: () => void
  onAddRedEchoType: () => void
  onAggressiveCrop: (mode: 'close' | 'edge' | 'off-center') => void
  onCropToPosterEdge: () => void
  onOpenFilterGallery: () => void
  onOpenTextureGallery: () => void
  /** Focus the search field on mount (palette opened by click, not by the I key). */
  autoFocusSearch?: boolean
  /** Which groups are expanded. Held by the parent so the choice survives closing the palette. */
  openGroups: ReadonlySet<string>
  onToggleGroup: (id: string) => void
  /** Groups to show open regardless, e.g. while the walkthrough points at Copy selected. */
  forceOpenGroups?: string[]
  /** Escape in an empty search field closes the palette. */
  onClose?: () => void
}


type EffectScope = 'sel' | 'all'

type EffectSectionId = 'play' | 'energy' | 'type' | 'print' | 'decay' | 'accident' | 'press' | 'texture' | 'crop'

type EffectDef = {
  id: string
  section: EffectSectionId
  label: string
  title: string
  icon: LucideIcon
  scope: EffectScope
  keywords: string[]
  onClick: () => void
  disabled?: boolean
  /** Overrides the accessible name when the label alone is not enough (toggles). */
  ariaLabel?: string
  pressed?: boolean
  dataTour?: string
}

const SCOPE_HELP: Record<EffectScope, string> = {
  sel: 'Applies to the selected layer',
  all: 'Applies to the whole poster',
}

const SECTION_TITLES: Record<EffectSectionId, string> = {
  play: 'Play',
  energy: 'Poster energy',
  type: 'Type',
  print: 'Print',
  decay: 'Decay',
  accident: 'Accident',
  press: 'Press',
  texture: 'Texture',
  crop: 'Crop',
}

const SECTION_ORDER: EffectSectionId[] = ['play', 'energy', 'type', 'print', 'decay', 'accident', 'press', 'texture', 'crop']

/** The six effects a newcomer should reach for first, in display order. */
const STARTER_IDS = ['scatter', 'scramble', 'copy-machine', 'letter-break', 'strips', 'filters'] as const

/**
 * Case-insensitive search over name, section and keywords. Every word typed must
 * match somewhere, so "copy scatter" narrows rather than widens.
 */
function filterEffects<T extends { label: string; section: EffectSectionId; keywords: string[] }>(
  effects: T[],
  query: string,
): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return effects
  return effects.filter((effect) => {
    const haystack = [effect.label, SECTION_TITLES[effect.section], ...effect.keywords].join(' ').toLowerCase()
    return words.every((word) => haystack.includes(word))
  })
}

function ScopeTag({ scope }: { scope: EffectScope }) {
  return scope === 'sel' ? <ScopeSel title={SCOPE_HELP.sel} /> : <ScopeAll title={SCOPE_HELP.all} />
}

function EffectButton({ effect, variant }: { effect: EffectDef; variant?: 'starter' | 'result' }) {
  const Icon = effect.icon
  return (
    <button
      type="button"
      className={variant ? `effect-button ${variant}` : 'effect-button'}
      data-tour={effect.dataTour}
      aria-label={effect.ariaLabel ?? effect.label}
      aria-pressed={effect.pressed}
      title={`${effect.title} — ${SCOPE_HELP[effect.scope]}`}
      disabled={effect.disabled}
      onClick={effect.onClick}
    >
      <Icon size={14} aria-hidden /> <span className="effect-name">{effect.label}</span>
      {variant === 'result' ? <span className="effect-context">{SECTION_TITLES[effect.section]}</span> : null}
      <ScopeTag scope={effect.scope} />
    </button>
  )
}

function Group({
  id,
  title,
  count,
  open,
  onToggle,
  badge,
  children,
}: {
  id: string
  title: string
  count?: number
  open: boolean
  onToggle: () => void
  badge?: ReactNode
  children: ReactNode
}) {
  const bodyId = useId()
  const Chevron = open ? ChevronDown : ChevronRight
  return (
    <section className="effects-group" data-group={id}>
      <h3>
        <button type="button" className="effects-group-toggle" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
          <Chevron size={14} aria-hidden />
          <span className="effects-group-title">{title}</span>
          {badge}
          {count !== undefined ? <span className="effects-group-count">{count}</span> : null}
        </button>
      </h3>
      {open ? (
        <div id={bodyId} className="effects-group-body">
          {children}
        </div>
      ) : null}
    </section>
  )
}

export function InstrumentsPalette({
  selected,
  selectedIsImage,
  selectedIsText,
  recording,
  performanceLabel,
  canSavePerformance,
  savedInstruments,
  savedGestures,
  onToggleRecording,
  onSavePerformance,
  onClearPerformance,
  onApplySavedInstrument,
  onApplySavedGesture,
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
  onBreakCopy,
  onLetterBreak,
  onCloneTypeAsTexture,
  onApplyXerox,
  onApplyCopyMachine,
  onApplyInkBleed,
  onApplySolventTransfer,
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
  pressCheckActive,
  onTogglePressCheck,
  onAddRedEchoType,
  onAggressiveCrop,
  onCropToPosterEdge,
  onOpenFilterGallery,
  onOpenTextureGallery,
  autoFocusSearch = false,
  openGroups,
  onToggleGroup,
  forceOpenGroups,
  onClose,
}: InstrumentsPaletteProps) {
  const searchRef = useRef<HTMLInputElement | null>(null)
  const searchId = useId()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (autoFocusSearch) searchRef.current?.focus()
  }, [autoFocusSearch])

  const isOpen = (id: string) => openGroups.has(id) || Boolean(forceOpenGroups?.includes(id))

  // One definition per effect: the starters, the search results and the groups all render from here.
  const effects: EffectDef[] = [
    { id: 'scramble', section: 'play', label: 'Shuffle layout', title: 'Rearrange every layer into a new structure — Shift+R, then R to re-roll', icon: Shuffle, scope: 'all', keywords: ['scramble', 'rearrange', 'layout', 'structure', 'randomize'], onClick: onScramble, disabled: scrambleDisabled },
    { id: 'scatter', section: 'play', label: 'Scatter', title: 'Scatter the selected layers — press R to re-roll', icon: Sparkles, scope: 'sel', keywords: ['chaos', 'jump', 'random', 'move'], onClick: onScatter, disabled: !selected, dataTour: 'scatter' },
    { id: 'filters', section: 'play', label: 'Filters', title: 'Browse blur, stylize, color, and Carson print filters with live preview', icon: Sliders, scope: 'sel', keywords: ['filter gallery', 'blur', 'stylize', 'color', 'gallery'], onClick: onOpenFilterGallery, disabled: !selected },
    { id: 'textures', section: 'play', label: 'Textures', title: 'Browse print, ink, paper, and grit textures', icon: Images, scope: 'all', keywords: ['texture gallery', 'paper', 'grit', 'gallery'], onClick: onOpenTextureGallery },
    { id: 'strips', section: 'play', label: 'Strips', title: 'Slice into horizontal strips', icon: Rows3, scope: 'sel', keywords: ['slice', 'horizontal', 'cut', 'rows'], onClick: onSliceHorizontal, disabled: !selected },
    { id: 'columns', section: 'play', label: 'Columns', title: 'Slice into vertical columns', icon: Columns3, scope: 'sel', keywords: ['slice', 'vertical', 'cut'], onClick: onSliceVertical, disabled: !selected },

    { id: 'magazine-chaos', section: 'energy', label: 'Magazine chaos', title: 'Shift every layer into colliding blend chaos', icon: Zap, scope: 'all', keywords: ['poster style', 'blend', 'collide'], onClick: () => onApplyPosterStyle('magazine') },
    { id: 'oversized-type', section: 'energy', label: 'Oversized type', title: 'Rotate the layout toward oversized type', icon: Type, scope: 'all', keywords: ['poster style', 'big', 'headline', 'rotate'], onClick: () => onApplyPosterStyle('type') },
    { id: 'image-fracture', section: 'energy', label: 'Image fracture', title: 'Fracture the layout around imagery', icon: SplitSquareHorizontal, scope: 'all', keywords: ['poster style', 'break', 'photo'], onClick: () => onApplyPosterStyle('image') },
    { id: 'bw-red', section: 'energy', label: 'B/W red', title: 'Reset to black/white/red minimalism', icon: Contrast, scope: 'all', keywords: ['poster style', 'black', 'white', 'red', 'minimal', 'reset'], onClick: () => onApplyPosterStyle('minimal') },

    { id: 'type-strip', section: 'type', label: 'Type strip', title: 'Repeat the selected text as printed strips', icon: Rows3, scope: 'sel', keywords: ['text', 'repeat', 'strips'], onClick: onAddTypeStrip, disabled: !selectedIsText },
    { id: 'break-copy', section: 'type', label: 'Break copy', title: 'Smash words together with erratic Ray Gun mid-word hyphenation — stays editable', icon: SplitSquareHorizontal, scope: 'sel', keywords: ['text', 'ray gun', 'smash', 'hyphen', 'no space', 'tight', 'column', 'break'], onClick: () => onBreakCopy?.(), disabled: !selectedIsText },
    { id: 'break-letters', section: 'type', label: 'Break letters', title: 'Break the selected text into loose letters', icon: Spline, scope: 'sel', keywords: ['text', 'split', 'loose'], onClick: onBreakSelectedType, disabled: !selectedIsText },
    { id: 'letter-break', section: 'type', label: 'Letter break', title: 'Cut each letter into its strokes and pull them apart', icon: ScissorsLineDashed, scope: 'sel', keywords: ['text', 'strokes', 'cut', 'fragment'], onClick: onLetterBreak, disabled: !selectedIsText },
    { id: 'bury-type', section: 'type', label: 'Bury type', title: 'Bury a ghost copy of the selected text', icon: Layers3, scope: 'sel', keywords: ['text', 'ghost', 'copy', 'texture'], onClick: onCloneTypeAsTexture, disabled: !selectedIsText },
    { id: 'red-echo', section: 'type', label: 'Red echo type', title: 'Stamp three large red echo words across the poster', icon: Stamp, scope: 'all', keywords: ['text', 'red', 'echo', 'words'], onClick: onAddRedEchoType },

    { id: 'copy-machine', section: 'print', label: 'Copy machine', title: 'Photocopy warp — source stays editable', icon: Printer, scope: 'sel', keywords: ['copy', 'copier', 'photocopy', 'xerox', 'warp'], onClick: onApplyCopyMachine, disabled: !selected },
    { id: 'solvent-transfer', section: 'print', label: 'Solvent transfer', title: 'Tape-rub & solvent xerox — localized ink pools, combed dry-brush smears, paste seams and debris', icon: Droplets, scope: 'sel', keywords: ['solvent', 'transfer', 'tape', 'smudge', 'blot', 'rub', 'ray gun', 'xerox', 'paste', 'grunge'], onClick: () => onApplySolventTransfer?.(), disabled: !selected },
    { id: 'ink-bleed', section: 'print', label: 'Ink bleed', title: 'Uneven ink — lines flood into blobs, starve to fragments, slur along the feed', icon: Droplet, scope: 'sel', keywords: ['ink', 'flood', 'blot', 'smear', 'copier'], onClick: onApplyInkBleed, disabled: !selected },
    { id: 'run-copier', section: 'print', label: 'Run through copier', title: 'Run every visible layer through the copier', icon: Copy, scope: 'all', keywords: ['copy', 'copier', 'photocopy', 'xerox', 'poster'], onClick: onApplyCopyMachineToPoster, disabled: layerCount === 0 },
    { id: 'copy-scatter-copy', section: 'print', label: 'Copy → Scatter → Copy', title: 'Copy Machine, then Scatter, then Copy Machine', icon: Repeat, scope: 'sel', keywords: ['copy', 'copier', 'gesture', 'chain', 'macro'], onClick: onApplyCopyScatterCopyGesture, disabled: !selected },
    { id: 'copy-selected', section: 'print', label: 'Copy selected', title: 'Re-photocopy the selected layer', icon: ScanLine, scope: 'sel', keywords: ['copy', 'copier', 'photocopy', 'xerox'], onClick: onApplyXerox, disabled: !selected, dataTour: 'xerox' },
    { id: 'misprint', section: 'print', label: 'Misprint offset', title: 'Add a faint misregistered print echo', icon: Layers, scope: 'sel', keywords: ['misregistration', 'ghost', 'echo', 'offset'], onClick: onAddMisprintDuplicate, disabled: !selected },
    { id: 'surface-wear', section: 'print', label: 'Surface wear', title: 'Add photocopier bands across the poster', icon: Waves, scope: 'all', keywords: ['bands', 'copier', 'scan'], onClick: onAddPrintScanSurface },
    { id: 'photocopy-noise', section: 'print', label: 'Photocopy noise', title: 'Sprinkle photocopier specks across the poster', icon: Aperture, scope: 'all', keywords: ['specks', 'grain', 'copier', 'dust'], onClick: onAddPhotocopyNoise },
    { id: 'crop-marks', section: 'print', label: 'Crop marks/grid', title: 'Stamp decorative crop marks onto the artwork', icon: Frame, scope: 'all', keywords: ['trim', 'marks', 'grid', 'registration'], onClick: onAddCropMarks },

    { id: 'age-selected', section: 'decay', label: 'Age selected', title: 'Age the selected layer', icon: Timer, scope: 'sel', keywords: ['wear', 'old', 'aged'], onClick: onApplyLayerDecay, disabled: !selected },
    { id: 'distress', section: 'decay', label: 'Distress', title: 'Convert the selected layer into harsh grit', icon: Flame, scope: 'sel', keywords: ['grunge', 'grit', 'rough'], onClick: onDistressSelected, disabled: !selected },
    { id: 'ink-loss', section: 'decay', label: 'Ink loss', title: 'Chip ink away from the selected layer', icon: Droplet, scope: 'sel', keywords: ['chip', 'wear', 'faded'], onClick: () => onAddLayerDecayMarks('ink-loss'), disabled: !selected },
    { id: 'fold-marks', section: 'decay', label: 'Fold marks', title: 'Add fold creases', icon: Rows3, scope: 'sel', keywords: ['crease', 'wear', 'paper'], onClick: () => onAddLayerDecayMarks('fold'), disabled: !selected },
    { id: 'wear-overlay', section: 'decay', label: 'Wear overlay', title: 'Add the full wear treatment', icon: Layers3, scope: 'sel', keywords: ['wear', 'ink loss', 'fold'], onClick: () => onAddLayerDecayMarks('all'), disabled: !selected },
    { id: 'decay-offset', section: 'decay', label: 'Decay offset', title: 'Add a faint decayed echo', icon: Copy, scope: 'sel', keywords: ['echo', 'ghost', 'copy', 'offset'], onClick: onAddLayerDecayOffset, disabled: !selected },

    { id: 'duplicate-drift', section: 'accident', label: 'Duplicate drift', title: 'Clone the selection with accidental drift', icon: Copy, scope: 'sel', keywords: ['copy', 'clone', 'duplicate', 'mistake'], onClick: onDuplicateDriftAccident, disabled: !selected },
    { id: 'bad-crop', section: 'accident', label: 'Bad crop', title: 'Crop badly on purpose', icon: Crop, scope: 'sel', keywords: ['mistake', 'cut'], onClick: onBadCropAccident, disabled: !selected },
    { id: 'flip-mistake', section: 'accident', label: 'Flip mistake', title: 'Add a flipped ghost', icon: FlipHorizontal, scope: 'sel', keywords: ['mirror', 'ghost', 'reverse'], onClick: onFlipMistakeAccident, disabled: !selected },
    { id: 'collide', section: 'accident', label: 'Collide selection', title: 'Pile selected layers into a collision', icon: Layers, scope: 'sel', keywords: ['pile', 'overlap', 'crash'], onClick: onCollideSelectionAccident, disabled: !selected },
    { id: 'nudge-layout', section: 'accident', label: 'Nudge layout', title: 'Nudge every layer with accidental drift', icon: Move, scope: 'all', keywords: ['drift', 'move', 'shift'], onClick: onNudgeLayoutAccident },
    { id: 'tear-collage', section: 'accident', label: 'Tear collage', title: 'Tear into shifted scraps', icon: Scissors, scope: 'sel', keywords: ['rip', 'scraps', 'paper'], onClick: onTearCollage, disabled: !selected },

    { id: 'press-check', section: 'press', label: 'Press Check', title: 'Keep ink spread, misregistration, and paper tooth as the print look', icon: Printer, scope: 'all', keywords: ['print', 'ink spread', 'misregistration', 'paper tooth', 'proof'], onClick: onTogglePressCheck, ariaLabel: pressCheckActive ? 'Turn off Press Check' : 'Press Check', pressed: pressCheckActive },

    { id: 'cold-wash', section: 'texture', label: 'Cold wash', title: 'Apply a cold print wash', icon: Droplets, scope: 'sel', keywords: ['image', 'photo', 'blue', 'tint'], onClick: onApplyColdWashImage, disabled: !selectedIsImage },
    { id: 'diagonal-texture', section: 'texture', label: 'Diagonal texture', title: 'Lay diagonal print texture lines', icon: ScanLine, scope: 'all', keywords: ['lines', 'stripes', 'hatch'], onClick: onAddDiagonalTexture },
    { id: 'white-scrapes', section: 'texture', label: 'White scrapes', title: 'Scrape white bands across the poster', icon: Eraser, scope: 'all', keywords: ['bands', 'erase', 'scratch'], onClick: onAddWhiteScrapes },

    { id: 'close-crop', section: 'crop', label: 'Close crop', title: 'Crop tight into the center', icon: Scan, scope: 'sel', keywords: ['tight', 'zoom'], onClick: () => onAggressiveCrop('close'), disabled: !selected },
    { id: 'off-center-crop', section: 'crop', label: 'Off-center crop', title: 'Crop off-center — press R to re-roll', icon: Crop, scope: 'sel', keywords: ['offset'], onClick: () => onAggressiveCrop('off-center'), disabled: !selected },
    { id: 'edge-crop', section: 'crop', label: 'Edge crop', title: 'Crop hard to one edge', icon: Frame, scope: 'sel', keywords: ['border'], onClick: () => onAggressiveCrop('edge'), disabled: !selected },
    { id: 'throw-to-edge', section: 'crop', label: 'Throw to edge', title: 'Throw the fragment to the poster border', icon: ScissorsLineDashed, scope: 'sel', keywords: ['crop', 'border', 'fragment'], onClick: onCropToPosterEdge, disabled: !selected },
  ]

  const starters = STARTER_IDS.map((id) => effects.find((effect) => effect.id === id)).filter((effect): effect is EffectDef => Boolean(effect))
  const trimmed = query.trim()
  const results = trimmed ? filterEffects(effects, trimmed) : []

  // Parameter controls travel with the section whose effects they scale.
  const sectionControls: Partial<Record<EffectSectionId, ReactNode>> = {
    type: (
      <>
        <label>
          Legibility
          <select value={typeLegibility} onChange={(event) => onTypeLegibilityChange(event.target.value as ExpressiveLegibility)}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <Slider label="Intensity" value={typeIntensity} min={0} max={100} onChange={onTypeIntensityChange} onCommit={onTypeIntensityCommit} />
      </>
    ),
    print: <Slider label="Generation" value={xeroxGeneration} min={1} max={10} onChange={onXeroxGenerationChange} onCommit={onXeroxGenerationCommit} />,
    decay: <Slider label="Amount" value={decayAmount} min={0} max={100} onChange={onDecayAmountChange} onCommit={onDecayAmountCommit} />,
    accident: <Slider label="Intensity" value={accidentIntensity} min={0} max={100} onChange={onAccidentIntensityChange} onCommit={onAccidentIntensityCommit} />,
  }

  return (
    <aside className="instruments-palette rail glass-panel" aria-label="Effects">
      <div className="panel-section effects-head">
        <h2 className="effects-title">
          Effects <span className="heading-sub">Instruments</span>
        </h2>
        <label className="effects-search" htmlFor={searchId}>
          <span className="visually-hidden">Search effects</span>
          <input
            ref={searchRef}
            id={searchId}
            type="search"
            value={query}
            placeholder="Search effects"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return
              event.stopPropagation()
              if (query) setQuery('')
              else {
                event.currentTarget.blur()
                onClose?.()
              }
            }}
          />
        </label>
      </div>

      {trimmed ? (
        <div className="panel-section effects-results">
          <p className="effects-results-status" role="status">
            {results.length === 0 ? `No effects match “${trimmed}”. Try a shorter word, like “copy” or “crop”.` : `${results.length} ${results.length === 1 ? 'effect' : 'effects'}`}
          </p>
          {results.length > 0 ? (
            <div className="effects-result-list">
              {results.map((effect) => (
                <EffectButton key={effect.id} effect={effect} variant="result" />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="panel-section effects-start">
            <h3 className="effects-start-title">Start here</h3>
            <div className="effects-starters">
              {starters.map((effect) => (
                <EffectButton key={effect.id} effect={effect} variant="starter" />
              ))}
            </div>
          </div>

          <div className="panel-section effects-groups">
            {SECTION_ORDER.map((sectionId) => {
              const sectionEffects = effects.filter((effect) => effect.section === sectionId)
              return (
                <Group
                  key={sectionId}
                  id={sectionId}
                  title={SECTION_TITLES[sectionId]}
                  count={sectionEffects.length}
                  open={isOpen(sectionId)}
                  onToggle={() => onToggleGroup(sectionId)}
                >
                  {sectionControls[sectionId]}
                  <div className="preset-row">
                    {sectionEffects.map((effect) => (
                      <EffectButton key={effect.id} effect={effect} />
                    ))}
                  </div>
                </Group>
              )
            })}

            <Group
              id="performance"
              title="Performance"
              open={isOpen('performance')}
              onToggle={() => onToggleGroup('performance')}
              badge={recording ? <span className="effects-group-live">Recording</span> : null}
            >
              <p className="performance-chain" role="status" aria-label="Recorded plays">
                {performanceLabel}
              </p>
              <div className="preset-row">
                <button
                  type="button"
                  className={recording ? 'recording' : undefined}
                  aria-pressed={recording}
                  aria-label={recording ? 'Stop recording gesture' : 'Record gesture'}
                  title={recording ? 'Stop capturing instrument plays' : 'Record a chain of instrument plays'}
                  onClick={onToggleRecording}
                >
                  <Disc size={14} aria-hidden /> {recording ? 'Stop' : 'Record'}
                </button>
                <button
                  type="button"
                  aria-label="Save performance"
                  title="Save the recorded chain as a replayable gesture"
                  onClick={onSavePerformance}
                  disabled={!canSavePerformance}
                >
                  Save
                </button>
                <button
                  type="button"
                  aria-label="Clear performance"
                  title="Discard recorded plays"
                  onClick={onClearPerformance}
                  disabled={!canSavePerformance}
                >
                  Clear
                </button>
              </div>
              {savedInstruments.length > 0 ? (
                <>
                  <h4 className="property-kicker">Saved instruments</h4>
                  <div className="preset-row">
                    {savedInstruments.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        aria-label={`Play instrument ${asset.name}`}
                        title={`Play ${asset.name} on the selected layer`}
                        onClick={() => onApplySavedInstrument(asset)}
                        disabled={!selected}
                      >
                        {asset.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
              {savedGestures.length > 0 ? (
                <>
                  <h4 className="property-kicker">Saved gestures</h4>
                  <div className="preset-row">
                    {savedGestures.map((gesture) => (
                      <button
                        key={gesture.id}
                        type="button"
                        title={`Play ${gesture.name} on the selected layer`}
                        onClick={() => onApplySavedGesture(gesture)}
                        disabled={!selected}
                      >
                        {gesture.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </Group>
          </div>
        </>
      )}
    </aside>
  )
}
