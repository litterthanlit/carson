import { useMemo, useState, type ReactNode } from 'react'
import {
  Aperture,
  ChevronDown,
  ChevronRight,
  Circle,
  Columns3,
  Copy,
  Crop,
  Droplet,
  Droplets,
  Eraser,
  FlipHorizontal,
  Frame,
  Images,
  Layers,
  Loader2,
  Printer,
  Repeat,
  Rows3,
  ScanLine,
  Scissors,
  Search,
  Shuffle,
  Spline,
  Square,
  Target,
  Timer,
  Type,
  Wand2,
  Waves,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { ExpressiveLegibility } from '../lib/editorModel'
import type { Gesture } from '../lib/gestures'
import type { SavedInstrument } from '../lib/instrumentAssets'
import { FILTER_CATEGORIES, FILTER_PRESETS } from '../lib/filterGallery'
import {
  CATALOG_CATEGORIES,
  TREATMENT_CATALOG,
  catalogAvailability,
  catalogSamplePath,
  searchCatalog,
  type CatalogCategory,
  type CatalogContext,
  type CatalogEntry,
  type CatalogId,
  type CatalogSetting,
} from '../lib/treatmentCatalog'
import { Slider } from './Slider'

const ICONS: Record<CatalogId, LucideIcon> = {
  scramble: Shuffle,
  scatter: Shuffle,
  strips: Rows3,
  columns: Columns3,
  'type-strip': Type,
  'break-letters': Spline,
  'letter-break': Scissors,
  'bury-type': Layers,
  'red-echo': Type,
  'copy-machine': Printer,
  'ink-bleed': Droplet,
  xerox: ScanLine,
  misprint: Layers,
  'copy-scatter-copy': Repeat,
  'run-through-copier': Copy,
  'surface-wear': Waves,
  'photocopy-noise': Aperture,
  'crop-marks': Frame,
  age: Timer,
  distress: Aperture,
  'ink-loss': Droplets,
  'fold-marks': Rows3,
  'wear-overlay': Layers,
  'decay-offset': Copy,
  'duplicate-drift': Copy,
  'bad-crop': Crop,
  'flip-mistake': FlipHorizontal,
  collide: Layers,
  'nudge-layout': Shuffle,
  'tear-collage': Scissors,
  'close-crop': Crop,
  'off-center-crop': Crop,
  'edge-crop': Crop,
  'throw-to-edge': Scissors,
  'cold-wash': Droplets,
  'diagonal-texture': ScanLine,
  'white-scrapes': Eraser,
  'press-check': Printer,
  'magazine-chaos': Shuffle,
  'oversized-type': Type,
  'image-fracture': Images,
  'bw-red': Square,
  'filter-gallery': Wand2,
  'texture-gallery': Images,
}

const COLLAPSED_KEY = 'carson.treatmentBrowser.collapsed'

function readCollapsed(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]') as unknown
    return new Set(Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [])
  } catch {
    return new Set()
  }
}

function writeCollapsed(collapsed: Set<string>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]))
  } catch {
    /* private mode: folding still works for this visit */
  }
}

export type TreatmentSettings = {
  typeLegibility: ExpressiveLegibility
  typeIntensity: number
  xeroxGeneration: number
  decayAmount: number
  accidentIntensity: number
}

export type TreatmentBrowserProps = {
  context: CatalogContext
  settings: TreatmentSettings
  onSettingChange: <K extends keyof TreatmentSettings>(setting: K, value: TreatmentSettings[K]) => void
  onSettingCommit: (setting: CatalogSetting) => void
  pressCheckActive: boolean
  /** The treatment being tried on the poster, waiting for Keep or Cancel. */
  trialId: CatalogId | null
  /** The treatment still rendering after a click. */
  runningId: CatalogId | null
  onTry: (id: CatalogId) => void
  onOpenFilter: (presetId: string) => void
  appliedCount: number
  onShowApplied: () => void
  recording: boolean
  performanceLabel: string
  canSavePerformance: boolean
  onToggleRecording: () => void
  onSavePerformance: () => void
  onClearPerformance: () => void
  savedInstruments: SavedInstrument[]
  savedGestures: Gesture[]
  onApplySavedInstrument: (asset: SavedInstrument) => void
  onApplySavedGesture: (gesture: Gesture) => void
}

/**
 * Every treatment in one searchable place. Tiles show each treatment on the same sample poster;
 * clicking one tries it on the real poster, and the trial bar keeps, re-rolls or cancels it.
 */
export function TreatmentBrowser(props: TreatmentBrowserProps) {
  const { context, trialId, runningId, onTry, onOpenFilter, appliedCount, onShowApplied } = props
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const searching = query.trim().length > 0

  const matches = useMemo(() => new Set(searchCatalog(query).map((entry) => entry.id)), [query])
  const filterMatches = useMemo(() => {
    if (!searching) return []
    const words = query.trim().toLowerCase().split(/\s+/)
    return FILTER_PRESETS.filter((preset) => {
      const category = FILTER_CATEGORIES.find((item) => item.id === preset.category)?.label ?? ''
      const haystack = `${preset.name} ${category} ${preset.description ?? ''} filter`.toLowerCase()
      return words.every((word) => haystack.includes(word))
    })
  }, [query, searching])

  const toggleCategory = (id: string) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      writeCollapsed(next)
      return next
    })
  }

  const sections = CATALOG_CATEGORIES.map((category) => ({
    category,
    entries: (TREATMENT_CATALOG as readonly CatalogEntry[]).filter(
      (entry) => entry.category === category.id && matches.has(entry.id as CatalogId),
    ),
  })).filter((section) => section.entries.length > 0)

  const nothingFound = searching && sections.length === 0 && filterMatches.length === 0

  return (
    <aside className="treatment-browser rail glass-panel" aria-label="Treatments browser">
      <div className="treatment-browser-head">
        <label className="treatment-search">
          <Search size={13} aria-hidden />
          <span className="visually-hidden">Search treatments</span>
          <input
            type="search"
            value={query}
            placeholder="Search — xerox, tear, crop…"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && query) {
                event.preventDefault()
                event.stopPropagation()
                setQuery('')
              }
            }}
          />
          {query ? (
            <button type="button" className="treatment-search-clear" aria-label="Clear search" onClick={() => setQuery('')}>
              <X size={12} />
            </button>
          ) : null}
        </label>
        <p className="treatment-browser-hint">Click to try it on the poster, then keep, re-roll or cancel.</p>
        {appliedCount > 0 ? (
          <button type="button" className="treatment-applied-link" onClick={onShowApplied}>
            {appliedCount} applied to this layer · Edit
          </button>
        ) : null}
      </div>

      {!searching ? <PerformanceSection {...props} collapsed={collapsed.has('performance')} onToggle={() => toggleCategory('performance')} /> : null}

      {sections.map(({ category, entries }) => {
        const open = searching || !collapsed.has(category.id)
        return (
          <section key={category.id} className="treatment-category" aria-labelledby={`treatment-cat-${category.id}`}>
            <h2 id={`treatment-cat-${category.id}`} className="treatment-category-heading">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`treatment-cat-body-${category.id}`}
                disabled={searching}
                onClick={() => toggleCategory(category.id)}
              >
                {open ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
                {category.label}
              </button>
            </h2>
            <div id={`treatment-cat-body-${category.id}`} className="treatment-category-body" hidden={!open}>
              {!searching && category.settings ? <CategorySettings category={category.id} {...props} /> : null}
              <div className="treatment-grid">
                {entries.map((entry) => (
                  <TreatmentTile
                    key={entry.id}
                    entry={entry}
                    context={context}
                    pressed={entry.kind === 'toggle' ? props.pressCheckActive : undefined}
                    trial={trialId === entry.id}
                    running={runningId === entry.id}
                    onTry={onTry}
                  />
                ))}
              </div>
            </div>
          </section>
        )
      })}

      {filterMatches.length > 0 ? (
        <section className="treatment-category" aria-labelledby="treatment-cat-filters">
          <h2 id="treatment-cat-filters" className="treatment-category-heading">
            <span>Filters</span>
          </h2>
          <ul className="treatment-filter-list">
            {filterMatches.map((preset) => (
              <li key={preset.id}>
                <button
                  type="button"
                  disabled={!context.hasSelection}
                  title={context.hasSelection ? `${preset.description ?? preset.name} — opens the Filter gallery` : 'Select a layer first'}
                  onClick={() => onOpenFilter(preset.id)}
                >
                  <Wand2 size={13} aria-hidden />
                  <span>{preset.name}</span>
                  <small>{FILTER_CATEGORIES.find((item) => item.id === preset.category)?.label}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {nothingFound ? <p className="treatment-empty">No treatments match “{query.trim()}”.</p> : null}
    </aside>
  )
}

function TreatmentTile({
  entry,
  context,
  pressed,
  trial,
  running,
  onTry,
}: {
  entry: CatalogEntry
  context: CatalogContext
  pressed?: boolean
  trial: boolean
  running: boolean
  onTry: (id: CatalogId) => void
}) {
  const [sampleMissing, setSampleMissing] = useState(entry.sample === 'none')
  const id = entry.id as CatalogId
  const Icon = ICONS[id]
  const { enabled, reason } = catalogAvailability(entry, context)
  const poster = entry.scope === 'poster'
  const ScopeIcon = poster ? Square : Target
  const scopeText = poster ? 'Whole poster' : 'Selected layers'

  return (
    <button
      type="button"
      className={['treatment-tile', trial ? 'is-trial' : null, poster ? 'is-poster' : null].filter(Boolean).join(' ')}
      data-tour={entry.tour}
      disabled={!enabled}
      aria-pressed={pressed}
      aria-current={trial ? 'true' : undefined}
      aria-busy={running || undefined}
      title={enabled ? `${entry.description} · ${scopeText}` : `${entry.description} — ${reason}`}
      onClick={() => onTry(id)}
    >
      <span className="treatment-tile-preview">
        {sampleMissing ? (
          <Icon size={22} aria-hidden />
        ) : (
          <img src={catalogSamplePath(id)} alt="" loading="lazy" decoding="async" onError={() => setSampleMissing(true)} />
        )}
        <span className="treatment-tile-scope" aria-hidden>
          <ScopeIcon size={10} />
        </span>
        {running ? (
          <span className="treatment-tile-busy" aria-hidden>
            <Loader2 size={18} />
          </span>
        ) : null}
      </span>
      <span className="treatment-tile-name">
        {entry.name}
        {poster ? <span className="visually-hidden">, whole poster</span> : null}
      </span>
    </button>
  )
}

function CategorySettings({
  category,
  settings,
  onSettingChange,
  onSettingCommit,
}: { category: CatalogCategory } & Pick<TreatmentBrowserProps, 'settings' | 'onSettingChange' | 'onSettingCommit'>) {
  let controls: ReactNode = null
  if (category === 'type') {
    controls = (
      <>
        <label className="treatment-setting-select">
          Legibility
          <select
            value={settings.typeLegibility}
            onChange={(event) => onSettingChange('typeLegibility', event.target.value as ExpressiveLegibility)}
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <Slider
          label="Type intensity"
          value={settings.typeIntensity}
          min={0}
          max={100}
          onChange={(value) => onSettingChange('typeIntensity', value)}
          onCommit={() => onSettingCommit('typeIntensity')}
        />
      </>
    )
  } else if (category === 'print') {
    controls = (
      <Slider
        label="Generation"
        value={settings.xeroxGeneration}
        min={1}
        max={10}
        onChange={(value) => onSettingChange('xeroxGeneration', value)}
        onCommit={() => onSettingCommit('xeroxGeneration')}
      />
    )
  } else if (category === 'decay') {
    controls = (
      <Slider
        label="Decay amount"
        value={settings.decayAmount}
        min={0}
        max={100}
        onChange={(value) => onSettingChange('decayAmount', value)}
        onCommit={() => onSettingCommit('decayAmount')}
      />
    )
  } else if (category === 'accident') {
    controls = (
      <Slider
        label="Accident intensity"
        value={settings.accidentIntensity}
        min={0}
        max={100}
        onChange={(value) => onSettingChange('accidentIntensity', value)}
        onCommit={() => onSettingCommit('accidentIntensity')}
      />
    )
  }
  return controls ? <div className="treatment-settings">{controls}</div> : null
}

function PerformanceSection({
  collapsed,
  onToggle,
  context,
  recording,
  performanceLabel,
  canSavePerformance,
  onToggleRecording,
  onSavePerformance,
  onClearPerformance,
  savedInstruments,
  savedGestures,
  onApplySavedInstrument,
  onApplySavedGesture,
}: TreatmentBrowserProps & { collapsed: boolean; onToggle: () => void }) {
  return (
    <section className="treatment-category" aria-labelledby="treatment-cat-performance">
      <h2 id="treatment-cat-performance" className="treatment-category-heading">
        <button type="button" aria-expanded={!collapsed} aria-controls="treatment-cat-body-performance" onClick={onToggle}>
          {collapsed ? <ChevronRight size={12} aria-hidden /> : <ChevronDown size={12} aria-hidden />}
          Performance
          {recording ? <span className="treatment-recording-dot" aria-label="recording" /> : null}
        </button>
      </h2>
      <div id="treatment-cat-body-performance" className="treatment-category-body" hidden={collapsed}>
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
            <Circle size={14} /> {recording ? 'Stop' : 'Record'}
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
            <h3 className="property-kicker">Saved instruments</h3>
            <div className="preset-row">
              {savedInstruments.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  aria-label={`Play instrument ${asset.name}`}
                  title={`Play ${asset.name} on the selected layer`}
                  onClick={() => onApplySavedInstrument(asset)}
                  disabled={!context.hasSelection}
                >
                  {asset.name}
                </button>
              ))}
            </div>
          </>
        ) : null}
        {savedGestures.length > 0 ? (
          <>
            <h3 className="property-kicker">Saved gestures</h3>
            <div className="preset-row">
              {savedGestures.map((gesture) => (
                <button
                  key={gesture.id}
                  type="button"
                  title={`Play ${gesture.name} on the selected layer`}
                  onClick={() => onApplySavedGesture(gesture)}
                  disabled={!context.hasSelection}
                >
                  {gesture.name}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}
