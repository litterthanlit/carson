import type { PosterPresetId } from '../../lib/editorModel'
import { POSTER_PRESET_OPTIONS } from '../../lib/editorConstants'
import { formatDegrees } from '../../lib/canvasUtils'
import { Slider } from '../Slider'
import { PrintGamutReadout } from './PrintGamutReadout'
import type { InspectorPanelProps } from './types'

type PrintTabProps = Pick<
  InspectorPanelProps,
  | 'posterWidth'
  | 'posterHeight'
  | 'selected'
  | 'printDpi'
  | 'onPrintDpiChange'
  | 'bleedMm'
  | 'onBleedMmChange'
  | 'pressRun'
  | 'showInkMap'
  | 'onPressOnChange'
  | 'onReinkPress'
  | 'onPreviewPressFeed'
  | 'onCommitPressFeed'
  | 'onToggleInkMap'
  | 'showPrintGuides'
  | 'onTogglePrintGuides'
  | 'showCmykPreview'
  | 'onToggleCmykPreview'
  | 'onExportCmykPlates'
  | 'pdfRegistrationMarks'
  | 'onPdfRegistrationMarksChange'
  | 'onAddArtboard'
  | 'newArtboardPreset'
  | 'onNewArtboardPresetChange'
  | 'onExportAllArtboards'
>

export function PrintTab({
  posterWidth,
  posterHeight,
  selected,
  printDpi,
  onPrintDpiChange,
  bleedMm,
  onBleedMmChange,
  pressRun,
  showInkMap,
  onPressOnChange,
  onReinkPress,
  onPreviewPressFeed,
  onCommitPressFeed,
  onToggleInkMap,
  showPrintGuides,
  onTogglePrintGuides,
  showCmykPreview,
  onToggleCmykPreview,
  onExportCmykPlates,
  pdfRegistrationMarks,
  onPdfRegistrationMarksChange,
  onAddArtboard,
  newArtboardPreset,
  onNewArtboardPresetChange,
  onExportAllArtboards,
}: PrintTabProps) {
  return (
    <div className="panel-section">
      <h2>Print pipeline</h2>
      <p className="hint">
        {Math.round((posterWidth / printDpi) * 25.4)} × {Math.round((posterHeight / printDpi) * 25.4)} mm
        {' · '}
        {printDpi} dpi
        {' · '}
        {bleedMm} mm bleed
      </p>
      <p className="hint">Soft-proof is a screen preview. Export CMYK plates writes C, M, Y, and K as grayscale pages for press. PDF pages cap at 2048px on the long edge so the file stays openable.</p>
      <label>
        Document DPI
        <input type="number" value={printDpi} min={72} max={600} onChange={(event) => onPrintDpiChange(Number(event.target.value))} />
      </label>
      <label>
        Bleed (mm)
        <input type="number" value={bleedMm} min={0} max={20} onChange={(event) => onBleedMmChange(Number(event.target.value))} />
      </label>
      <button type="button" onClick={onTogglePrintGuides}>
        {showPrintGuides ? 'Hide bleed/trim guides' : 'Show bleed/trim guides'}
      </button>
      <button type="button" onClick={onToggleCmykPreview}>
        {showCmykPreview ? 'Disable CMYK soft-proof' : 'Enable CMYK soft-proof'}
      </button>
      <button type="button" onClick={onExportCmykPlates}>
        Export CMYK plates
      </button>
      <PrintGamutReadout hex={typeof selected?.fill === 'string' ? selected.fill : undefined} />
      <section className="press-card" aria-labelledby="press-heading">
        <h3 id="press-heading" className="property-kicker">
          Press
        </h3>
        <label className="toggle-row">
          <input
            type="checkbox"
            role="switch"
            checked={Boolean(pressRun)}
            onChange={(event) => onPressOnChange(event.target.checked)}
          />
          One press for the whole poster
        </label>
        {pressRun ? (
          <>
            <p className="hint">
              Copier ink, misprints, type strips and Press Check share this run’s ink map, paper and plate slip. Move
              type into a wet train to flood it, a dry one to starve it.
            </p>
            <div className="preset-row">
              <button type="button" title="Roll a new run: new wet and dry trains, new paper, new slip" onClick={onReinkPress}>
                Re-ink <span className="seed-chip">#{pressRun.seed}</span>
              </button>
              <button type="button" aria-pressed={showInkMap} onClick={onToggleInkMap}>
                {showInkMap ? 'Hide ink map' : 'Show ink map'}
              </button>
            </div>
            <Slider
              label="Feed angle"
              value={pressRun.feedAngle}
              defaultValue={0}
              min={0}
              max={359}
              format={formatDegrees}
              onChange={onPreviewPressFeed}
              onCommit={onCommitPressFeed}
            />
          </>
        ) : (
          <p className="hint">Off: each effect inks on its own, the way posters made before the press print.</p>
        )}
      </section>
      <label className="toggle-row">
        <input type="checkbox" role="switch" checked={pdfRegistrationMarks} onChange={(event) => onPdfRegistrationMarksChange(event.target.checked)} />
        Printer’s marks in PDF export
      </label>
      <button type="button" onClick={onAddArtboard}>
        Add artboard
      </button>
      <label>
        New artboard preset
        <select value={newArtboardPreset} onChange={(event) => onNewArtboardPresetChange(event.target.value as PosterPresetId)}>
          {POSTER_PRESET_OPTIONS.filter((option) => option.id !== 'custom').map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={onExportAllArtboards}>
        Export all artboards
      </button>
      <p className="hint">Bleed, trim, and safe are document chrome — they never bake into artwork. PDF marks sit in the slug; SVG keeps type and vectors editable.</p>
    </div>
  )
}
