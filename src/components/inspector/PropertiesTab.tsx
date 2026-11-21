import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  BringToFront,
  Brush,
  Download,
  Folder,
  Image as ImageIcon,
  Pipette,
  SendToBack,
  SlidersHorizontal,
  Square,
  Trash2,
  Type,
  Upload,
} from 'lucide-react'
import { formatDegrees, formatLineHeight, formatPercent } from '../../lib/canvasUtils'
import { legibilityBand } from '../../lib/color'
import { formatModKey } from '../../lib/commands'
import { FONT_STACKS } from '../../lib/editorConstants'
import { FRAME_COLOR } from '../../lib/frameHandles'
import { formatProjectTimestamp } from '../../lib/home'
import { hasMaskContent, layerMaskLabel } from '../../lib/layerMask'
import { layerStyleScale } from '../../lib/layerStyles'
import { hasWeave } from '../../lib/weave'
import type { ExportBackground, ExportFormat } from '../../types/editor'
import { AdjustmentPanel } from '../AdjustmentPanel'
import { FontPicker } from '../FontPicker'
import { FrameControls } from '../FrameControls'
import { FragmentLayerIcon } from '../icons/StudioIcons'
import { LayerStylePanel } from '../LayerStylePanel'
import { PropertySection } from '../PropertySection'
import { ScopeSel } from '../ScopeBadge'
import { Slider } from '../Slider'
import { PrintGamutReadout } from './PrintGamutReadout'
import type { InspectorPanelProps } from './types'

const KIND_ICONS = {
  text: Type,
  image: ImageIcon,
  shape: Square,
  fragment: FragmentLayerIcon,
  group: Folder,
  adjustment: SlidersHorizontal,
  paint: Brush,
} as const

type PropertiesTabProps = Pick<
  InspectorPanelProps,
  | 'exportFormat'
  | 'onExportFormatChange'
  | 'exportScale'
  | 'onExportScaleChange'
  | 'exportBackground'
  | 'onExportBackgroundChange'
  | 'exportQuality'
  | 'onExportQualityChange'
  | 'onExportQualityCommit'
  | 'posterWidth'
  | 'posterHeight'
  | 'onExport'
  | 'savedProjects'
  | 'onLoadProject'
  | 'onDeleteProject'
  | 'selected'
  | 'selectedLayerIds'
  | 'selectedIsText'
  | 'selectedIsImage'
  | 'selectedIsPath'
  | 'canBooleanUnion'
  | 'canBooleanSubtract'
  | 'onBooleanUnion'
  | 'onBooleanSubtract'
  | 'pathEditMode'
  | 'pathAddPointMode'
  | 'pathIsClosed'
  | 'onTogglePathEditMode'
  | 'onTogglePathAddPointMode'
  | 'onClosePath'
  | 'customFonts'
  | 'fontInputRef'
  | 'onFontFileChange'
  | 'fontStretch'
  | 'onFontStretchChange'
  | 'textContrast'
  | 'onUpdateActive'
  | 'onFinalizeActive'
  | 'onLayerStyleChange'
  | 'onStartWarp'
  | 'onRemoveWarp'
  | 'onAdjustmentChange'
  | 'onFrameChange'
  | 'onFrameColorChange'
  | 'onFrameShuffle'
  | 'onLoadGoogleFont'
  | 'openTypeFeatures'
  | 'onOpenTypeChange'
  | 'textSelection'
  | 'onSaveCharacterStyle'
  | 'onSaveParagraphStyle'
  | 'onApplyCharacterStyle'
  | 'onApplyParagraphStyle'
  | 'onStyleSelectionAccent'
  | 'onStyleSelectionBold'
  | 'onStyleSelectionItalic'
  | 'documentPalette'
  | 'onUpdatePaletteSwatch'
  | 'recentColors'
  | 'onPushRecentColor'
  | 'onPickColorWithEyeDropper'
  | 'onApplyTextOnPath'
  | 'onApplyGradientFill'
  | 'onApplyStrokeDash'
  | 'onPaintBrushMask'
  | 'layerMask'
  | 'maskBrushSize'
  | 'onMaskBrushSizeChange'
  | 'maskHardness'
  | 'onMaskHardnessChange'
  | 'onInvertLayerMask'
  | 'onToggleLayerMask'
  | 'onClearLayerMask'
  | 'penStrokeWidth'
  | 'onPenStrokeColorChange'
  | 'onPenStrokeWidthChange'
  | 'onMoveLayer'
  | 'onApplyImageEffect'
  | 'onOpenFilterGallery'
  | 'documentMeta'
  | 'canGroupLayers'
  | 'canUngroupLayers'
  | 'onGroupLayers'
  | 'onUngroupLayers'
  | 'onDetachInstance'
  | 'onResetInstance'
  | 'onUpdateComponent'
  | 'onClipSelectionToShape'
  | 'onUnweaveLayer'
  | 'onTearEdges'
>

export function PropertiesTab({
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
  selected,
  selectedLayerIds,
  selectedIsText,
  selectedIsImage,
  selectedIsPath,
  canBooleanUnion,
  canBooleanSubtract,
  onBooleanUnion,
  onBooleanSubtract,
  pathEditMode,
  pathAddPointMode,
  pathIsClosed,
  onTogglePathEditMode,
  onTogglePathAddPointMode,
  onClosePath,
  customFonts,
  fontInputRef,
  onFontFileChange,
  fontStretch,
  onFontStretchChange,
  textContrast,
  onUpdateActive,
  onFinalizeActive,
  onLayerStyleChange,
  onStartWarp,
  onRemoveWarp,
  onAdjustmentChange,
  onFrameChange,
  onFrameColorChange,
  onFrameShuffle,
  onLoadGoogleFont,
  openTypeFeatures,
  onOpenTypeChange,
  textSelection,
  onSaveCharacterStyle,
  onSaveParagraphStyle,
  onApplyCharacterStyle,
  onApplyParagraphStyle,
  onStyleSelectionAccent,
  onStyleSelectionBold,
  onStyleSelectionItalic,
  documentPalette,
  onUpdatePaletteSwatch,
  recentColors,
  onPushRecentColor,
  onPickColorWithEyeDropper,
  onApplyTextOnPath,
  onApplyGradientFill,
  onApplyStrokeDash,
  onPaintBrushMask,
  layerMask,
  maskBrushSize,
  onMaskBrushSizeChange,
  maskHardness,
  onMaskHardnessChange,
  onInvertLayerMask,
  onToggleLayerMask,
  onClearLayerMask,
  penStrokeWidth,
  onPenStrokeColorChange,
  onPenStrokeWidthChange,
  onMoveLayer,
  onApplyImageEffect,
  onOpenFilterGallery,
  documentMeta,
  canGroupLayers,
  canUngroupLayers,
  onGroupLayers,
  onUngroupLayers,
  onDetachInstance,
  onResetInstance,
  onUpdateComponent,
  onClipSelectionToShape,
  onUnweaveLayer,
  onTearEdges,
}: PropertiesTabProps) {
  const activeEffectCount = selected?.layerStyle
    ? Object.values(selected.layerStyle).filter((effect) => effect && effect.enabled !== false).length
    : 0
  const effectsSummary = activeEffectCount > 0 ? `${activeEffectCount} on` : undefined
  const maskSummary = hasMaskContent(layerMask) ? (layerMask?.enabled === false ? 'bypassed' : 'on') : undefined
  const fillHex = typeof selected?.fill === 'string' && selected.fill.startsWith('#') ? selected.fill : '#111111'
  const KindIcon = selected ? (KIND_ICONS[selected.kind as keyof typeof KIND_ICONS] ?? Square) : Square

  if (!selected) {
    return (
      <div className="panel-section ps-doc-panel">
        <div className="panel-title">
          <h2>Canvas</h2>
          <span className="property-badge">
            {posterWidth} × {posterHeight}
          </span>
        </div>
        <p className="hint">Select a layer to edit its properties, or export the poster below.</p>
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
                <option value="svg">SVG</option>
              </select>
            </label>
            <label>
              Size
              <select
                value={exportScale}
                disabled={exportFormat === 'svg'}
                onChange={(event) => onExportScaleChange(Number(event.target.value))}
              >
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
            <Download size={14} aria-hidden />
            {exportFormat === 'svg'
              ? `Export SVG ${posterWidth} × ${posterHeight}`
              : `Export ${posterWidth * exportScale} × ${posterHeight * exportScale}`}
          </button>
        </div>
        {savedProjects.length > 0 ? (
          <details className="saved-disclosure">
            <summary>Saved posters ({savedProjects.length})</summary>
            <div className="saved-list">
              {savedProjects.map((project) => (
                <div key={project.id} className="saved-row">
                  <button
                    type="button"
                    aria-label={`Load ${project.name}`}
                    title={`Load “${project.name}”`}
                    onClick={() => onLoadProject(project)}
                  >
                    <span>{project.name}</span>
                    <small>{formatProjectTimestamp(project.lastUsedAt ?? project.savedAt)}</small>
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Delete saved poster ${project.name}`}
                    title="Delete this saved poster"
                    onClick={() => onDeleteProject(project.id, project.name)}
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    )
  }

  const transformSection = (
    <PropertySection id="transform" title="Transform">
      <div className="ps-field-grid">
        <label className="ps-xy-field">
          <span>X</span>
          <input
            type="number"
            aria-label="X"
            value={selected.left}
            onChange={(event) => onUpdateActive({ left: Number(event.target.value) })}
            onBlur={() => onFinalizeActive('Moved layer')}
          />
        </label>
        <label className="ps-xy-field">
          <span>Y</span>
          <input
            type="number"
            aria-label="Y"
            value={selected.top}
            onChange={(event) => onUpdateActive({ top: Number(event.target.value) })}
            onBlur={() => onFinalizeActive('Moved layer')}
          />
        </label>
        <Slider
          variant="field"
          label="W"
          defaultValue={100}
          value={Math.round(selected.scaleX * 100)}
          min={20}
          max={320}
          format={formatPercent}
          onChange={(value) => onUpdateActive({ scaleX: value / 100 })}
          onCommit={() => onFinalizeActive('Stretched layer')}
        />
        <Slider
          variant="field"
          label="H"
          defaultValue={100}
          value={Math.round(selected.scaleY * 100)}
          min={20}
          max={320}
          format={formatPercent}
          onChange={(value) => onUpdateActive({ scaleY: value / 100 })}
          onCommit={() => onFinalizeActive('Stretched layer')}
        />
        <Slider
          variant="field"
          label="Angle"
          defaultValue={0}
          value={selected.angle}
          min={-180}
          max={180}
          format={formatDegrees}
          onChange={(value) => onUpdateActive({ angle: value })}
          onCommit={() => onFinalizeActive('Rotated layer')}
        />
        <Slider
          variant="field"
          label="Skew"
          defaultValue={0}
          value={selected.skewX ?? 0}
          min={-45}
          max={45}
          format={formatDegrees}
          onChange={(value) => onUpdateActive({ skewX: value })}
          onCommit={() => onFinalizeActive('Skewed layer')}
        />
      </div>
      <div className="ps-transform-actions">
        {selectedLayerIds.length <= 1 && onStartWarp ? (
          <>
            <button type="button" title={`Drag four corners for perspective (${formatModKey('k')}: Distort)`} onClick={() => onStartWarp('distort')}>
              Distort
            </button>
            <button type="button" title="Bend the layer with a 4×4 mesh" onClick={() => onStartWarp('mesh')}>
              Warp
            </button>
            {selected.warp && onRemoveWarp ? (
              <button type="button" title="Back to the unwarped layer" onClick={onRemoveWarp}>
                Unwarp
              </button>
            ) : null}
          </>
        ) : null}
        <span className="ps-actions-spacer" />
        <button type="button" className="icon-button" aria-label="Bring to front" title="Bring layer to front" onClick={() => onMoveLayer('front')}>
          <BringToFront size={14} aria-hidden />
        </button>
        <button type="button" className="icon-button" aria-label="Send to back" title="Send layer to back" onClick={() => onMoveLayer('back')}>
          <SendToBack size={14} aria-hidden />
        </button>
      </div>
    </PropertySection>
  )

  return (
    <div className="panel-section ps-properties-panel">
      <div className="ps-layer-identity">
        <span className="ps-layer-identity-icon" aria-hidden>
          <KindIcon size={14} />
        </span>
        <input
          className="ps-layer-identity-name"
          aria-label="Name"
          title="Click to rename layer"
          value={selected.name}
          onChange={(event) => onUpdateActive({ name: event.target.value })}
          onBlur={() => onFinalizeActive('Renamed layer')}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
        <span className="property-badge">{selected.kind}</span>
      </div>

      <div className="control-stack">
        {selected.componentId ? (
          <div className="instance-card">
            <p className="property-kicker">Component instance</p>
            <p className="hint">
              {documentMeta?.components.find((item) => item.id === selected.componentId)?.name ?? 'Component'}
              {selected.overrideCount ? ` · ${selected.overrideCount} override${selected.overrideCount === 1 ? '' : 's'}` : ' · no overrides'}
            </p>
            <div className="button-row">
              <button type="button" title="Restore this instance from the component, keeping position" onClick={onResetInstance}>
                Reset
              </button>
              <button type="button" title="Unlink this instance so it is a regular layer" onClick={onDetachInstance}>
                Detach
              </button>
              <button type="button" title="Write this instance back to the component definition" onClick={onUpdateComponent}>
                Update
              </button>
            </div>
          </div>
        ) : null}

        {canGroupLayers || canUngroupLayers ? (
          <div className="button-row">
            {canGroupLayers ? (
              <button type="button" title={`Group selected layers (${formatModKey('g')})`} onClick={onGroupLayers}>
                Group
              </button>
            ) : null}
            {canUngroupLayers ? (
              <button type="button" title={`Ungroup (${formatModKey('g', true)})`} onClick={onUngroupLayers}>
                Ungroup
              </button>
            ) : null}
          </div>
        ) : null}

        {selected.adjustment && onAdjustmentChange ? (
          <>
            <AdjustmentPanel
              adjustment={selected.adjustment}
              opacity={selected.opacity}
              onChange={onAdjustmentChange}
              onOpacityChange={(opacity) => onUpdateActive({ opacity })}
              onCommit={onFinalizeActive}
            />
            <div className="button-row">
              <button type="button" title="Bring the layer to the front" onClick={() => onMoveLayer('front')}>
                <BringToFront size={14} aria-hidden />
                Front
              </button>
              <button type="button" title="Send the layer to the back" onClick={() => onMoveLayer('back')}>
                <SendToBack size={14} aria-hidden />
                Back
              </button>
            </div>
          </>
        ) : (
          <>
            {selectedIsText ? (
              <PropertySection id="type" title="Character">
                <div className="ps-font-row">
                  <FontPicker
                    value={selected.fontFamily ?? FONT_STACKS[0]}
                    customFonts={customFonts}
                    onLoadGoogleFont={onLoadGoogleFont}
                    onChange={(family) => {
                      onUpdateActive({ fontFamily: family })
                      onFinalizeActive('Changed font')
                    }}
                  />
                  <button
                    type="button"
                    className="icon-button ps-font-upload"
                    aria-label="Upload font"
                    title="Upload a font file (.ttf, .otf, .woff)"
                    onClick={() => fontInputRef.current?.click()}
                  >
                    <Upload size={14} aria-hidden />
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
                </div>

                <div className="ps-field-grid">
                  <Slider
                    variant="field"
                    label="Size"
                    value={selected.fontSize ?? 80}
                    min={12}
                    max={360}
                    onChange={(value) => onUpdateActive({ fontSize: value })}
                    onCommit={() => onFinalizeActive('Changed type size')}
                  />
                  <Slider
                    variant="field"
                    label="Leading"
                    defaultValue={100}
                    value={Math.round((selected.lineHeight ?? 1) * 100)}
                    min={50}
                    max={180}
                    format={formatLineHeight}
                    onChange={(value) => onUpdateActive({ lineHeight: value / 100 })}
                    onCommit={() => onFinalizeActive('Changed line height')}
                  />
                  <Slider
                    variant="field"
                    label="Tracking"
                    defaultValue={0}
                    value={selected.charSpacing ?? 0}
                    min={-120}
                    max={260}
                    onChange={(value) => onUpdateActive({ charSpacing: value })}
                    onCommit={() => onFinalizeActive('Changed spacing')}
                  />
                  <Slider
                    variant="field"
                    label="Weight"
                    value={Number(selected.fontWeight) || 700}
                    min={100}
                    max={900}
                    onChange={(value) => onUpdateActive({ fontWeight: value })}
                    onCommit={() => onFinalizeActive('Changed weight')}
                  />
                </div>

                <div className="ps-color-bar">
                  <span className="ps-color-label">Color</span>
                  <div className="ps-color-controls">
                    <input
                      type="color"
                      aria-label="Text color"
                      value={fillHex}
                      onChange={(event) => onUpdateActive({ fill: event.target.value })}
                      onBlur={(event) => {
                        onPushRecentColor(event.target.value)
                        onFinalizeActive('Changed color')
                      }}
                    />
                    <span className="ps-color-hex">{fillHex.toUpperCase()}</span>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Pick a color from the screen"
                      title="Pick a color from the screen"
                      onClick={onPickColorWithEyeDropper}
                    >
                      <Pipette size={14} aria-hidden />
                    </button>
                  </div>
                </div>

                <div className="swatch-row" aria-label="Document palette">
                  {documentPalette.map((color, index) => (
                    <label key={`${color}-${index}`} className="swatch-edit" title={`Document swatch ${index + 1}`}>
                      <input
                        type="color"
                        value={color}
                        onChange={(event) => onUpdatePaletteSwatch(index, event.target.value)}
                      />
                      <button
                        type="button"
                        className="swatch"
                        style={{ background: color }}
                        onClick={() => {
                          onUpdateActive({ fill: color })
                          onFinalizeActive('Applied palette color')
                        }}
                      />
                    </label>
                  ))}
                </div>

                <div className="icon-segmented" role="radiogroup" aria-label="Paragraph alignment">
                  {(
                    [
                      ['left', 'Left', AlignLeft],
                      ['center', 'Center', AlignCenter],
                      ['right', 'Right', AlignRight],
                      ['justify', 'Justify', AlignJustify],
                    ] as const
                  ).map(([align, label, Icon]) => (
                    <button
                      key={align}
                      type="button"
                      role="radio"
                      aria-checked={(selected.textAlign ?? 'left') === align}
                      aria-label={`Align text ${label.toLowerCase()}`}
                      title={`Align ${label.toLowerCase()}`}
                      onClick={() => {
                        onUpdateActive({ textAlign: align })
                        onFinalizeActive('Changed text alignment')
                      }}
                    >
                      <Icon size={14} aria-hidden />
                    </button>
                  ))}
                </div>

                <details className="ps-subdisclosure">
                  <summary>Type options</summary>
                  <div className="ps-subdisclosure-body">
                    <label>
                      Edit copy
                      <textarea
                        aria-label="Text"
                        value={selected.text ?? ''}
                        rows={3}
                        onChange={(event) => onUpdateActive({ text: event.target.value })}
                        onBlur={() => onFinalizeActive('Edited text')}
                      />
                    </label>
                    <p className="hint">Double-click text on the canvas to edit directly.</p>
                    <Slider
                      label="Width axis"
                      defaultValue={100}
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
                    <div className="opentype-toggles">
                      <p className="property-kicker">OpenType</p>
                      <label className="toggle-row">
                        <input
                          type="checkbox"
                          role="switch"
                          checked={openTypeFeatures.kern}
                          onChange={(event) => onOpenTypeChange({ kern: event.target.checked })}
                        />
                        Kerning
                      </label>
                      <label className="toggle-row">
                        <input
                          type="checkbox"
                          role="switch"
                          checked={openTypeFeatures.liga}
                          onChange={(event) => onOpenTypeChange({ liga: event.target.checked })}
                        />
                        Ligatures
                      </label>
                      <label className="toggle-row">
                        <input
                          type="checkbox"
                          role="switch"
                          checked={openTypeFeatures.smcp}
                          onChange={(event) => onOpenTypeChange({ smcp: event.target.checked })}
                        />
                        Small caps
                      </label>
                    </div>
                    <div className="text-styles panel-section nested">
                      <p className="property-kicker">Styles</p>
                      {textSelection ? (
                        <div className="button-row">
                          <button type="button" title="Apply accent color to selection" onClick={onStyleSelectionAccent}>
                            Accent
                          </button>
                          <button type="button" title="Bold selected characters" onClick={onStyleSelectionBold}>
                            Bold
                          </button>
                          <button type="button" title="Italic selected characters" onClick={onStyleSelectionItalic}>
                            Italic
                          </button>
                        </div>
                      ) : null}
                      <div className="button-row">
                        <button type="button" title="Save character style from selection or layer" onClick={onSaveCharacterStyle}>
                          Save char style
                        </button>
                        <button type="button" title="Save paragraph style from this text layer" onClick={onSaveParagraphStyle}>
                          Save para style
                        </button>
                      </div>
                      {documentMeta && documentMeta.characterStyles.length > 0 ? (
                        <label>
                          Character style
                          <select
                            defaultValue=""
                            onChange={(event) => {
                              if (event.target.value) onApplyCharacterStyle(event.target.value)
                              event.currentTarget.value = ''
                            }}
                          >
                            <option value="">Apply character style…</option>
                            {documentMeta.characterStyles.map((style) => (
                              <option key={style.id} value={style.id}>
                                {style.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      {documentMeta && documentMeta.paragraphStyles.length > 0 ? (
                        <label>
                          Paragraph style
                          <select
                            defaultValue=""
                            onChange={(event) => {
                              if (event.target.value) onApplyParagraphStyle(event.target.value)
                              event.currentTarget.value = ''
                            }}
                          >
                            <option value="">Apply paragraph style…</option>
                            {documentMeta.paragraphStyles.map((style) => (
                              <option key={style.id} value={style.id}>
                                {style.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </div>
                    <button type="button" title="Wrap selected text on a curved path" onClick={onApplyTextOnPath}>
                      Text on path
                    </button>
                  </div>
                </details>
              </PropertySection>
            ) : null}

            {selected.frame && onFrameChange && selectedLayerIds.length <= 1 ? (
              <PropertySection id="frame" title="Frame">
                <FrameControls
                  layout="panel"
                  spec={selected.frame}
                  color={typeof selected.fill === 'string' && selected.fill.startsWith('#') ? selected.fill : FRAME_COLOR}
                  posterWidth={posterWidth}
                  posterHeight={posterHeight}
                  onChange={onFrameChange}
                  onColorChange={(color) => onFrameColorChange?.(color)}
                  onCommit={onFinalizeActive}
                  onShuffle={() => onFrameShuffle?.()}
                />
              </PropertySection>
            ) : null}

            {transformSection}

            {!selectedIsImage ? (
              <PropertySection id="appearance" title="Appearance" defaultOpen={!selectedIsText}>
                {!selectedIsText ? (
                  <>
                    <div className="ps-color-bar">
                      <span className="ps-color-label">Fill</span>
                      <div className="ps-color-controls">
                        <input
                          type="color"
                          aria-label="Fill color"
                          value={fillHex}
                          onChange={(event) => onUpdateActive({ fill: event.target.value })}
                          onBlur={(event) => {
                            onPushRecentColor(event.target.value)
                            onFinalizeActive('Changed color')
                          }}
                        />
                        <span className="ps-color-hex">{fillHex.toUpperCase()}</span>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label="Pick a color from the screen"
                          title="Pick a color from the screen"
                          onClick={onPickColorWithEyeDropper}
                        >
                          <Pipette size={14} aria-hidden />
                        </button>
                      </div>
                    </div>
                    <div className="swatch-row" aria-label="Document palette">
                      {documentPalette.map((color, index) => (
                        <label key={`${color}-${index}`} className="swatch-edit" title={`Document swatch ${index + 1}`}>
                          <input
                            type="color"
                            value={color}
                            onChange={(event) => onUpdatePaletteSwatch(index, event.target.value)}
                          />
                          <button
                            type="button"
                            className="swatch"
                            style={{ background: color }}
                            onClick={() => {
                              onUpdateActive({ fill: color })
                              onFinalizeActive('Applied palette color')
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  </>
                ) : null}
                <PrintGamutReadout hex={typeof selected.fill === 'string' ? selected.fill : undefined} />
                {recentColors.length > 0 ? (
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
                {!selected.frame ? (
                  <div className="button-row">
                    <button type="button" title="Apply a linear gradient from palette colors" onClick={() => onApplyGradientFill('linear')}>
                      Linear gradient
                    </button>
                    <button type="button" title="Apply a radial gradient from palette colors" onClick={() => onApplyGradientFill('radial')}>
                      Radial gradient
                    </button>
                  </div>
                ) : null}
                {!selectedIsText && !selected.frame ? (
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
                  </div>
                ) : null}
              </PropertySection>
            ) : null}

            {selectedIsImage ? (
              <PropertySection id="image-effects" title="Image adjustments">
                <div className="preset-row effect-grid">
                  {(['grayscale', 'contrast', 'threshold', 'blur', 'noise', 'clear'] as const).map((effect) => (
                    <button
                      key={effect}
                      type="button"
                      title={effect === 'clear' ? 'Remove all image effects' : `Toggle ${effect} on the selected image`}
                      onClick={() => onApplyImageEffect(effect)}
                    >
                      {effect} {effect === 'clear' ? null : <ScopeSel />}
                    </button>
                  ))}
                  <button
                    type="button"
                    title="Open the Filter Gallery for directional blurs and stacked looks"
                    onClick={onOpenFilterGallery}
                  >
                    Filter gallery <ScopeSel />
                  </button>
                </div>
              </PropertySection>
            ) : null}

            {selectedIsPath || canBooleanUnion || canBooleanSubtract ? (
              <PropertySection id="path" title="Path">
                {canBooleanUnion || canBooleanSubtract ? (
                  <div className="button-row">
                    <button
                      type="button"
                      title="Union selected shapes into one path"
                      disabled={!canBooleanUnion}
                      onClick={onBooleanUnion}
                    >
                      Combine <ScopeSel />
                    </button>
                    <button
                      type="button"
                      title="Second selected shape punches the first"
                      disabled={!canBooleanSubtract}
                      onClick={onBooleanSubtract}
                    >
                      Subtract <ScopeSel />
                    </button>
                  </div>
                ) : null}
                {selectedIsPath ? (
                  <>
                    <div className="button-row">
                      <button
                        type="button"
                        className={pathEditMode ? 'active' : undefined}
                        onClick={onTogglePathEditMode}
                      >
                        {pathEditMode ? 'Done editing points' : 'Edit points'}
                      </button>
                      {pathEditMode ? (
                        <button
                          type="button"
                          className={pathAddPointMode ? 'active' : undefined}
                          onClick={onTogglePathAddPointMode}
                        >
                          {pathAddPointMode ? 'Adding points' : '+ Point'}
                        </button>
                      ) : null}
                      {pathEditMode ? (
                        <button type="button" disabled={pathIsClosed} onClick={onClosePath}>
                          Close path
                        </button>
                      ) : null}
                    </div>
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
              </PropertySection>
            ) : null}

            {selectedLayerIds.length <= 1 ? (
              <PropertySection id="effects" title="Effects" defaultOpen={false} summary={effectsSummary}>
                <LayerStylePanel
                  style={selected.layerStyle ?? null}
                  onChange={onLayerStyleChange}
                  onCommit={onFinalizeActive}
                  scale={layerStyleScale(posterWidth, posterHeight)}
                />
              </PropertySection>
            ) : null}

            <PropertySection id="mask" title="Mask" defaultOpen={false} summary={maskSummary}>
              <p className="hint">
                {hasMaskContent(layerMask)
                  ? `${layerMaskLabel(layerMask)} · ${layerMask?.enabled === false ? 'bypassed' : 'live'}`
                  : 'Paint to conceal. Alt-paint to reveal. Clip keeps the source.'}
              </p>
              <Slider
                label="Brush"
                value={maskBrushSize}
                min={4}
                max={100}
                onChange={onMaskBrushSizeChange}
                onCommit={() => undefined}
              />
              <Slider
                label="Softness"
                value={100 - maskHardness}
                min={0}
                max={90}
                onChange={(value) => onMaskHardnessChange(100 - value)}
                onCommit={() => undefined}
              />
              <div className="button-row">
                <button type="button" onClick={onPaintBrushMask}>
                  Paint
                </button>
                <button type="button" onClick={onClipSelectionToShape}>
                  Clip to shape
                </button>
              </div>
              <div className="button-row">
                <button type="button" title="Rip this layer's edges like torn paper — again for a new rip" onClick={onTearEdges}>
                  Tear edges
                </button>
                {hasWeave(layerMask) ? (
                  <button type="button" title="Remove the over/under cut from Weave" onClick={onUnweaveLayer}>
                    Unweave
                  </button>
                ) : null}
              </div>
              <div className="button-row">
                <button type="button" disabled={!hasMaskContent(layerMask)} onClick={onInvertLayerMask}>
                  Invert
                </button>
                <button type="button" disabled={!hasMaskContent(layerMask)} onClick={onToggleLayerMask}>
                  {layerMask?.enabled === false ? 'Enable' : 'Bypass'}
                </button>
                <button type="button" disabled={!hasMaskContent(layerMask)} onClick={onClearLayerMask}>
                  Clear
                </button>
              </div>
            </PropertySection>
          </>
        )}
      </div>
    </div>
  )
}
