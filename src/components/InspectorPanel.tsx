import type { RefObject } from 'react'
import {
  AlignLeft,
  BringToFront,
  ChevronDown,
  ChevronUp,
  Dices,
  Download,
  Eye,
  EyeOff,
  Grid3x3,
  Pipette,
  SendToBack,
  Trash2,
} from 'lucide-react'
import type { FabricObject } from 'fabric'
import type { PosterPresetId } from '../lib/editorModel'
import type { DocumentMeta } from '../lib/document'
import type { StoredAsset } from '../lib/assets'
import type { StoredProject } from '../lib/storage'
import type { GridOverlay } from '../lib/grid'
import { GOOGLE_FONTS } from '../lib/fonts'
import { BLEND_MODES, FONT_STACKS, POSTER_PRESET_OPTIONS } from '../lib/editorConstants'
import { legibilityBand } from '../lib/color'
import { posterTreatmentLabel } from '../lib/posterTreatments'
import { treatmentLabel, type Treatment } from '../lib/treatments'
import type {
  ExportBackground,
  ExportFormat,
  InspectorTab,
  SelectedState,
  StrokeDashPreset,
} from '../types/editor'
import { LayersPanel } from './LayersPanel'
import { Slider } from './Slider'
import { ScopeSel } from './ScopeBadge'
import { formatDegrees, formatLineHeight, formatPercent } from '../lib/canvasUtils'

export type InspectorPanelProps = {
  inspectorTab: InspectorTab
  onInspectorTabChange: (tab: InspectorTab) => void
  projectName: string
  onProjectNameChange: (name: string) => void
  exportFormat: ExportFormat
  onExportFormatChange: (format: ExportFormat) => void
  exportScale: number
  onExportScaleChange: (scale: number) => void
  exportBackground: ExportBackground
  onExportBackgroundChange: (background: ExportBackground) => void
  exportQuality: number
  onExportQualityChange: (quality: number) => void
  onExportQualityCommit: () => void
  posterWidth: number
  posterHeight: number
  onExport: () => void
  savedProjects: StoredProject[]
  onLoadProject: (project: StoredProject) => void
  onDeleteProject: (id: string, name: string) => void
  posterTreatments: Treatment[]
  selected: SelectedState | null
  selectedObject: FabricObject | null
  selectedTreatments: Treatment[]
  onReorderPosterTreatment: (id: string, direction: 'up' | 'down') => void
  onRerollPosterTreatment: (id: string) => void
  onTogglePosterTreatment: (id: string) => void
  onRemovePosterTreatment: (id: string) => void
  onReorderLayerTreatment: (id: string, direction: 'up' | 'down') => void
  onRerollLayerTreatment: (id: string) => void
  onToggleLayerTreatment: (id: string) => void
  onRemoveLayerTreatment: (object: FabricObject, id: string) => void
  onSaveTreatmentStackAsComponent: () => void
  layers: SelectedState[]
  renamingLayerId: string | null
  dragLayerId: string | null
  onSelectLayer: (id: string) => void
  onToggleLayerVisibility: (id: string) => void
  onToggleLayerLock: (id: string) => void
  onRenameLayerStart: (id: string) => void
  onRenameLayerEnd: (id: string, name: string) => void
  onDragLayerStart: (id: string) => void
  onDragLayerOver: (id: string) => void
  onDragLayerEnd: () => void
  selectedIsText: boolean
  selectedIsImage: boolean
  selectedIsPath: boolean
  customFonts: string[]
  fontInputRef: RefObject<HTMLInputElement | null>
  onFontFileChange: (file: File) => void
  fontStretch: number
  onFontStretchChange: (value: number) => void
  textContrast: number | null
  onUpdateActive: (values: Partial<SelectedState>) => void
  onFinalizeActive: (message: string) => void
  onLoadGoogleFont: (family: string) => Promise<void>
  documentPalette: string[]
  onUpdatePaletteSwatch: (index: number, color: string) => void
  recentColors: string[]
  onPushRecentColor: (color: string) => void
  onPickColorWithEyeDropper: () => void
  onApplyTextOnPath: () => void
  onApplyGradientFill: (mode: 'linear' | 'radial') => void
  onApplyStrokeDash: (preset: StrokeDashPreset) => void
  onPaintBrushMask: () => void
  penStrokeWidth: number
  onPenStrokeColorChange: (color: string) => void
  onPenStrokeWidthChange: (width: number) => void
  onMoveLayer: (direction: 'front' | 'back') => void
  onApplyImageEffect: (effect: 'grayscale' | 'contrast' | 'threshold' | 'blur' | 'noise' | 'clear') => void
  storedAssets: StoredAsset[]
  documentMeta: DocumentMeta | null
  onInsertAsset: (asset: StoredAsset) => void
  onInsertComponent: (componentId: string) => void
  onSaveSelectionAsComponent: () => void
  onAlignSelection: (mode: 'left' | 'center' | 'right') => void
  onDistributeSelection: (mode: 'horizontal' | 'vertical') => void
  onClipSelectionToShape: () => void
  gridOverlay: GridOverlay
  onGridTensionChange: (value: number) => void
  onGridTensionCommit: () => void
  showLayoutGrid: boolean
  onToggleLayoutGrid: () => void
  showBaselineGrid: boolean
  onToggleBaselineGrid: () => void
  onRestoreVariant: (variantId: string) => void
  onOpenVariantCompare: (variantId: string) => void
  onMergeVariant: (variantId: string) => void
  onRenameVariant: (variantId: string) => void
  printDpi: number
  onPrintDpiChange: (dpi: number) => void
  bleedMm: number
  onBleedMmChange: (mm: number) => void
  showPrintGuides: boolean
  onTogglePrintGuides: () => void
  showCmykPreview: boolean
  onToggleCmykPreview: () => void
  pdfRegistrationMarks: boolean
  onPdfRegistrationMarksChange: (enabled: boolean) => void
  onAddArtboard: () => void
  newArtboardPreset: PosterPresetId
  onNewArtboardPresetChange: (preset: PosterPresetId) => void
  onExportAllArtboards: () => void
}

export function InspectorPanel({
  inspectorTab,
  onInspectorTabChange,
  projectName,
  onProjectNameChange,
  exportFormat,
  onExportFormatChange,
  exportScale,
  onExportScaleChange,
  exportBackground,
  onExportBackgroundChange,
  exportQuality,
  onExportQualityChange,
  onExportQualityCommit,
  posterWidth,
  posterHeight,
  onExport,
  savedProjects,
  onLoadProject,
  onDeleteProject,
  posterTreatments,
  selected,
  selectedObject,
  selectedTreatments,
  onReorderPosterTreatment,
  onRerollPosterTreatment,
  onTogglePosterTreatment,
  onRemovePosterTreatment,
  onReorderLayerTreatment,
  onRerollLayerTreatment,
  onToggleLayerTreatment,
  onRemoveLayerTreatment,
  onSaveTreatmentStackAsComponent,
  layers,
  renamingLayerId,
  dragLayerId,
  onSelectLayer,
  onToggleLayerVisibility,
  onToggleLayerLock,
  onRenameLayerStart,
  onRenameLayerEnd,
  onDragLayerStart,
  onDragLayerOver,
  onDragLayerEnd,
  selectedIsText,
  selectedIsImage,
  selectedIsPath,
  customFonts,
  fontInputRef,
  onFontFileChange,
  fontStretch,
  onFontStretchChange,
  textContrast,
  onUpdateActive,
  onFinalizeActive,
  onLoadGoogleFont,
  documentPalette,
  onUpdatePaletteSwatch,
  recentColors,
  onPushRecentColor,
  onPickColorWithEyeDropper,
  onApplyTextOnPath,
  onApplyGradientFill,
  onApplyStrokeDash,
  onPaintBrushMask,
  penStrokeWidth,
  onPenStrokeColorChange,
  onPenStrokeWidthChange,
  onMoveLayer,
  onApplyImageEffect,
  storedAssets,
  documentMeta,
  onInsertAsset,
  onInsertComponent,
  onSaveSelectionAsComponent,
  onAlignSelection,
  onDistributeSelection,
  onClipSelectionToShape,
  gridOverlay,
  onGridTensionChange,
  onGridTensionCommit,
  showLayoutGrid,
  onToggleLayoutGrid,
  showBaselineGrid,
  onToggleBaselineGrid,
  onRestoreVariant,
  onOpenVariantCompare,
  onMergeVariant,
  onRenameVariant,
  printDpi,
  onPrintDpiChange,
  bleedMm,
  onBleedMmChange,
  showPrintGuides,
  onTogglePrintGuides,
  showCmykPreview,
  onToggleCmykPreview,
  pdfRegistrationMarks,
  onPdfRegistrationMarksChange,
  onAddArtboard,
  newArtboardPreset,
  onNewArtboardPresetChange,
  onExportAllArtboards,
}: InspectorPanelProps) {
  return (
    <aside className="rail inspector glass-panel" aria-label="Inspector">
      <div className="inspector-tabs" role="tablist" aria-label="Inspector panels">
        {(
          [
            ['inspect', 'Inspect'],
            ['treatments', 'Treatments'],
            ['layers', 'Layers'],
            ['assets', 'Assets'],
            ['layout', 'Layout'],
            ['print', 'Print'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={inspectorTab === id}
            className={inspectorTab === id ? 'active' : undefined}
            onClick={() => onInspectorTabChange(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {inspectorTab === 'inspect' ? (
        <div className="panel-section">
          <h2>Project</h2>
          <label>
            Name
            <input value={projectName} onChange={(event) => onProjectNameChange(event.target.value)} />
          </label>
          <div className="export-box">
            <h3>Export</h3>
            <div className="split-inputs">
              <label>
                Format
                <select value={exportFormat} onChange={(event) => onExportFormatChange(event.target.value as ExportFormat)}>
                  <option value="png">PNG</option>
                  <option value="jpeg">JPG</option>
                  <option value="pdf">PDF</option>
                  <option value="tiff">TIFF</option>
                </select>
              </label>
              <label>
                Size
                <select value={exportScale} onChange={(event) => onExportScaleChange(Number(event.target.value))}>
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={3}>3x</option>
                  <option value={4}>4x</option>
                </select>
              </label>
            </div>
            <label>
              Background
              <select value={exportBackground} onChange={(event) => onExportBackgroundChange(event.target.value as ExportBackground)}>
                <option value="paper">Paper</option>
                <option value="white">White</option>
                <option value="transparent" disabled={exportFormat === 'jpeg'}>
                  Transparent
                </option>
              </select>
            </label>
            {exportFormat === 'jpeg' ? (
              <Slider
                label="JPG quality"
                value={exportQuality}
                min={40}
                max={100}
                format={formatPercent}
                onChange={onExportQualityChange}
                onCommit={onExportQualityCommit}
              />
            ) : null}
            <button type="button" className="primary-button export-button" onClick={onExport}>
              <Download size={17} />
              Export {posterWidth * exportScale} x {posterHeight * exportScale}
            </button>
          </div>
          <div className="saved-list">
            {savedProjects.length === 0 ? (
              <p className="empty">No saved posters yet.</p>
            ) : (
              savedProjects.map((project) => (
                <div key={project.id} className="saved-row">
                  <button type="button" title={`Load “${project.name}”`} onClick={() => onLoadProject(project)}>
                    <span>{project.name}</span>
                    <small>{new Date(project.savedAt).toLocaleString()}</small>
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Delete saved poster ${project.name}`}
                    title="Delete this saved poster"
                    onClick={() => onDeleteProject(project.id, project.name)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {inspectorTab === 'treatments' ? (
        <div className="panel-section">
          <h2>Treatment stack</h2>
          <p className="hint">Non-destructive — text stays editable; remove artifact treatments to restore the source layer.</p>
          {posterTreatments.length > 0 ? (
            <>
              <h3 className="property-kicker">Poster treatments</h3>
              <ul className="treatment-stack">
                {posterTreatments.map((treatment, index) => (
                  <li key={treatment.id} className={treatment.enabled ? undefined : 'bypassed'}>
                    <span>{posterTreatmentLabel(treatment)}</span>
                    <small>#{treatment.seed}</small>
                    <span className="treatment-actions">
                      <button type="button" title="Move up" disabled={index === 0} onClick={() => onReorderPosterTreatment(treatment.id, 'up')}>
                        <ChevronUp size={12} />
                      </button>
                      <button type="button" title="Move down" disabled={index === posterTreatments.length - 1} onClick={() => onReorderPosterTreatment(treatment.id, 'down')}>
                        <ChevronDown size={12} />
                      </button>
                      <button type="button" title="Re-roll seed" onClick={() => onRerollPosterTreatment(treatment.id)}>
                        <Dices size={12} />
                      </button>
                      <button type="button" title={treatment.enabled ? 'Bypass' : 'Enable'} onClick={() => onTogglePosterTreatment(treatment.id)}>
                        {treatment.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                      <button type="button" title="Remove" onClick={() => onRemovePosterTreatment(treatment.id)}>
                        <Trash2 size={12} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {!selected ? (
            <p className="empty">Select a layer to view its treatment stack.</p>
          ) : selectedTreatments.length === 0 ? (
            <p className="empty">No layer treatments yet. Try Xerox or Scatter from the left rail.</p>
          ) : (
            <>
              <h3 className="property-kicker">Layer treatments</h3>
              <ul className="treatment-stack">
                {selectedTreatments.map((treatment, index) => (
                  <li key={treatment.id} className={treatment.enabled ? undefined : 'bypassed'}>
                    <span>{treatmentLabel(treatment)}</span>
                    <small>#{treatment.seed}</small>
                    <span className="treatment-actions">
                      <button type="button" title="Move up" disabled={index === 0} onClick={() => onReorderLayerTreatment(treatment.id, 'up')}>
                        <ChevronUp size={12} />
                      </button>
                      <button type="button" title="Move down" disabled={index === selectedTreatments.length - 1} onClick={() => onReorderLayerTreatment(treatment.id, 'down')}>
                        <ChevronDown size={12} />
                      </button>
                      <button type="button" title="Re-roll seed" onClick={() => onRerollLayerTreatment(treatment.id)}>
                        <Dices size={12} />
                      </button>
                      <button type="button" title={treatment.enabled ? 'Bypass' : 'Enable'} onClick={() => onToggleLayerTreatment(treatment.id)}>
                        {treatment.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                      <button
                        type="button"
                        title="Remove"
                        onClick={() => {
                          if (!selectedObject) return
                          onRemoveLayerTreatment(selectedObject, treatment.id)
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button
            type="button"
            title="Save this layer's treatment stack as a reusable component"
            onClick={onSaveTreatmentStackAsComponent}
            disabled={!selected || selectedTreatments.length === 0}
          >
            Save stack as component
          </button>
        </div>
      ) : null}

      {inspectorTab === 'layers' ? (
        <div className="panel-section">
          <h2>Layers</h2>
          <LayersPanel
            layers={layers}
            selectedId={selected?.id ?? null}
            renamingLayerId={renamingLayerId}
            dragLayerId={dragLayerId}
            onSelect={onSelectLayer}
            onToggleVisibility={onToggleLayerVisibility}
            onToggleLock={onToggleLayerLock}
            onRenameStart={onRenameLayerStart}
            onRenameEnd={onRenameLayerEnd}
            onDragStart={onDragLayerStart}
            onDragOver={onDragLayerOver}
            onDragEnd={onDragLayerEnd}
          />
        </div>
      ) : null}

      {inspectorTab === 'inspect' ? (
        <>
          <div className="panel-section">
            <div className="panel-title">
              <h2>Selection</h2>
              <AlignLeft size={15} />
            </div>
            {!selected ? (
              <p className="empty">Select a layer to edit it.</p>
            ) : (
              <div className="control-stack">
                <div className="property-heading">
                  <p className="property-kicker">Properties</p>
                  <div className="property-title-row">
                    <h3>{selected.name}</h3>
                    <span className="property-badge">{selected.kind}</span>
                  </div>
                </div>
                <label>
                  Name
                  <input
                    value={selected.name}
                    onChange={(event) => onUpdateActive({ name: event.target.value })}
                    onBlur={() => onFinalizeActive('Renamed layer')}
                  />
                </label>
                {selectedIsText ? (
                  <>
                    <label>
                      Text
                      <textarea
                        value={selected.text ?? ''}
                        rows={4}
                        onChange={(event) => onUpdateActive({ text: event.target.value })}
                        onBlur={() => onFinalizeActive('Edited text')}
                      />
                    </label>
                    <label>
                      Font
                      <select
                        value={selected.fontFamily ?? FONT_STACKS[0]}
                        onChange={(event) => {
                          void onLoadGoogleFont(event.target.value).finally(() => {
                            onUpdateActive({ fontFamily: event.target.value })
                            onFinalizeActive('Changed font')
                          })
                        }}
                      >
                        <optgroup label="System">
                          {FONT_STACKS.map((font) => (
                            <option key={font} value={font} style={{ fontFamily: font }}>
                              {font}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Google Fonts">
                          {GOOGLE_FONTS.map((font) => (
                            <option key={font.family} value={font.family} style={{ fontFamily: font.family }}>
                              {font.family}
                            </option>
                          ))}
                        </optgroup>
                        {customFonts.length > 0 ? (
                          <optgroup label="Uploaded">
                            {customFonts.map((font) => (
                              <option key={font} value={font} style={{ fontFamily: font }}>
                                {font}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                      </select>
                    </label>
                    <button type="button" title="Upload a font file" onClick={() => fontInputRef.current?.click()}>
                      Upload font
                    </button>
                    <input
                      ref={fontInputRef}
                      className="visually-hidden"
                      type="file"
                      accept=".ttf,.otf,.woff,.woff2"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) onFontFileChange(file)
                        event.currentTarget.value = ''
                      }}
                    />
                    <Slider
                      label="Weight axis"
                      value={Number(selected.fontWeight) || 700}
                      min={100}
                      max={900}
                      onChange={(value) => onUpdateActive({ fontWeight: value })}
                      onCommit={() => onFinalizeActive('Changed weight')}
                    />
                    <Slider
                      label="Width axis"
                      value={fontStretch}
                      min={50}
                      max={200}
                      format={formatPercent}
                      onChange={(value) => {
                        onFontStretchChange(value)
                        onUpdateActive({ scaleX: value / 100 })
                      }}
                      onCommit={() => onFinalizeActive('Changed width axis')}
                    />
                    <p className="hint legibility-readout">
                      Legibility: {legibilityBand(textContrast)} · contrast {textContrast ? textContrast.toFixed(1) : '—'}:1
                    </p>
                    <Slider
                      label="Size"
                      value={selected.fontSize ?? 80}
                      min={12}
                      max={360}
                      onChange={(value) => onUpdateActive({ fontSize: value })}
                      onCommit={() => onFinalizeActive('Changed type size')}
                    />
                    <Slider
                      label="Spacing"
                      value={selected.charSpacing ?? 0}
                      min={-120}
                      max={260}
                      onChange={(value) => onUpdateActive({ charSpacing: value })}
                      onCommit={() => onFinalizeActive('Changed spacing')}
                    />
                    <Slider
                      label="Line"
                      value={Math.round((selected.lineHeight ?? 1) * 100)}
                      min={50}
                      max={180}
                      format={formatLineHeight}
                      onChange={(value) => onUpdateActive({ lineHeight: value / 100 })}
                      onCommit={() => onFinalizeActive('Changed line height')}
                    />
                  </>
                ) : null}

                <div className="split-inputs">
                  <label>
                    X
                    <input
                      type="number"
                      value={selected.left}
                      onChange={(event) => onUpdateActive({ left: Number(event.target.value) })}
                      onBlur={() => onFinalizeActive('Moved layer')}
                    />
                  </label>
                  <label>
                    Y
                    <input
                      type="number"
                      value={selected.top}
                      onChange={(event) => onUpdateActive({ top: Number(event.target.value) })}
                      onBlur={() => onFinalizeActive('Moved layer')}
                    />
                  </label>
                </div>
                <Slider
                  label="Rotate"
                  value={selected.angle}
                  min={-180}
                  max={180}
                  format={formatDegrees}
                  onChange={(value) => onUpdateActive({ angle: value })}
                  onCommit={() => onFinalizeActive('Rotated layer')}
                />
                <Slider
                  label="Opacity"
                  value={Math.round(selected.opacity * 100)}
                  min={5}
                  max={100}
                  format={formatPercent}
                  onChange={(value) => onUpdateActive({ opacity: value / 100 })}
                  onCommit={() => onFinalizeActive('Changed opacity')}
                />
                <Slider
                  label="Stretch X"
                  value={Math.round(selected.scaleX * 100)}
                  min={20}
                  max={320}
                  format={formatPercent}
                  onChange={(value) => onUpdateActive({ scaleX: value / 100 })}
                  onCommit={() => onFinalizeActive('Stretched layer')}
                />
                <Slider
                  label="Stretch Y"
                  value={Math.round(selected.scaleY * 100)}
                  min={20}
                  max={320}
                  format={formatPercent}
                  onChange={(value) => onUpdateActive({ scaleY: value / 100 })}
                  onCommit={() => onFinalizeActive('Stretched layer')}
                />
                <Slider
                  label="Skew X"
                  value={selected.skewX ?? 0}
                  min={-45}
                  max={45}
                  format={formatDegrees}
                  onChange={(value) => onUpdateActive({ skewX: value })}
                  onCommit={() => onFinalizeActive('Skewed layer')}
                />
                <label>
                  Color
                  <span className="color-row">
                    <input
                      type="color"
                      value={typeof selected.fill === 'string' ? selected.fill : '#111111'}
                      onChange={(event) => onUpdateActive({ fill: event.target.value })}
                      onBlur={(event) => {
                        onPushRecentColor(event.target.value)
                        onFinalizeActive('Changed color')
                      }}
                      disabled={selectedIsImage}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Pick a color from the screen"
                      title="Pick a color from the screen"
                      onClick={onPickColorWithEyeDropper}
                      disabled={selectedIsImage}
                    >
                      <Pipette size={14} />
                    </button>
                  </span>
                </label>
                <div className="swatch-row" aria-label="Document palette">
                  {documentPalette.map((color, index) => (
                    <label key={`${color}-${index}`} className="swatch-edit" title={`Document swatch ${index + 1}`}>
                      <input
                        type="color"
                        value={color}
                        disabled={selectedIsImage}
                        onChange={(event) => onUpdatePaletteSwatch(index, event.target.value)}
                      />
                      <button
                        type="button"
                        className="swatch"
                        style={{ background: color }}
                        disabled={selectedIsImage}
                        onClick={() => {
                          onUpdateActive({ fill: color })
                          onFinalizeActive('Applied palette color')
                        }}
                      />
                    </label>
                  ))}
                </div>
                {selectedIsText ? (
                  <button type="button" title="Wrap selected text on a curved path" onClick={onApplyTextOnPath}>
                    Text on path
                  </button>
                ) : null}
                {!selectedIsImage ? (
                  <div className="button-row">
                    <button type="button" title="Apply a linear gradient from palette colors" onClick={() => onApplyGradientFill('linear')}>
                      Linear gradient
                    </button>
                    <button type="button" title="Apply a radial gradient from palette colors" onClick={() => onApplyGradientFill('radial')}>
                      Radial gradient
                    </button>
                  </div>
                ) : null}
                {!selectedIsText && selected ? (
                  <div className="button-row">
                    <button type="button" onClick={() => onApplyStrokeDash('solid')}>
                      Solid stroke
                    </button>
                    <button type="button" onClick={() => onApplyStrokeDash('dashed')}>
                      Dashed
                    </button>
                    <button type="button" onClick={() => onApplyStrokeDash('dotted')}>
                      Dotted
                    </button>
                    <button type="button" onClick={onPaintBrushMask}>
                      Brush mask
                    </button>
                  </div>
                ) : null}
                {selectedIsPath ? (
                  <>
                    <label>
                      Stroke color
                      <input
                        type="color"
                        value={selected.stroke ?? '#111111'}
                        onChange={(event) => {
                          onUpdateActive({ stroke: event.target.value })
                          onPenStrokeColorChange(event.target.value)
                        }}
                        onBlur={() => onFinalizeActive('Changed stroke color')}
                      />
                    </label>
                    <Slider
                      label="Stroke width"
                      value={selected.strokeWidth ?? penStrokeWidth}
                      min={1}
                      max={48}
                      onChange={(value) => {
                        onUpdateActive({ strokeWidth: value })
                        onPenStrokeWidthChange(value)
                      }}
                      onCommit={() => onFinalizeActive('Changed stroke width')}
                    />
                  </>
                ) : null}
                {recentColors.length > 0 && !selectedIsImage ? (
                  <div className="swatch-row" aria-label="Recently used colors">
                    {recentColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className="swatch"
                        style={{ background: color }}
                        aria-label={`Use color ${color}`}
                        title={color}
                        onClick={() => {
                          onUpdateActive({ fill: color })
                          onFinalizeActive('Changed color')
                        }}
                      />
                    ))}
                  </div>
                ) : null}
                <label>
                  Blend
                  <select
                    value={selected.blendMode ?? 'source-over'}
                    onChange={(event) => {
                      onUpdateActive({ blendMode: event.target.value })
                      onFinalizeActive('Changed blend mode')
                    }}
                  >
                    {BLEND_MODES.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="button-row">
                  <button type="button" title="Bring the layer to the front" onClick={() => onMoveLayer('front')}>
                    <BringToFront size={16} />
                    Front
                  </button>
                  <button type="button" title="Send the layer to the back" onClick={() => onMoveLayer('back')}>
                    <SendToBack size={16} />
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="panel-section">
            <h2>Image effects</h2>
            <p className="hint">Effects stack — click again to remove one.</p>
            <div className="preset-row">
              {(['grayscale', 'contrast', 'threshold', 'blur', 'noise', 'clear'] as const).map((effect) => (
                <button
                  key={effect}
                  type="button"
                  title={effect === 'clear' ? 'Remove all image effects' : `Toggle ${effect} on the selected image`}
                  onClick={() => onApplyImageEffect(effect)}
                  disabled={!selectedIsImage}
                >
                  {effect} {effect === 'clear' ? null : <ScopeSel />}
                </button>
              ))}
            </div>
          </div>

          <div className="panel-section">
            <h2>Shortcuts</h2>
            <ul className="shortcut-list">
              <li>
                <kbd>Cmd+Z</kbd> Undo · <kbd>Cmd+Shift+Z</kbd> Redo
              </li>
              <li>
                <kbd>Cmd+D</kbd> Duplicate · <kbd>Delete</kbd> Remove
              </li>
              <li>
                <kbd>Cmd+K</kbd> Commands · <kbd>Cmd+B</kbd> Fork variant
              </li>
              <li>
                <kbd>Arrows</kbd> Nudge · <kbd>Shift+Arrows</kbd> Nudge ×10
              </li>
              <li>
                <kbd>T</kbd> Text · <kbd>B</kbd> Block · <kbd>R</kbd> Re-roll
              </li>
              <li>
                <kbd>Cmd+0</kbd> Fit · <kbd>Cmd+1</kbd> 100% · <kbd>Cmd+Scroll</kbd> Zoom
              </li>
              <li>
                <kbd>Space+Drag</kbd> Pan · <kbd>Cmd+Drag</kbd> No snapping
              </li>
            </ul>
          </div>
        </>
      ) : null}

      {inspectorTab === 'assets' ? (
        <div className="panel-section">
          <h2>Asset library</h2>
          <p className="hint">Drag thumbnails to the canvas — or click to insert.</p>
          {storedAssets.length === 0 ? (
            <p className="empty">Import images to build your library.</p>
          ) : (
            <div className="asset-grid">
              {storedAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className="asset-thumb"
                  title={asset.name}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/carson-asset', asset.id)
                  }}
                  onClick={() => onInsertAsset(asset)}
                >
                  <img src={asset.thumbnail} alt="" />
                  <span>{asset.name}</span>
                </button>
              ))}
            </div>
          )}
          {documentMeta && documentMeta.components.length > 0 ? (
            <>
              <h3>Components</h3>
              <div className="preset-row">
                {documentMeta.components.map((component) => (
                  <button key={component.id} type="button" onClick={() => onInsertComponent(component.id)}>
                    {component.name}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          <button type="button" title="Save the current selection as a reusable component" onClick={onSaveSelectionAsComponent} disabled={!selected}>
            Save selection as component
          </button>
        </div>
      ) : null}

      {inspectorTab === 'layout' ? (
        <div className="panel-section">
          <h2>Layout & grid</h2>
          <div className="button-row">
            <button type="button" onClick={() => onAlignSelection('left')}>
              Align left
            </button>
            <button type="button" onClick={() => onAlignSelection('center')}>
              Center
            </button>
            <button type="button" onClick={() => onAlignSelection('right')}>
              Align right
            </button>
          </div>
          <div className="button-row">
            <button type="button" onClick={() => onDistributeSelection('horizontal')}>
              Distribute H
            </button>
            <button type="button" onClick={() => onDistributeSelection('vertical')}>
              Distribute V
            </button>
            <button type="button" onClick={onClipSelectionToShape}>
              Clip to shape
            </button>
          </div>
          <Slider
            label="Grid tension"
            value={gridOverlay.tension}
            min={0}
            max={100}
            format={formatPercent}
            onChange={onGridTensionChange}
            onCommit={onGridTensionCommit}
          />
          <button type="button" onClick={onToggleLayoutGrid}>
            <Grid3x3 size={16} />
            {showLayoutGrid ? 'Hide column grid' : 'Show column grid'}
          </button>
          <button type="button" onClick={onToggleBaselineGrid}>
            <Grid3x3 size={16} />
            {showBaselineGrid ? 'Hide baseline grid' : 'Show baseline grid'}
          </button>
          {documentMeta && documentMeta.variants.length > 0 ? (
            <>
              <h3>Variations</h3>
              <p className="hint">
                Fork with <kbd>Cmd+B</kbd>, then restore or compare a branch.
              </p>
              <ul className="variant-list">
                {documentMeta.variants.map((variant) => (
                  <li key={variant.id} className="variant-card">
                    {variant.thumbnail ? (
                      <img className="variant-thumb" src={variant.thumbnail} alt="" />
                    ) : (
                      <div className="variant-thumb variant-thumb-placeholder" aria-hidden />
                    )}
                    <div className="variant-meta">
                      <strong>{variant.name}</strong>
                      <small>{new Date(variant.savedAt).toLocaleString()}</small>
                    </div>
                    <div className="variant-actions">
                      <button type="button" title={`Restore ${variant.name}`} onClick={() => onRestoreVariant(variant.id)}>
                        Restore
                      </button>
                      <button type="button" title={`Compare with ${variant.name}`} onClick={() => onOpenVariantCompare(variant.id)}>
                        Compare
                      </button>
                      <button type="button" title={`Merge ${variant.name} into current`} onClick={() => onMergeVariant(variant.id)}>
                        Merge
                      </button>
                      <button type="button" title={`Rename ${variant.name}`} onClick={() => onRenameVariant(variant.id)}>
                        Rename
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {inspectorTab === 'print' ? (
        <div className="panel-section">
          <h2>Print pipeline</h2>
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
          <label>
            <input type="checkbox" checked={pdfRegistrationMarks} onChange={(event) => onPdfRegistrationMarksChange(event.target.checked)} />
            Registration marks in PDF export
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
          <p className="hint">Print guides are document chrome — they never bake into artwork. Export PDF for print shops.</p>
        </div>
      ) : null}
    </aside>
  )
}
