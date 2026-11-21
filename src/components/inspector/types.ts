import type { RefObject } from 'react'
import type { FabricObject } from 'fabric'
import type { PosterPresetId } from '../../lib/editorModel'
import type { DocumentMeta } from '../../lib/document'
import type { ShortcutGroup } from '../../lib/commands'
import type { PressRun } from '../../lib/press'
import type { StoredAsset } from '../../lib/assets'
import type { StoredProject } from '../../lib/storage'
import type { GridOverlay, LayoutGuide } from '../../lib/grid'
import type { Treatment } from '../../lib/treatments'
import type { LayerMask } from '../../lib/layerMask'
import type { FoundPaperKind } from '../../lib/foundPaper'
import type { Gesture } from '../../lib/gestures'
import type { SavedInstrument } from '../../lib/instrumentAssets'
import type { LayerStyle } from '../../lib/layerStyles'
import type { Adjustment, AdjustmentType } from '../../lib/adjustments'
import type { FrameSpec } from '../../lib/frameHandles'
import type { TrailFrame } from '../../lib/explorationTrail'
import type {
  ExportBackground,
  ExportFormat,
  InspectorTab,
  OpenTypeFeatures,
  SelectedState,
  StrokeDashPreset,
  TextSelectionRange,
} from '../../types/editor'

export type InspectorPanelProps = {
  inspectorTab: InspectorTab
  onInspectorTabChange: (tab: InspectorTab) => void
  panelCollapsed?: boolean
  onTogglePanelCollapsed?: () => void
  trailFrames: TrailFrame[]
  trailOpIds: string[]
  trailCursor: number
  onJumpTrail: (opId: string) => void
  onForkVariant: () => void
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
  onPreviewPosterTreatmentParams: (id: string, params: Record<string, number>) => void
  onUpdatePosterTreatmentParams: (id: string, params: Record<string, number>) => void
  onReorderLayerTreatment: (id: string, direction: 'up' | 'down') => void
  onRerollLayerTreatment: (id: string) => void
  onToggleLayerTreatment: (id: string) => void
  onRemoveLayerTreatment: (object: FabricObject, id: string) => void
  onPreviewLayerTreatmentParams: (id: string, params: Record<string, number>) => void
  onUpdateLayerTreatmentParams: (id: string, params: Record<string, number>) => void
  onSaveTreatmentStackAsComponent: () => void
  onSaveTreatmentStackAsGesture: () => void
  onSaveTreatmentAsInstrument: (treatment: Treatment) => void
  savedInstruments: SavedInstrument[]
  savedGestures: Gesture[]
  onApplySavedInstrument: (asset: SavedInstrument) => void
  onApplyGesture: (gesture: Gesture) => void
  layers: SelectedState[]
  selectedLayerIds: string[]
  renamingLayerId: string | null
  dragLayerId: string | null
  onSelectLayer: (id: string, additive?: boolean) => void
  onToggleLayerVisibility: (id: string) => void
  onToggleLayerLock: (id: string) => void
  onRenameLayerStart: (id: string) => void
  onRenameLayerEnd: (id: string, name: string) => void
  onDragLayerStart: (id: string) => void
  onDragLayerOver: (id: string) => void
  onDragLayerEnd: () => void
  onZoomToLayer: (id: string) => void
  selectedIsText: boolean
  selectedIsImage: boolean
  selectedIsPath: boolean
  canBooleanUnion: boolean
  canBooleanSubtract: boolean
  onBooleanUnion: () => void
  onBooleanSubtract: () => void
  pathEditMode: boolean
  pathAddPointMode: boolean
  pathIsClosed: boolean
  onTogglePathEditMode: () => void
  onTogglePathAddPointMode: () => void
  onClosePath: () => void
  customFonts: string[]
  fontInputRef: RefObject<HTMLInputElement | null>
  onFontFileChange: (file: File) => void
  fontStretch: number
  onFontStretchChange: (value: number) => void
  textContrast: number | null
  onUpdateActive: (values: Partial<SelectedState>) => void
  onFinalizeActive: (message: string) => void
  onLayerStyleChange: (style: LayerStyle) => void
  onAddAdjustment?: (type: AdjustmentType) => void
  onStartWarp?: (type: 'distort' | 'mesh') => void
  onRemoveWarp?: () => void
  onAdjustmentChange?: (adjustment: Adjustment) => void
  /** Edit the selected frame's handles and lines (see lib/frameHandles). */
  onFrameChange?: (patch: Partial<FrameSpec>, label: string) => void
  onFrameColorChange?: (color: string) => void
  onFrameShuffle?: () => void
  onFrameSelection?: () => void
  onFrameImages?: () => void
  onPreviewBlendMode: (mode: string | null) => void
  onApplyBlendMode: (mode: string) => void
  onLoadGoogleFont: (family: string) => Promise<void>
  openTypeFeatures: OpenTypeFeatures
  onOpenTypeChange: (features: Partial<OpenTypeFeatures>) => void
  textSelection: TextSelectionRange | null
  onSaveCharacterStyle: () => void
  onSaveParagraphStyle: () => void
  onApplyCharacterStyle: (styleId: string) => void
  onApplyParagraphStyle: (styleId: string) => void
  onStyleSelectionAccent: () => void
  onStyleSelectionBold: () => void
  onStyleSelectionItalic: () => void
  documentPalette: string[]
  onUpdatePaletteSwatch: (index: number, color: string) => void
  recentColors: string[]
  onPushRecentColor: (color: string) => void
  onPickColorWithEyeDropper: () => void
  /** The shortcut sheet, built from the command registry and the keymap. */
  shortcutGroups: ShortcutGroup[]
  onApplyTextOnPath: () => void
  onApplyGradientFill: (mode: 'linear' | 'radial') => void
  onApplyStrokeDash: (preset: StrokeDashPreset) => void
  onPaintBrushMask: () => void
  layerMask: LayerMask | null
  maskBrushSize: number
  onMaskBrushSizeChange: (size: number) => void
  maskHardness: number
  onMaskHardnessChange: (hardness: number) => void
  onInvertLayerMask: () => void
  onToggleLayerMask: () => void
  onClearLayerMask: () => void
  penStrokeWidth: number
  onPenStrokeColorChange: (color: string) => void
  onPenStrokeWidthChange: (width: number) => void
  onMoveLayer: (direction: 'front' | 'back') => void
  onApplyImageEffect: (effect: 'grayscale' | 'contrast' | 'threshold' | 'blur' | 'noise' | 'clear') => void
  onOpenFilterGallery: () => void
  storedAssets: StoredAsset[]
  documentMeta: DocumentMeta | null
  onInsertAsset: (asset: StoredAsset) => void
  onInsertFoundPaper: (kind: FoundPaperKind) => void
  onPhotographCollage: () => void
  onCrumpleSheet: () => void
  onAddCropMarks: () => void
  onInsertComponent: (componentId: string) => void
  onSaveSelectionAsComponent: () => void
  canGroupLayers: boolean
  canUngroupLayers: boolean
  onGroupLayers: () => void
  onDuplicateLayer?: () => void
  onDeleteLayer?: () => void
  onUngroupLayers: () => void
  onDetachInstance: () => void
  onResetInstance: () => void
  onUpdateComponent: () => void
  onAlignSelection: (mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void
  onDistributeSelection: (mode: 'horizontal' | 'vertical') => void
  onClipSelectionToShape: () => void
  onWeaveSelection: () => void
  onUnweaveLayer: () => void
  onTearEdges: () => void
  gridOverlay: GridOverlay
  onGridOverlayChange: (patch: Partial<GridOverlay>) => void
  onGridTensionChange: (value: number) => void
  onGridTensionCommit: () => void
  showLayoutGrid: boolean
  onToggleLayoutGrid: () => void
  showBaselineGrid: boolean
  onToggleBaselineGrid: () => void
  snapToGrid: boolean
  onToggleSnapToGrid: () => void
  layoutGuides: LayoutGuide[]
  onAddVerticalGuide: () => void
  onAddHorizontalGuide: () => void
  onRemoveLayoutGuide: (id: string) => void
  onClearLayoutGuides: () => void
  onRestoreVariant: (variantId: string) => void
  onOpenVariantCompare: (variantId: string) => void
  onMergeVariant: (variantId: string) => void
  onRenameVariant: (variantId: string) => void
  onOpenCompsGallery: () => void
  printDpi: number
  onPrintDpiChange: (dpi: number) => void
  bleedMm: number
  onBleedMmChange: (mm: number) => void
  /** The active poster's press run, or null when each effect inks on its own. */
  pressRun: PressRun | null
  showInkMap: boolean
  onPressOnChange: (on: boolean) => void
  onReinkPress: () => void
  onPreviewPressFeed: (angle: number) => void
  onCommitPressFeed: () => void
  onToggleInkMap: () => void
  showPrintGuides: boolean
  onTogglePrintGuides: () => void
  showCmykPreview: boolean
  onToggleCmykPreview: () => void
  onExportCmykPlates: () => void
  pdfRegistrationMarks: boolean
  onPdfRegistrationMarksChange: (enabled: boolean) => void
  onAddArtboard: () => void
  newArtboardPreset: PosterPresetId
  onNewArtboardPresetChange: (preset: PosterPresetId) => void
  onExportAllArtboards: () => void
}
