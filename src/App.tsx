import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActiveSelection,
  Canvas,
  Ellipse,
  FabricObject,
  Gradient,
  Image as FabricImage,
  Line,
  Path,
  PencilBrush,
  Point,
  Polygon,
  Rect,
  Textbox,
  filters,
  util,
} from 'fabric'
import {
  applyPosterPreset,
  createAccidentTransforms,
  createCropGuides,
  createDiagonalTextureLines,
  createLayerDecayMarks,
  createPhotocopyNoise,
  createPrintScanArtifacts,
  createTypeStrips,
  getLayerDecayProfile,
  getPrintScanProfile,
  type ExpressiveLegibility,
  type PosterPreset,
  type PosterPresetId,
} from './lib/editorModel'
import { createSeededRandom, newSeed } from './lib/random'
import {
  clearAutosave,
  deleteProject,
  findProjectByName,
  listProjects,
  loadAutosave,
  migrateLegacyProjects,
  newProjectId,
  saveAutosave,
  saveProject as persistProject,
  type StoredProject,
} from './lib/storage'
import { addTreatment, captureTransformBaseline, readTreatments, writeTreatments, type Treatment } from './lib/treatments'
import { cropModeToParam, findCropFragments } from './lib/cropTreatment'
import { sliceDirectionToParam } from './lib/sliceTreatment'
import {
  createDefaultDocument,
  findVariant,
  forkVariant,
  getActiveArtboard,
  mergeVariantCanvas,
  renameVariant,
  switchArtboard,
  addArtboard,
  updateArtboardPreset,
  type DocumentMeta,
} from './lib/document'
import { loadFontFile, loadGoogleFont } from './lib/fonts'
import { contrastRatio } from './lib/color'
import { alignObjects, distributeObjects, type GridOverlay } from './lib/grid'
import { softProofHex } from './lib/cmykPreview'
import {
  ACCENTS,
  BLEND_MODES,
  HISTORY_PROPS,
  ONBOARDING_KEY,
  ZOOM_LEVELS,
} from './lib/editorConstants'
import { addPosterTreatment, readPosterTreatments, writePosterTreatments } from './lib/posterTreatments'
import { captureLayerOrder, captureObjectPatch } from './lib/historyObject'
import {
  buildStarPoints,
  readFileAsDataUrl,
  readObjectProp,
  round,
  safeFileName,
} from './lib/canvasUtils'
import { legibilityToParam } from './lib/glyphBreakTreatment'
import { sliceDirectionToParam as badCropDirectionToParam } from './lib/badCropTreatment'
import { downloadPdfFromImageData, rgbaToTiffBlob } from './lib/print'
import { createThumbnail, listAssets, newAssetId, saveAsset, type StoredAsset } from './lib/assets'
import type { CommandAction } from './lib/commands'
import { CommandPalette } from './components/CommandPalette'
import { EditorCanvas } from './components/EditorCanvas'
import { InspectorPanel } from './components/InspectorPanel'
import { LeftRail } from './components/LeftRail'
import { OnboardingModal } from './components/OnboardingModal'
import { TopBar } from './components/TopBar'
import { VariantCompareModal } from './components/VariantCompareModal'
import { FilterGalleryModal } from './components/FilterGalleryModal'
import type { FilterPreset } from './lib/filterGallery'
import { paramsForTreatment } from './lib/filterGallery'
import { useCanvasEvents } from './hooks/useCanvasEvents'
import { useTreatments } from './hooks/useTreatments'
import { useEditorHistory } from './hooks/useEditorHistory'
import { createLayerThumbnail } from './lib/layerThumbnail'
import {
  applyPathData,
  getPathAnchorPoints,
  movePathPoint,
  pathAnchorWorldPosition,
  pathPointNear,
  type PathAnchorPoint,
} from './lib/pathEditing'
import type {
  ExportBackground,
  ExportFormat,
  InspectorTab,
  LayerKind,
  SelectedState,
  StrokeDashPreset,
} from './types/editor'
import './App.css'

type ChaosRun = {
  label: string
  seed: number
  targetIds: string[]
  perform: (seed: number) => void | Promise<void>
}
type StyleBaseline = {
  left: number
  top: number
  angle: number
  opacity: number
  fill: string | undefined
  globalCompositeOperation: string
}

type EyeDropperResult = { sRGBHex: string }
type EyeDropperConstructor = new () => { open: () => Promise<EyeDropperResult> }

function App() {
  const canvasEl = useRef<HTMLCanvasElement | null>(null)
  const canvasRef = useRef<Canvas | null>(null)
  const layerIdRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const displayScaleRef = useRef(1)
  const guidesRef = useRef<{ v: number[]; h: number[] }>({ v: [], h: [] })
  const lastChaosRef = useRef<ChaosRun | null>(null)
  const autosaveTimerRef = useRef<number | null>(null)
  const nudgeTimerRef = useRef<number | null>(null)
  const posterInitRef = useRef(true)
  const spaceDownRef = useRef(false)
  const panDragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const styleBaselineRef = useRef<Map<string, StyleBaseline>>(new Map())
  const showPrintGuidesRef = useRef(false)
  const showLayoutGridRef = useRef(false)
  const showBaselineGridRef = useRef(false)
  const showCmykPreviewRef = useRef(false)
  const gridOverlayRef = useRef<GridOverlay>({ columns: 4, rows: 8, margin: 48, gutter: 16, tension: 0 })
  const printDpiRef = useRef(300)
  const bleedMmRef = useRef(3)

  const [poster, setPoster] = useState<PosterPreset>(() => applyPosterPreset('a3'))
  const [presetId, setPresetId] = useState<PosterPresetId>('a3')
  const [customSize, setCustomSize] = useState({ width: 1200, height: 1600 })
  const [selected, setSelected] = useState<SelectedState | null>(null)
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([])
  const [layers, setLayers] = useState<SelectedState[]>([])
  const [savedProjects, setSavedProjects] = useState<StoredProject[]>([])
  const [projectName, setProjectName] = useState('Untitled poster')
  const [projectId, setProjectId] = useState<string>(() => newProjectId())
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png')
  const [exportScale, setExportScale] = useState(2)
  const [exportBackground, setExportBackground] = useState<ExportBackground>('paper')
  const [exportQuality, setExportQuality] = useState(92)
  const [typeIntensity, setTypeIntensity] = useState(60)
  const [typeLegibility, setTypeLegibility] = useState<ExpressiveLegibility>('medium')
  const [xeroxGeneration, setXeroxGeneration] = useState(5)
  const [accidentIntensity, setAccidentIntensity] = useState(60)
  const [decayAmount, setDecayAmount] = useState(55)
  const [status, setStatus] = useState('Ready')
  const [zoom, setZoom] = useState<number | null>(null)
  const [isPanMode, setIsPanMode] = useState(false)
  const [lastChaos, setLastChaos] = useState<{ label: string; seed: number } | null>(null)
  const [recentColors, setRecentColors] = useState<string[]>([])
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null)
  const [dragLayerId, setDragLayerId] = useState<string | null>(null)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('inspect')
  const [commandOpen, setCommandOpen] = useState(false)
  const [filterGalleryOpen, setFilterGalleryOpen] = useState(false)
  const [documentMeta, setDocumentMeta] = useState<DocumentMeta | null>(null)
  const [customFonts, setCustomFonts] = useState<string[]>([])
  const [storedAssets, setStoredAssets] = useState<StoredAsset[]>([])
  const [documentPalette, setDocumentPalette] = useState<string[]>(['#111111', '#e11d48', '#05b6d4', '#f6f1e6'])
  const [fontStretch, setFontStretch] = useState(100)
  const [gridOverlay, setGridOverlay] = useState<GridOverlay>({ columns: 4, rows: 8, margin: 48, gutter: 16, tension: 0 })
  const [showLayoutGrid, setShowLayoutGrid] = useState(false)
  const [showBaselineGrid, setShowBaselineGrid] = useState(false)
  const [showPrintGuides, setShowPrintGuides] = useState(false)
  const [showCmykPreview, setShowCmykPreview] = useState(false)
  const [showInstruments, setShowInstruments] = useState(false)
  const [penMode, setPenMode] = useState(false)
  const [pathEditMode, setPathEditMode] = useState(false)
  const [penStrokeWidth, setPenStrokeWidth] = useState(3)
  const [penStrokeColor, setPenStrokeColor] = useState('#111111')
  const [newArtboardPreset, setNewArtboardPreset] = useState<PosterPresetId>('instagram')
  const [pdfRegistrationMarks, setPdfRegistrationMarks] = useState(true)
  const [printDpi, setPrintDpi] = useState(300)
  const [bleedMm, setBleedMm] = useState(3)
  const [onboardingOpen, setOnboardingOpen] = useState(() => !localStorage.getItem(ONBOARDING_KEY))
  const [variantCompare, setVariantCompare] = useState<{
    variantId: string
    currentThumbnail: string
  } | null>(null)
  const fontInputRef = useRef<HTMLInputElement | null>(null)
  const commitHistoryRef = useRef<(message: string) => void>(() => {})
  const commitTreatmentHistoryRef = useRef<
    (objectId: string, label: string, before: string, after: string) => void
  >(() => {})
  const commitPosterTreatmentHistoryRef = useRef<
    (artboardId: string, label: string, before: string, after: string) => void
  >(() => {})
  const commitObjectPatchHistoryRef = useRef<
    (objectId: string, label: string, before: string, after: string) => void
  >(() => {})
  const commitLayerOrderHistoryRef = useRef<(label: string, before: string, after: string) => void>(() => {})
  const objectEditSessionRef = useRef<{ objectId: string; before: string } | null>(null)
  const nudgeSessionRef = useRef<{ objectId: string; before: string } | null>(null)
  const refreshTreatmentStackRef = useRef<(object?: FabricObject | null) => Promise<void>>(async () => {})
  const reconcileArtifactTreatmentsRef = useRef<() => Promise<void>>(async () => {})
  const refreshPosterTreatmentsRef = useRef<(treatmentsOverride?: Treatment[]) => Promise<void>>(async () => {})
  const pathEditDragRef = useRef<{ point: PathAnchorPoint; path: Path } | null>(null)
  const activeObjectRef = useRef<() => FabricObject | null>(() => null)
  const tagObjectRef = useRef<(object: FabricObject, kind: LayerKind, name: string) => void>(() => {})

  const {
    refreshTreatmentStack,
    reconcileArtifactTreatments,
    refreshPosterTreatments,
    rerollTreatment,
    reorderLayerTreatment,
    toggleTreatment,
    removeLayerTreatment,
    rerollPosterTreatment,
    togglePosterTreatment,
    removePosterTreatmentAction,
    reorderPosterTreatmentAction,
  } = useTreatments({
    canvasRef,
    documentMeta,
    setDocumentMeta,
    gridOverlay,
    poster,
    commitTreatmentHistoryRef,
    commitPosterTreatmentHistoryRef,
    activeObjectRef,
    tagObjectRef,
  })

  refreshTreatmentStackRef.current = refreshTreatmentStack
  reconcileArtifactTreatmentsRef.current = reconcileArtifactTreatments
  refreshPosterTreatmentsRef.current = refreshPosterTreatments

  const { commitHistory, undoAsync, redo, restoringRef, resetHistory } = useEditorHistory({
    canvasRef,
    setStatus,
    syncSelected: () => syncSelected(),
    syncLayers: () => syncLayers(),
    scheduleAutosave,
    captureStyleBaseline,
    commitHistoryRef,
    commitTreatmentHistoryRef,
    commitPosterTreatmentHistoryRef,
    commitObjectPatchHistoryRef,
    commitLayerOrderHistoryRef,
    onAfterRestore: async () => {
      await reconcileArtifactTreatmentsRef.current()
      await refreshPosterTreatmentsRef.current()
    },
    onTreatmentRestore: async (objectId, treatmentsJson) => {
      const object =
        canvasRef.current?.getObjects().find((item) => String(readObjectProp(item, 'id') ?? '') === objectId) ?? null
      if (!object) return
      writeTreatments(object, JSON.parse(treatmentsJson) as Treatment[])
      await refreshTreatmentStackRef.current(object)
    },
    onPosterTreatmentRestore: async (artboardId, treatmentsJson) => {
      const treatments = JSON.parse(treatmentsJson) as Treatment[]
      setDocumentMeta((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          artboards: prev.artboards.map((item) =>
            item.id === artboardId ? writePosterTreatments(item, treatments) : item,
          ),
        }
      })
      await refreshPosterTreatmentsRef.current(treatments)
    },
  })

  const penStrokeColorRef = useRef(penStrokeColor)
  const penStrokeWidthRef = useRef(penStrokeWidth)
  penStrokeColorRef.current = penStrokeColor
  penStrokeWidthRef.current = penStrokeWidth

  const { registerCanvasEvents } = useCanvasEvents({
    guidesRef,
    displayScaleRef,
    showLayoutGridRef,
    showBaselineGridRef,
    showPrintGuidesRef,
    gridOverlayRef,
    printDpiRef,
    bleedMmRef,
    penStrokeColorRef,
    penStrokeWidthRef,
    syncSelected,
    syncLayers,
    commitHistory,
    tagObject,
  })

  showPrintGuidesRef.current = showPrintGuides
  showLayoutGridRef.current = showLayoutGrid
  showBaselineGridRef.current = showBaselineGrid
  showCmykPreviewRef.current = showCmykPreview
  gridOverlayRef.current = gridOverlay
  printDpiRef.current = printDpi
  bleedMmRef.current = bleedMm

  const fitScale = useMemo(() => {
    return Math.min(1, 660 / poster.width, 780 / poster.height)
  }, [poster.height, poster.width])
  const displayScale = zoom ?? fitScale
  displayScaleRef.current = displayScale

  // Keep latest values reachable from stable event listeners.
  const liveRef = useRef({ poster, projectName, projectId, displayScale, fitScale, zoom })
  liveRef.current = { poster, projectName, projectId, displayScale, fitScale, zoom }

  useEffect(() => {
    if (!canvasEl.current) return

    const canvas = new Canvas(canvasEl.current, {
      width: poster.width,
      height: poster.height,
      backgroundColor: '#f6f1e6',
      preserveObjectStacking: true,
      selectionColor: 'rgba(24, 24, 27, 0.06)',
      selectionBorderColor: '#52525b',
      selectionLineWidth: 1,
    })

    canvasRef.current = canvas
    seedPoster(canvas, poster)
    registerCanvasEvents(canvas)
    setDocumentMeta(createDefaultDocument(poster, canvas.toObject(HISTORY_PROPS as unknown as string[])))
    commitHistory('Started a new poster')
    void initializeStorage()
    void refreshAssets()
    if (!localStorage.getItem(ONBOARDING_KEY)) setOnboardingOpen(true)

    return () => {
      canvas.dispose()
      canvasRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    canvasRef.current?.requestRenderAll()
  }, [showLayoutGrid, showBaselineGrid, showPrintGuides, gridOverlay, printDpi, bleedMm])

  useEffect(() => {
    void refreshPosterTreatments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentMeta?.activeArtboardId, poster.width, poster.height])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.isDrawingMode = penMode
    if (penMode) {
      const brush = new PencilBrush(canvas)
      brush.color = penStrokeColor
      brush.width = penStrokeWidth
      canvas.freeDrawingBrush = brush
      canvas.selection = false
      canvas.skipTargetFind = true
      canvas.discardActiveObject()
      canvas.requestRenderAll()
      syncSelected()
    } else if (!spaceDownRef.current) {
      canvas.selection = true
      canvas.skipTargetFind = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [penMode, penStrokeColor, penStrokeWidth])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !pathEditMode) {
      pathEditDragRef.current = null
      return
    }

    canvas.selection = false
    canvas.skipTargetFind = true

    const drawPathHandles = () => {
      const object = activeObject()
      if (!object || object.type !== 'path') return
      const path = object as Path
      const ctx = canvas.contextTop
      if (!ctx) return
      canvas.clearContext(ctx)
      ctx.save()
      for (const point of getPathAnchorPoints(path.path as Parameters<typeof getPathAnchorPoints>[0])) {
        const world = pathAnchorWorldPosition(path, point)
        ctx.beginPath()
        ctx.fillStyle = point.role === 'anchor' ? '#e11d48' : '#05b6d4'
        ctx.arc(world.x, world.y, point.role === 'anchor' ? 5 : 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1
        ctx.stroke()
      }
      ctx.restore()
    }

    const pointerToPathLocal = (path: Path, event: MouseEvent | TouchEvent) => {
      const pointer = canvas.getScenePoint(event)
      const local = util.transformPoint(new Point(pointer.x, pointer.y), util.invertTransform(path.calcTransformMatrix()))
      return {
        x: local.x + (path.pathOffset?.x ?? 0),
        y: local.y + (path.pathOffset?.y ?? 0),
      }
    }

    const onMouseDown = (event: { e: MouseEvent | TouchEvent }) => {
      const object = activeObject()
      if (!object || object.type !== 'path') return
      const path = object as Path
      const pointer = canvas.getScenePoint(event.e)
      const hit = pathPointNear(path, pointer.x, pointer.y, 10 / displayScaleRef.current)
      if (hit) pathEditDragRef.current = { point: hit, path }
    }

    const onMouseMove = (event: { e: MouseEvent | TouchEvent }) => {
      const drag = pathEditDragRef.current
      if (!drag) return
      const local = pointerToPathLocal(drag.path, event.e)
      const next = movePathPoint(
        drag.path.path as Parameters<typeof movePathPoint>[0],
        drag.point,
        local.x,
        local.y,
      )
      applyPathData(drag.path, next)
      drag.path.setCoords()
      canvas.requestRenderAll()
    }

    const onMouseUp = () => {
      if (!pathEditDragRef.current) return
      pathEditDragRef.current = null
      commitHistory('Edited path points')
    }

    canvas.on('after:render', drawPathHandles)
    canvas.on('mouse:down', onMouseDown)
    canvas.on('mouse:move', onMouseMove)
    canvas.on('mouse:up', onMouseUp)
    canvas.requestRenderAll()

    return () => {
      canvas.off('after:render', drawPathHandles)
      canvas.off('mouse:down', onMouseDown)
      canvas.off('mouse:move', onMouseMove)
      canvas.off('mouse:up', onMouseUp)
      if (!penMode && !spaceDownRef.current) {
        canvas.selection = true
        canvas.skipTargetFind = false
      }
      canvas.requestRenderAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathEditMode, selected?.id, penMode])

  useEffect(() => {
    // Fix: previously this also ran on mount, double-committing history.
    if (posterInitRef.current) {
      posterInitRef.current = false
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setDimensions({ width: poster.width, height: poster.height })
    canvas.backgroundColor = '#f6f1e6'
    canvas.requestRenderAll()
    commitHistory('Changed poster size')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poster])

  async function refreshAssets() {
    try {
      setStoredAssets(await listAssets())
    } catch {
      setStoredAssets([])
    }
  }

  async function initializeStorage() {
    try {
      const migrated = await migrateLegacyProjects()
      const projects = await listProjects()
      setSavedProjects(projects)
      if (migrated > 0) setStatus(`Migrated ${migrated} saved poster${migrated === 1 ? '' : 's'} to durable storage`)
      const autosaved = await loadAutosave()
      if (autosaved && window.confirm(`Restore autosaved session “${autosaved.name}”?`)) {
        await loadProject(autosaved, { keepId: false })
        setStatus('Restored autosaved session')
      }
    } catch {
      setStatus('Storage unavailable — saves are disabled in this browser context')
    }
  }

  // Keyboard layer: full shortcut coverage. Stable listener reads handlers via ref.
  const keyActionsRef = useRef<Record<string, () => void>>({})
  keyActionsRef.current = {
    undo: () => void undoAsync(),
    redo,
    save: () => void saveProjectAction(),
    export: exportPoster,
    duplicate: () => void duplicateSelected(),
    delete: deleteSelected,
    deselect: () => {
      canvasRef.current?.discardActiveObject()
      canvasRef.current?.requestRenderAll()
      syncSelected()
    },
    addText,
    addShape,
    zoomFit: () => setZoom(null),
    zoom100: () => setZoom(1),
    zoomIn: () => stepZoom(1),
    zoomOut: () => stepZoom(-1),
    reroll: () => void rerollLast(),
    commandPalette: () => setCommandOpen(true),
    forkVariant: () => void forkVariation(),
  }

  useEffect(() => {
    const isTypingContext = (target: EventTarget | null) => {
      const element = target as HTMLElement | null
      if (element?.closest?.('input, textarea, select, [contenteditable="true"]')) return true
      const active = canvasRef.current?.getActiveObject() as (FabricObject & { isEditing?: boolean }) | null
      return Boolean(active?.isEditing)
    }

    const nudgeSelection = (dx: number, dy: number) => {
      const canvas = canvasRef.current
      const object = canvas?.getActiveObject()
      if (!canvas || !object) return false
      const objectId = String(readObjectProp(object, 'id') ?? '')
      if (!nudgeSessionRef.current || nudgeSessionRef.current.objectId !== objectId) {
        nudgeSessionRef.current = { objectId, before: captureObjectPatch(object) }
      }
      object.set({ left: (object.left ?? 0) + dx, top: (object.top ?? 0) + dy })
      object.setCoords()
      canvas.requestRenderAll()
      syncSelected()
      if (nudgeTimerRef.current) window.clearTimeout(nudgeTimerRef.current)
      nudgeTimerRef.current = window.setTimeout(() => {
        const session = nudgeSessionRef.current
        nudgeSessionRef.current = null
        if (!session) return
        const after = captureObjectPatch(object)
        if (session.before === after) return
        commitObjectPatchHistoryRef.current(session.objectId, 'Nudged layer', session.before, after)
      }, 350)
      return true
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ' && !isTypingContext(event.target)) {
        if (!spaceDownRef.current) {
          spaceDownRef.current = true
          setIsPanMode(true)
          const canvas = canvasRef.current
          if (canvas) {
            canvas.selection = false
            canvas.skipTargetFind = true
          }
        }
        event.preventDefault()
        return
      }

      const actions = keyActionsRef.current
      const meta = event.metaKey || event.ctrlKey

      if (meta) {
        const key = event.key.toLowerCase()
        if (key === 'z') {
          event.preventDefault()
          if (event.shiftKey) actions.redo()
          else actions.undo()
        } else if (key === 'y') {
          event.preventDefault()
          actions.redo()
        } else if (key === 's') {
          event.preventDefault()
          actions.save()
        } else if (key === 'e') {
          event.preventDefault()
          actions.export()
        } else if (key === 'd' && !isTypingContext(event.target)) {
          event.preventDefault()
          actions.duplicate()
        } else if (key === '0') {
          event.preventDefault()
          actions.zoomFit()
        } else if (key === '1') {
          event.preventDefault()
          actions.zoom100()
        } else if (key === '=' || key === '+') {
          event.preventDefault()
          actions.zoomIn()
        } else if (key === '-') {
          event.preventDefault()
          actions.zoomOut()
        } else if (key === 'k') {
          event.preventDefault()
          actions.commandPalette()
        } else if (key === 'b') {
          event.preventDefault()
          actions.forkVariant()
        }
        return
      }

      if (isTypingContext(event.target)) return

      const canvasFocused = document.activeElement?.closest('.canvas-scroll') != null
      if (event.key === 'Tab' && canvasFocused) {
        event.preventDefault()
        cycleCanvasSelection(event.shiftKey)
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        actions.delete()
      } else if (event.key === 'Escape') {
        actions.deselect()
      } else if (event.key === 'ArrowLeft') {
        if (nudgeSelection(event.shiftKey ? -10 : -1, 0)) event.preventDefault()
      } else if (event.key === 'ArrowRight') {
        if (nudgeSelection(event.shiftKey ? 10 : 1, 0)) event.preventDefault()
      } else if (event.key === 'ArrowUp') {
        if (nudgeSelection(0, event.shiftKey ? -10 : -1)) event.preventDefault()
      } else if (event.key === 'ArrowDown') {
        if (nudgeSelection(0, event.shiftKey ? 10 : 1)) event.preventDefault()
      } else if (event.key.toLowerCase() === 't') {
        actions.addText()
      } else if (event.key.toLowerCase() === 'b') {
        actions.addShape()
      } else if (event.key.toLowerCase() === 'p') {
        setPenMode((value) => !value)
      } else if (event.key.toLowerCase() === 'r') {
        actions.reroll()
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        spaceDownRef.current = false
        panDragRef.current = null
        setIsPanMode(false)
        const canvas = canvasRef.current
        if (canvas) {
          canvas.selection = true
          canvas.skipTargetFind = false
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cmd/Ctrl + wheel zoom (needs a non-passive native listener).
  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    const onWheel = (event: WheelEvent) => {
      if (!event.metaKey && !event.ctrlKey) return
      event.preventDefault()
      const current = liveRef.current.zoom ?? liveRef.current.fitScale
      const next = clampZoom(current * Math.exp(-event.deltaY * 0.0015))
      setZoom(next)
    }
    scroller.addEventListener('wheel', onWheel, { passive: false })
    return () => scroller.removeEventListener('wheel', onWheel)
  }, [])

  function clampZoom(value: number) {
    return Math.min(8, Math.max(0.1, value))
  }

  function stepZoom(direction: 1 | -1) {
    const current = liveRef.current.zoom ?? liveRef.current.fitScale
    const next =
      direction === 1
        ? ZOOM_LEVELS.find((level) => level > current + 0.001)
        : [...ZOOM_LEVELS].reverse().find((level) => level < current - 0.001)
    setZoom(clampZoom(next ?? current))
  }

  function handlePanMouseDown(event: React.MouseEvent) {
    if (!spaceDownRef.current || !scrollRef.current) return
    event.preventDefault()
    panDragRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: scrollRef.current.scrollLeft,
      top: scrollRef.current.scrollTop,
    }
  }

  function handlePanMouseMove(event: React.MouseEvent) {
    const drag = panDragRef.current
    if (!drag || !scrollRef.current) return
    scrollRef.current.scrollLeft = drag.left - (event.clientX - drag.x)
    scrollRef.current.scrollTop = drag.top - (event.clientY - drag.y)
  }

  function handlePanMouseUp() {
    panDragRef.current = null
  }

  function nextId(kind: LayerKind) {
    layerIdRef.current += 1
    return `${kind}-${layerIdRef.current}`
  }

  function tagObject(object: FabricObject, kind: LayerKind, name: string) {
    object.set({
      id: nextId(kind),
      name,
      kind,
      cornerColor: '#52525b',
      cornerStrokeColor: '#ffffff',
      borderColor: '#52525b',
      transparentCorners: false,
      cornerStyle: 'rect',
    } as Partial<FabricObject>)
  }

  tagObjectRef.current = tagObject

  function seedPoster(canvas: Canvas, currentPoster: PosterPreset) {
    const headline = new Textbox('RAY GUN\nCUT TYPE', {
      left: currentPoster.width * 0.09,
      top: currentPoster.height * 0.11,
      width: currentPoster.width * 0.78,
      fontFamily: 'Impact',
      fontSize: Math.round(currentPoster.width * 0.13),
      fontWeight: 900,
      lineHeight: 0.78,
      charSpacing: -35,
      fill: '#161616',
      angle: -6,
    })
    tagObject(headline, 'text', 'Oversized headline')

    const bar = new Rect({
      left: currentPoster.width * 0.13,
      top: currentPoster.height * 0.48,
      width: currentPoster.width * 0.72,
      height: Math.max(18, currentPoster.height * 0.045),
      fill: '#e11d48',
      angle: 3,
      opacity: 0.92,
    })
    tagObject(bar, 'shape', 'Red interruption')

    const deck = new Textbox('manual fragments / image noise / broken grids', {
      left: currentPoster.width * 0.17,
      top: currentPoster.height * 0.57,
      width: currentPoster.width * 0.48,
      fontFamily: 'Courier New',
      fontSize: Math.round(currentPoster.width * 0.028),
      lineHeight: 1.1,
      charSpacing: 80,
      fill: '#27272a',
      angle: 8,
    })
    tagObject(deck, 'text', 'Small mono deck')

    const labelBand = new Rect({
      left: currentPoster.width * 0.07,
      top: currentPoster.height * 0.78,
      width: currentPoster.width * 0.78,
      height: Math.max(22, currentPoster.height * 0.025),
      fill: '#111111',
      angle: -1,
    })
    tagObject(labelBand, 'shape', 'Black label band')

    const label = new Textbox('CONNWAX MANIAC / LOW VELOCITY SOUNDSYSTEM / CONNWAX MANIAC', {
      left: currentPoster.width * 0.08,
      top: currentPoster.height * 0.785,
      width: currentPoster.width * 0.76,
      fontFamily: 'Arial Black',
      fontSize: Math.round(currentPoster.width * 0.018),
      fontWeight: 900,
      charSpacing: -25,
      fill: '#f8f6ef',
      angle: -1,
    })
    tagObject(label, 'text', 'Repeated label')

    const cyanScrap = new Rect({
      left: currentPoster.width * 0.58,
      top: currentPoster.height * 0.34,
      width: currentPoster.width * 0.16,
      height: currentPoster.height * 0.24,
      fill: ACCENTS[0],
      opacity: 0.42,
      angle: 4,
      globalCompositeOperation: 'multiply',
    })
    tagObject(cyanScrap, 'shape', 'Cyan scan scrap')

    const limeRule = new Rect({
      left: currentPoster.width * 0.06,
      top: currentPoster.height * 0.31,
      width: currentPoster.width * 0.74,
      height: 2,
      fill: ACCENTS[2],
      opacity: 0.65,
      angle: -11,
    })
    tagObject(limeRule, 'shape', 'Acid rule')

    const sideType = new Textbox('legibility\nis not\nneutral', {
      left: currentPoster.width * 0.79,
      top: currentPoster.height * 0.4,
      width: currentPoster.width * 0.16,
      fontFamily: 'Arial Black',
      fontSize: Math.round(currentPoster.width * 0.035),
      fontWeight: 900,
      lineHeight: 0.82,
      fill: '#111111',
      angle: 90,
    })
    tagObject(sideType, 'text', 'Rotated side type')

    canvas.add(headline, cyanScrap, bar, deck, limeRule, labelBand, label, sideType)
    canvas.setActiveObject(headline)
    captureStyleBaseline()
    syncSelected()
    syncLayers()
  }

  function activeObject() {
    return canvasRef.current?.getActiveObject() ?? null
  }

  activeObjectRef.current = activeObject

  function captureStyleBaseline() {
    const canvas = canvasRef.current
    if (!canvas) return
    const map = new Map<string, StyleBaseline>()
    canvas.getObjects().forEach((object) => {
      const id = String(readObjectProp(object, 'id') ?? '')
      if (!id) return
      map.set(id, {
        left: object.left ?? 0,
        top: object.top ?? 0,
        angle: object.angle ?? 0,
        opacity: object.opacity ?? 1,
        fill: readObjectProp(object, 'fill') as string | undefined,
        globalCompositeOperation: String(readObjectProp(object, 'globalCompositeOperation') ?? 'source-over'),
      })
    })
    styleBaselineRef.current = map
  }

  function scheduleAutosave() {
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = window.setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const { poster: currentPoster, projectName: currentName } = liveRef.current
      void saveAutosave({
        name: currentName.trim() || 'Untitled poster',
        savedAt: new Date().toISOString(),
        preset: currentPoster,
        canvas: canvas.toObject(HISTORY_PROPS as unknown as string[]),
        document: documentMeta ?? undefined,
      }).catch(() => setStatus('Autosave failed — storage may be full'))
    }, 2500)
  }

  function syncLayers() {
    const canvas = canvasRef.current
    if (!canvas) return
    setLayers(
      canvas
        .getObjects()
        .map((object) => ({
          ...toSelectedState(object),
          thumbnail: createLayerThumbnail(object, canvas),
        }))
        .reverse(),
    )
  }

  function syncSelected() {
    const canvas = canvasRef.current
    if (!canvas) {
      setSelected(null)
      setSelectedLayerIds([])
      return
    }
    const active = canvas.getActiveObject()
    if (!active) {
      setSelected(null)
      setSelectedLayerIds([])
      return
    }
    if (active.type === 'activeselection') {
      const objects = canvas.getActiveObjects()
      setSelectedLayerIds(objects.map((object) => String(readObjectProp(object, 'id') ?? '')))
      setSelected(objects[0] ? toSelectedState(objects[0]) : null)
      return
    }
    setSelected(toSelectedState(active))
    setSelectedLayerIds([String(readObjectProp(active, 'id') ?? '')])
  }

  function toSelectedState(object: FabricObject): SelectedState {
    return {
      id: String(readObjectProp(object, 'id') ?? ''),
      kind: (readObjectProp(object, 'kind') as LayerKind) ?? 'shape',
      name: String(readObjectProp(object, 'name') ?? object.type ?? 'Layer'),
      left: round(object.left ?? 0),
      top: round(object.top ?? 0),
      angle: round(object.angle ?? 0),
      opacity: round(object.opacity ?? 1),
      scaleX: round(object.scaleX ?? 1),
      scaleY: round(object.scaleY ?? 1),
      visible: object.visible !== false,
      locked: object.selectable === false,
      fontFamily: readObjectProp(object, 'fontFamily') as string | undefined,
      fontSize: readObjectProp(object, 'fontSize') as number | undefined,
      fontWeight: readObjectProp(object, 'fontWeight') as string | number | undefined,
      charSpacing: readObjectProp(object, 'charSpacing') as number | undefined,
      lineHeight: readObjectProp(object, 'lineHeight') as number | undefined,
      text: readObjectProp(object, 'text') as string | undefined,
      fill: readObjectProp(object, 'fill') as string | undefined,
      skewX: readObjectProp(object, 'skewX') as number | undefined,
      skewY: readObjectProp(object, 'skewY') as number | undefined,
      blendMode: String(readObjectProp(object, 'globalCompositeOperation') ?? 'source-over'),
      stroke: readObjectProp(object, 'stroke') as string | undefined,
      strokeWidth: readObjectProp(object, 'strokeWidth') as number | undefined,
    }
  }

  function beginObjectEditSession(object: FabricObject) {
    const objectId = String(readObjectProp(object, 'id') ?? '')
    if (objectEditSessionRef.current?.objectId === objectId) return
    objectEditSessionRef.current = { objectId, before: captureObjectPatch(object) }
  }

  function commitObjectEditSession(label: string) {
    const session = objectEditSessionRef.current
    const object = activeObject()
    if (!session || !object) {
      commitHistory(label)
      objectEditSessionRef.current = null
      return
    }
    const objectId = String(readObjectProp(object, 'id') ?? '')
    if (objectId !== session.objectId) {
      objectEditSessionRef.current = null
      commitHistory(label)
      return
    }
    const after = captureObjectPatch(object)
    objectEditSessionRef.current = null
    if (session.before === after) return
    commitObjectPatchHistoryRef.current(objectId, label, session.before, after)
  }

  function commitLayerOrderChange(label: string, before: string) {
    const canvas = canvasRef.current
    if (!canvas) return
    const after = captureLayerOrder(canvas)
    if (before === after) return
    commitLayerOrderHistoryRef.current(label, before, after)
  }

  function updateActive(values: Partial<SelectedState>) {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object) return
    beginObjectEditSession(object)
    const patch = { ...values } as Partial<FabricObject>
    if (values.blendMode !== undefined) {
      patch.globalCompositeOperation = values.blendMode as GlobalCompositeOperation
      delete (patch as Partial<SelectedState>).blendMode
    }
    object.set(patch)
    object.setCoords()
    canvas.requestRenderAll()
    syncSelected()
    syncLayers()
  }

  function finalizeActive(message: string) {
    activeObject()?.setCoords()
    canvasRef.current?.requestRenderAll()
    commitObjectEditSession(message)
  }

  function findObjectById(id: string) {
    return canvasRef.current?.getObjects().find((item) => readObjectProp(item, 'id') === id) ?? null
  }

  function trackChaos(label: string, seed: number, targetIds: string[], perform: (seed: number) => void | Promise<void>) {
    lastChaosRef.current = { label, seed, targetIds, perform }
    setLastChaos({ label, seed })
  }

  async function rerollLast() {
    const last = lastChaosRef.current
    const canvas = canvasRef.current
    if (!last || !canvas) return
    await undoAsync()
    if (last.targetIds.length > 0) {
      const objects = canvas
        .getObjects()
        .filter((object) => last.targetIds.includes(String(readObjectProp(object, 'id') ?? '')))
      if (objects.length === 0) {
        setStatus('Could not re-roll — the original layer is gone')
        return
      }
      if (objects.length === 1) canvas.setActiveObject(objects[0])
      else canvas.setActiveObject(new ActiveSelection(objects, { canvas }))
      canvas.requestRenderAll()
    }
    await last.perform(newSeed())
  }

  function selectedTargetIds() {
    const canvas = canvasRef.current
    const active = activeObject()
    if (!canvas || !active) return []
    const objects = active.type === 'activeselection' ? canvas.getActiveObjects() : [active]
    return objects.map((object) => String(readObjectProp(object, 'id') ?? ''))
  }

  function addText() {
    const canvas = canvasRef.current
    if (!canvas) return
    const text = new Textbox('NEW TYPE', {
      left: poster.width * 0.18,
      top: poster.height * 0.18,
      width: poster.width * 0.52,
      fontFamily: 'Impact',
      fontSize: Math.round(poster.width * 0.08),
      fontWeight: 900,
      lineHeight: 0.86,
      charSpacing: 20,
      fill: '#111111',
    })
    tagObject(text, 'text', 'Text layer')
    canvas.add(text)
    canvas.setActiveObject(text)
    commitHistory('Added text')
  }

  function addShape() {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = new Rect({
      left: poster.width * 0.2,
      top: poster.height * 0.42,
      width: poster.width * 0.42,
      height: poster.height * 0.08,
      fill: '#111111',
      opacity: 0.9,
      angle: -4,
    })
    tagObject(rect, 'shape', 'Block')
    canvas.add(rect)
    canvas.setActiveObject(rect)
    commitHistory('Added block')
  }

  function addEllipse() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ellipse = new Ellipse({
      left: poster.width * 0.28,
      top: poster.height * 0.35,
      rx: poster.width * 0.12,
      ry: poster.height * 0.08,
      fill: '#111111',
      opacity: 0.88,
      angle: -6,
    })
    tagObject(ellipse, 'shape', 'Ellipse')
    canvas.add(ellipse)
    canvas.setActiveObject(ellipse)
    commitHistory('Added ellipse')
  }

  function addLine() {
    const canvas = canvasRef.current
    if (!canvas) return
    const line = new Line([poster.width * 0.1, poster.height * 0.55, poster.width * 0.78, poster.height * 0.52], {
      stroke: '#111111',
      strokeWidth: 3,
      opacity: 0.9,
    })
    tagObject(line, 'shape', 'Line')
    canvas.add(line)
    canvas.setActiveObject(line)
    commitHistory('Added line')
  }

  function addStarShape() {
    const canvas = canvasRef.current
    if (!canvas) return
    const points = buildStarPoints(5, 80, 36)
    const star = new Polygon(points, {
      left: poster.width * 0.62,
      top: poster.height * 0.28,
      fill: '#e11d48',
      opacity: 0.9,
      angle: 12,
    })
    tagObject(star, 'shape', 'Star')
    canvas.add(star)
    canvas.setActiveObject(star)
    commitHistory('Added star')
  }

  function alignSelection(mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') {
    const canvas = canvasRef.current
    const active = activeObject()
    if (!canvas || !active) return
    const objects = active.type === 'activeselection' ? canvas.getActiveObjects() : [active]
    alignObjects(objects, mode)
    canvas.requestRenderAll()
    commitHistory(`Aligned ${mode}`)
  }

  function distributeSelection(axis: 'horizontal' | 'vertical') {
    const canvas = canvasRef.current
    const active = activeObject()
    if (!canvas || !active) return
    const objects = active.type === 'activeselection' ? canvas.getActiveObjects() : [active]
    distributeObjects(objects, axis)
    canvas.requestRenderAll()
    commitHistory(`Distributed ${axis}`)
  }

  async function clipSelectionToShape() {
    const canvas = canvasRef.current
    const active = activeObject()
    if (!canvas || !active) return
    const objects = canvas.getActiveObjects()
    if (objects.length < 2) {
      setStatus('Select a content layer and a shape mask (Shift+click)')
      return
    }
    const mask = objects.find((item) => item.type === 'rect' || item.type === 'ellipse' || item.type === 'polygon')
    const content = objects.find((item) => item !== mask)
    if (!mask || !content) return
    const clip = await mask.clone()
    clip.set({ absolutePositioned: true, inverted: false })
    content.set({ clipPath: clip })
    canvas.requestRenderAll()
    commitHistory('Applied clipping mask')
  }

  async function saveSelectionAsComponent() {
    const canvas = canvasRef.current
    const active = activeObject()
    if (!canvas || !active) return
    const name = window.prompt('Component name', selected?.name ?? 'Component')
    if (!name) return
    const clone = await active.clone()
    const snapshot = clone.toObject(HISTORY_PROPS as unknown as string[]) as Record<string, unknown>
    setDocumentMeta((current) => {
      const base = current ?? createDefaultDocument(poster, {})
      return {
        ...base,
        components: [
          { id: `component-${Date.now()}`, name, canvas: snapshot },
          ...base.components,
        ].slice(0, 16),
      }
    })
    commitHistory(`Saved component “${name}”`)
  }

  async function insertComponent(componentId: string) {
    const canvas = canvasRef.current
    const component = documentMeta?.components.find((item) => item.id === componentId)
    if (!canvas || !component) return
    const object = (await FabricObject.fromObject(component.canvas as object)) as FabricObject
    object.set({ left: poster.width * 0.2, top: poster.height * 0.2 })
    tagObject(object, (readObjectProp(object, 'kind') as LayerKind) ?? 'shape', component.name)
    canvas.add(object as FabricObject)
    canvas.setActiveObject(object as FabricObject)
    canvas.requestRenderAll()
    commitHistory(`Inserted component “${component.name}”`)
  }

  async function forkVariation() {
    const canvas = canvasRef.current
    if (!canvas || !documentMeta) return
    const name = `Variant ${documentMeta.variants.length + 1}`
    const snapshot = canvas.toObject(HISTORY_PROPS as unknown as string[])
    const preview = canvas.toDataURL({ format: 'jpeg', quality: 0.75, multiplier: 0.12 })
    const thumbnail = await createThumbnail(preview, 120)
    setDocumentMeta(forkVariant(documentMeta, snapshot, name, thumbnail))
    setInspectorTab('layout')
    setStatus(`Forked ${name} — click Restore in Layout to switch`)
    commitHistory(`Forked ${name}`)
  }

  async function restoreVariant(variantId: string) {
    const canvas = canvasRef.current
    if (!canvas || !documentMeta) return
    const variant = findVariant(documentMeta, variantId)
    if (!variant) return

    restoringRef.current = true
    await canvas.loadFromJSON(variant.canvas)
    restoringRef.current = false
    await reconcileArtifactTreatments()
    await refreshPosterTreatments()
    canvas.requestRenderAll()
    captureStyleBaseline()
    syncSelected()
    syncLayers()
    setVariantCompare(null)
    setStatus(`Restored ${variant.name}`)
    commitHistory(`Restored ${variant.name}`)
  }

  async function openVariantCompare(variantId: string) {
    const canvas = canvasRef.current
    if (!canvas || !documentMeta) return
    const variant = findVariant(documentMeta, variantId)
    if (!variant) return
    const preview = canvas.toDataURL({ format: 'jpeg', quality: 0.75, multiplier: 0.12 })
    const currentThumbnail = await createThumbnail(preview, 160)
    setVariantCompare({ variantId, currentThumbnail })
  }

  const comparingVariant =
    variantCompare && documentMeta ? findVariant(documentMeta, variantCompare.variantId) ?? null : null

  async function switchToArtboard(artboardId: string) {
    const canvas = canvasRef.current
    if (!canvas || !documentMeta) return
    const current = getActiveArtboard(documentMeta)
    if (!current) return
    const snapshot = canvas.toObject(HISTORY_PROPS as unknown as string[])
    const boards = documentMeta.artboards.map((board) =>
      board.id === current.id ? { ...board, canvas: snapshot, preset: poster } : board,
    )
    const next = switchArtboard({ ...documentMeta, artboards: boards }, artboardId)
    const target = getActiveArtboard(next)
    if (!target) return
    restoringRef.current = true
    await canvas.loadFromJSON(target.canvas)
    restoringRef.current = false
    await reconcileArtifactTreatments()
    setPoster(target.preset)
    setPresetId(target.preset.id)
    setDocumentMeta(next)
    await refreshPosterTreatments()
    canvas.requestRenderAll()
    captureStyleBaseline()
    syncSelected()
    syncLayers()
    setStatus(`Switched to ${target.name}`)
  }

  function addNewArtboard() {
    if (!documentMeta) return
    const next = addArtboard(documentMeta, newArtboardPreset)
    setDocumentMeta(next)
    const board = getActiveArtboard(next)
    if (board) void switchToArtboard(board.id)
  }

  function changeArtboardPreset(artboardId: string, presetId: string) {
    const canvas = canvasRef.current
    if (!documentMeta || !canvas) return
    const preset = applyPosterPreset(presetId as PosterPresetId)
    const next = updateArtboardPreset(documentMeta, artboardId, preset)
    const target = next.artboards.find((board) => board.id === artboardId)
    if (!target) return
    if (artboardId === documentMeta.activeArtboardId) {
      setPoster(target.preset)
      setPresetId(target.preset.id)
      canvas.setDimensions({ width: target.preset.width, height: target.preset.height })
      void refreshPosterTreatments()
      canvas.requestRenderAll()
    }
    setDocumentMeta(next)
    commitHistory(`Changed artboard preset to ${target.name}`)
  }

  async function persistAssetFromFile(file: File) {
    const dataUrl = await readFileAsDataUrl(file)
    const thumbnail = await createThumbnail(dataUrl)
    const asset: StoredAsset = {
      id: newAssetId(),
      name: file.name,
      mimeType: file.type,
      dataUrl,
      thumbnail,
      savedAt: new Date().toISOString(),
    }
    await saveAsset(asset)
    await refreshAssets()
  }

  async function insertAsset(asset: StoredAsset) {
    const canvas = canvasRef.current
    if (!canvas) return
    const image = await FabricImage.fromURL(asset.dataUrl, { crossOrigin: 'anonymous' })
    image.scaleToWidth(Math.min(poster.width * 0.5, image.width ?? 400))
    image.set({ left: poster.width * 0.15, top: poster.height * 0.18, angle: -2 })
    tagObject(image, 'image', asset.name)
    canvas.add(image)
    canvas.setActiveObject(image)
    commitHistory(`Inserted asset “${asset.name}”`)
  }

  function applyGradientFill(kind: 'linear' | 'radial' = 'linear') {
    const object = activeObject()
    if (!object || selectedIsImage) return
    const gradient = new Gradient({
      type: kind,
      coords:
        kind === 'radial'
          ? { x1: 50, y1: 50, x2: 50, y2: 50, r1: 0, r2: 80 }
          : { x1: 0, y1: 0, x2: 100, y2: 0 },
      colorStops: [
        { offset: 0, color: documentPalette[0] ?? '#111111' },
        { offset: 1, color: documentPalette[1] ?? '#e11d48' },
      ],
    })
    object.set({ fill: gradient })
    canvasRef.current?.requestRenderAll()
    finalizeActive(kind === 'radial' ? 'Applied radial gradient' : 'Applied gradient fill')
  }

  function applyTextOnPath() {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object || object.type !== 'textbox') return
    const text = String(readObjectProp(object, 'text') ?? 'TYPE')
    const path = new Line(
      [object.left ?? 0, (object.top ?? 0) + 40, (object.left ?? 0) + 280, (object.top ?? 0) + 8],
      { stroke: 'transparent', strokeWidth: 0, fill: 'transparent' },
    )
    const curved = new Textbox(text, {
      left: object.left ?? 0,
      top: object.top ?? 0,
      width: 320,
      fontFamily: String(readObjectProp(object, 'fontFamily') ?? 'Impact'),
      fontSize: Number(readObjectProp(object, 'fontSize') ?? 48),
      fill: String(readObjectProp(object, 'fill') ?? '#111111'),
      path,
    } as Partial<FabricObject>)
    tagObject(curved, 'text', 'Text on path')
    canvas.remove(object)
    canvas.add(curved)
    canvas.setActiveObject(curved)
    commitHistory('Applied text on path')
  }

  function applyStrokeDash(preset: StrokeDashPreset) {
    const object = activeObject()
    if (!object || object.type === 'textbox') return
    const dash =
      preset === 'dashed' ? [12, 6] : preset === 'dotted' ? [2, 4] : undefined
    object.set({
      stroke: String(readObjectProp(object, 'stroke') ?? '#111111'),
      strokeWidth: Number(readObjectProp(object, 'strokeWidth') ?? 2),
      strokeDashArray: dash,
    } as Partial<FabricObject>)
    canvasRef.current?.requestRenderAll()
    finalizeActive(`Stroke ${preset}`)
  }

  async function paintBrushMask() {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object) return
    const bounds = object.getBoundingRect()
    const mask = new Ellipse({
      left: bounds.left + bounds.width * 0.35,
      top: bounds.top + bounds.height * 0.25,
      rx: bounds.width * 0.18,
      ry: bounds.height * 0.22,
      absolutePositioned: true,
      inverted: true,
    })
    object.set({ clipPath: mask, objectCaching: true } as Partial<FabricObject>)
    canvas.requestRenderAll()
    commitHistory('Painted soft brush mask')
  }

  function updatePaletteSwatch(index: number, color: string) {
    setDocumentPalette((current) => {
      const next = [...current]
      next[index] = color
      if (documentMeta) {
        setDocumentMeta({ ...documentMeta, palette: next })
      }
      return next
    })
  }

  async function saveTreatmentStackAsComponent() {
    const object = activeObject()
    if (!object || readTreatments(object).length === 0) return
    const name = window.prompt('Treatment stack name', `${selected?.name ?? 'Layer'} stack`)
    if (!name) return
    const clone = await object.clone()
    const snapshot = clone.toObject(HISTORY_PROPS as unknown as string[]) as Record<string, unknown>
    setDocumentMeta((current) => {
      const base = current ?? createDefaultDocument(poster, {})
      return {
        ...base,
        components: [{ id: `component-${Date.now()}`, name, canvas: snapshot }, ...base.components],
      }
    })
    commitHistory(`Saved treatment stack “${name}”`)
  }

  async function mergeVariant(variantId: string) {
    const canvas = canvasRef.current
    if (!canvas || !documentMeta) return
    const variant = findVariant(documentMeta, variantId)
    if (!variant) return
    const current = canvas.toObject(HISTORY_PROPS as unknown as string[])
    const merged = mergeVariantCanvas(current, variant.canvas)
    restoringRef.current = true
    await canvas.loadFromJSON(merged)
    restoringRef.current = false
    await reconcileArtifactTreatments()
    await refreshPosterTreatments()
    canvas.requestRenderAll()
    captureStyleBaseline()
    syncSelected()
    syncLayers()
    commitHistory(`Merged ${variant.name}`)
  }

  function renameVariantById(variantId: string) {
    if (!documentMeta) return
    const variant = findVariant(documentMeta, variantId)
    if (!variant) return
    const name = window.prompt('Variant name', variant.name)
    if (!name?.trim()) return
    setDocumentMeta(renameVariant(documentMeta, variantId, name.trim()))
    setStatus(`Renamed variant to ${name.trim()}`)
  }

  function completeOnboarding() {
    localStorage.setItem(ONBOARDING_KEY, 'done')
    setOnboardingOpen(false)
    setStatus('Try Scatter, then Xerox — press R to re-roll')
  }

  async function duplicateSelected() {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object) return
    const clone = await object.clone()
    clone.set({
      left: (object.left ?? 0) + 28,
      top: (object.top ?? 0) + 28,
    })
    tagObject(clone, (readObjectProp(object, 'kind') as LayerKind) ?? 'shape', `${readObjectProp(object, 'name') ?? 'Layer'} copy`)
    canvas.add(clone)
    canvas.setActiveObject(clone)
    commitHistory('Duplicated layer')
  }

  function deleteSelected() {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object) return
    const objects = object.type === 'activeselection' ? canvas.getActiveObjects() : [object]
    objects.forEach((item) => canvas.remove(item))
    canvas.discardActiveObject()
    commitHistory(objects.length > 1 ? `Deleted ${objects.length} layers` : 'Deleted layer')
  }

  function moveLayer(direction: 'front' | 'back') {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object) return
    const before = captureLayerOrder(canvas)
    if (direction === 'front') canvas.bringObjectToFront(object)
    else canvas.sendObjectToBack(object)
    commitLayerOrderChange(
      direction === 'front' ? 'Moved layer to front' : 'Moved layer to back',
      before,
    )
  }

  function getSelectableLayerObjects(): FabricObject[] {
    const canvas = canvasRef.current
    if (!canvas) return []
    return canvas
      .getObjects()
      .filter((object) => {
        if (object.visible === false || object.selectable === false || object.evented === false) return false
        if (readObjectProp(object, 'scrapeFragment')) return false
        return true
      })
      .reverse()
  }

  function cycleCanvasSelection(reverse = false) {
    const canvas = canvasRef.current
    if (!canvas) return
    const objects = getSelectableLayerObjects()
    if (objects.length === 0) return

    const active = canvas.getActiveObject()
    let currentIndex = -1
    if (active?.type === 'activeselection') {
      const ids = new Set(canvas.getActiveObjects().map((object) => String(readObjectProp(object, 'id') ?? '')))
      currentIndex = objects.findIndex((object) => ids.has(String(readObjectProp(object, 'id') ?? '')))
    } else if (active) {
      currentIndex = objects.findIndex((object) => readObjectProp(object, 'id') === readObjectProp(active, 'id'))
    }

    const nextIndex =
      currentIndex < 0 ? 0 : reverse ? (currentIndex - 1 + objects.length) % objects.length : (currentIndex + 1) % objects.length
    const next = objects[nextIndex]
    if (!next) return
    canvas.setActiveObject(next)
    canvas.requestRenderAll()
    syncSelected()
    setStatus(`Selected ${String(readObjectProp(next, 'name') ?? 'layer')}`)
  }

  function zoomToLayer(id: string) {
    const canvas = canvasRef.current
    const object = findObjectById(id)
    const scroller = scrollRef.current
    if (!canvas || !object || !scroller) return

    selectLayer(id)
    object.setCoords()
    const bounds = object.getBoundingRect()
    const padding = 48
    const viewW = Math.max(160, scroller.clientWidth - padding * 2)
    const viewH = Math.max(160, scroller.clientHeight - padding * 2)
    const nextScale = clampZoom(Math.min(viewW / Math.max(bounds.width, 1), viewH / Math.max(bounds.height, 1), 4))
    setZoom(nextScale)

    window.requestAnimationFrame(() => {
      const centerX = (bounds.left + bounds.width / 2) * nextScale
      const centerY = (bounds.top + bounds.height / 2) * nextScale
      scroller.scrollLeft = Math.max(0, centerX - scroller.clientWidth / 2)
      scroller.scrollTop = Math.max(0, centerY - scroller.clientHeight / 2)
    })
    setStatus(`Zoomed to ${String(readObjectProp(object, 'name') ?? 'layer')}`)
  }

  function selectLayer(id: string, additive = false) {
    const canvas = canvasRef.current
    const object = findObjectById(id)
    if (!canvas || !object) return
    if (additive) {
      const current = canvas.getActiveObjects()
      const alreadySelected = current.some((item) => readObjectProp(item, 'id') === id)
      const next = alreadySelected
        ? current.filter((item) => readObjectProp(item, 'id') !== id)
        : [...current, object]
      if (next.length === 0) {
        canvas.discardActiveObject()
      } else if (next.length === 1) {
        canvas.setActiveObject(next[0]!)
      } else {
        canvas.setActiveObject(new ActiveSelection(next, { canvas }))
      }
    } else {
      canvas.setActiveObject(object)
    }
    canvas.requestRenderAll()
    syncSelected()
  }

  function togglePathEditMode() {
    setPathEditMode((current) => {
      const next = !current
      if (next) setPenMode(false)
      return next
    })
  }

  function toggleLayerVisibility(id: string) {
    const object = findObjectById(id)
    if (!object) return
    const before = captureObjectPatch(object)
    object.set({ visible: object.visible === false })
    canvasRef.current?.requestRenderAll()
    const message = object.visible === false ? 'Hid layer' : 'Showed layer'
    commitObjectPatchHistoryRef.current(id, message, before, captureObjectPatch(object))
  }

  function toggleLayerLock(id: string) {
    const canvas = canvasRef.current
    const object = findObjectById(id)
    if (!canvas || !object) return
    const before = captureObjectPatch(object)
    const locking = object.selectable !== false
    object.set({ selectable: !locking, evented: !locking })
    if (locking && canvas.getActiveObject() === object) {
      canvas.discardActiveObject()
    }
    canvas.requestRenderAll()
    commitObjectPatchHistoryRef.current(
      id,
      locking ? 'Locked layer' : 'Unlocked layer',
      before,
      captureObjectPatch(object),
    )
  }

  function renameLayer(id: string, name: string) {
    const object = findObjectById(id)
    if (!object) return
    const before = captureObjectPatch(object)
    object.set({ name } as Partial<FabricObject>)
    commitObjectPatchHistoryRef.current(id, 'Renamed layer', before, captureObjectPatch(object))
  }

  function reorderLayer(draggedId: string, targetId: string) {
    const canvas = canvasRef.current
    const dragged = findObjectById(draggedId)
    const target = findObjectById(targetId)
    if (!canvas || !dragged || !target || dragged === target) return
    const before = captureLayerOrder(canvas)
    const targetIndex = canvas.getObjects().indexOf(target)
    canvas.moveObjectTo(dragged, targetIndex)
    canvas.requestRenderAll()
    commitLayerOrderChange('Reordered layers', before)
  }

  function handlePresetChange(nextPresetId: PosterPresetId) {
    setPresetId(nextPresetId)
    setPoster(applyPosterPreset(nextPresetId, customSize))
  }

  function applyCustomSize(nextSize = customSize) {
    setCustomSize(nextSize)
    if (presetId === 'custom') setPoster(applyPosterPreset('custom', nextSize))
  }

  async function handleImageFile(file: File) {
    const canvas = canvasRef.current
    if (!canvas) return
    const url = await readFileAsDataUrl(file)
    const image = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
    const maxWidth = poster.width * 0.72
    const maxHeight = poster.height * 0.6
    image.scaleToWidth(Math.min(maxWidth, image.width ?? maxWidth))
    if (image.getScaledHeight() > maxHeight) image.scaleToHeight(maxHeight)
    image.set({
      left: poster.width * 0.12,
      top: poster.height * 0.2,
      angle: -2,
      opacity: 0.96,
    })
    tagObject(image, 'image', file.name)
    canvas.add(image)
    canvas.setActiveObject(image)
    await persistAssetFromFile(file)
    commitHistory('Imported image')
  }

  function applyImageEffect(effect: 'grayscale' | 'contrast' | 'threshold' | 'blur' | 'noise' | 'clear') {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object || object.type !== 'image') return
    const image = object as FabricImage

    if (effect === 'clear') {
      image.filters = []
      image.applyFilters()
      canvas.requestRenderAll()
      commitHistory('Cleared image effects')
      return
    }

    // Fix: effects now stack (toggle on/off) instead of silently replacing each other.
    const factories: Record<string, { type: string; create: () => filters.BaseFilter<string, Record<string, unknown>> }> = {
      grayscale: { type: 'Grayscale', create: () => new filters.Grayscale() },
      contrast: { type: 'Contrast', create: () => new filters.Contrast({ contrast: 0.38 }) },
      threshold: { type: 'BlackWhite', create: () => new filters.BlackWhite() },
      blur: { type: 'Blur', create: () => new filters.Blur({ blur: 0.18 }) },
      noise: { type: 'Noise', create: () => new filters.Noise({ noise: 120 }) },
    }
    const factory = factories[effect]
    const existing = image.filters ?? []
    const already = existing.some((item) => item?.type === factory.type)
    image.filters = already
      ? existing.filter((item) => item?.type !== factory.type)
      : [...existing, factory.create()]
    image.applyFilters()
    canvas.requestRenderAll()
    commitHistory(already ? `Removed ${effect} effect` : `Added ${effect} effect`)
  }

  function applyTreatmentToSelection(
    type: Treatment['type'],
    params: Record<string, number>,
    label: string,
    seed = newSeed(),
  ) {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object || object.type === 'activeselection') return
    const targetIds = selectedTargetIds()
    captureTransformBaseline(object)
    addTreatment(object, type, params, seed)
    object.set({ objectCaching: true } as Partial<FabricObject>)
    void refreshTreatmentStack(object).then(() => {
      trackChaos(label, seed, targetIds, (next) => applyTreatmentToSelection(type, params, label, next))
      commitHistory(`Applied ${label} #${seed}`)
    })
  }

  async function applyLayerDecayToSelected(seed = newSeed()) {
    applyTreatmentToSelection('decay', { amount: decayAmount }, 'layer decay', seed)
  }

  function addLayerDecayMarks(kind: 'ink-loss' | 'fold' | 'all', seed = newSeed()) {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object) return
    const targetIds = selectedTargetIds()
    const bounds = object.getBoundingRect()
    const marks = createLayerDecayMarks(
      {
        id: String(readObjectProp(object, 'id') ?? 'layer'),
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      },
      { amount: decayAmount, random: createSeededRandom(seed) },
    ).filter((mark) => kind === 'all' || mark.kind === kind)

    marks.forEach((mark) => {
      const decayMark = new Rect({
        left: mark.left,
        top: mark.top,
        width: mark.width,
        height: mark.height,
        fill: mark.kind === 'ink-loss' ? '#f8f6ef' : '#111111',
        opacity: mark.opacity,
        angle: mark.angle,
        globalCompositeOperation: mark.kind === 'ink-loss' ? 'source-over' : 'multiply',
      })
      tagObject(decayMark, 'shape', mark.kind === 'ink-loss' ? 'Ink loss' : 'Fold mark')
      canvas.add(decayMark)
    })

    trackChaos(`Decay marks (${kind})`, seed, targetIds, (next) => addLayerDecayMarks(kind, next))
    commitHistory(`Added ${kind === 'all' ? 'layer decay' : kind} marks #${seed}`)
  }

  async function addLayerDecayOffset() {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object) return
    const profile = getLayerDecayProfile(decayAmount)
    const clone = await object.clone()
    clone.set({
      left: (object.left ?? 0) + profile.misregistration,
      top: (object.top ?? 0) - profile.misregistration * 0.55,
      angle: (object.angle ?? 0) - profile.misregistration * 0.2,
      opacity: 0.14 + profile.amount * 0.002,
      globalCompositeOperation: 'multiply',
    })
    tagObject(clone, (readObjectProp(object, 'kind') as LayerKind) ?? 'shape', 'Decay offset')
    canvas.add(clone)
    canvas.sendObjectToBack(clone)
    canvas.setActiveObject(object)
    commitHistory('Added layer decay offset')
  }

  function applyFilterFromGallery(preset: FilterPreset, params: Record<string, number>) {
    applyTreatmentToSelection(preset.treatmentType, paramsForTreatment(preset, params), preset.name)
  }

  function openFilterGallery() {
    setFilterGalleryOpen(true)
  }

  function applyColdWashImage() {
    const object = activeObject()
    if (!object || object.type !== 'image') return
    applyTreatmentToSelection('cold-wash', {}, 'cold wash')
  }

  async function applyXeroxToSelected(seed = newSeed()) {
    applyTreatmentToSelection('xerox', { generation: xeroxGeneration }, 'xerox copy', seed)
  }

  async function addMisprintDuplicate() {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object) return
    const profile = getPrintScanProfile(xeroxGeneration)
    const clone = await object.clone()
    clone.set({
      left: (object.left ?? 0) + profile.misregistration,
      top: (object.top ?? 0) - profile.misregistration * 0.45,
      opacity: 0.18 + profile.generation * 0.018,
      angle: (object.angle ?? 0) - profile.misregistration * 0.18,
      globalCompositeOperation: 'multiply',
    })
    tagObject(clone, (readObjectProp(object, 'kind') as LayerKind) ?? 'image', 'Misprint offset')
    canvas.add(clone)
    canvas.sendObjectToBack(clone)
    canvas.setActiveObject(object)
    commitHistory('Added misprint offset')
  }

  function accidentTargets() {
    const canvas = canvasRef.current
    const active = activeObject()
    if (!canvas || !active) return null
    return active.type === 'activeselection' ? canvas.getActiveObjects() : [active]
  }

  function accidentTransforms(targets: FabricObject[], random: () => number) {
    return createAccidentTransforms(
      targets.map((object) => ({
        id: String(readObjectProp(object, 'id') ?? ''),
        left: object.left ?? 0,
        top: object.top ?? 0,
        angle: object.angle ?? 0,
        scaleX: object.scaleX ?? 1,
        scaleY: object.scaleY ?? 1,
      })),
      { intensity: accidentIntensity, random },
    )
  }

  async function duplicateDriftAccident(seed = newSeed()) {
    const canvas = canvasRef.current
    const targets = accidentTargets()
    if (!canvas || !targets) return
    const targetIds = selectedTargetIds()
    const transforms = accidentTransforms(targets, createSeededRandom(seed))

    for (const [index, object] of targets.entries()) {
      const clone = await object.clone()
      clone.set({
        ...transforms[index],
        globalCompositeOperation: 'multiply',
      })
      tagObject(clone, (readObjectProp(object, 'kind') as LayerKind) ?? 'shape', 'Accident duplicate')
      canvas.add(clone)
    }
    canvas.requestRenderAll()
    trackChaos('Duplicate drift', seed, targetIds, (next) => duplicateDriftAccident(next))
    commitHistory(`Added duplicate drift accident #${seed}`)
  }

  function nudgeLayoutAccident(seed = newSeed()) {
    const canvas = canvasRef.current
    if (!canvas) return
    const targets = canvas.getObjects()
    const transforms = accidentTransforms(targets, createSeededRandom(seed))

    targets.forEach((object, index) => {
      object.set(transforms[index])
      object.setCoords()
    })
    canvas.requestRenderAll()
    trackChaos('Nudge layout', seed, [], (next) => nudgeLayoutAccident(next))
    commitHistory(`Nudged layout accident #${seed}`)
  }

  async function badCropAccident(seed = newSeed()) {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object || object.type === 'activeselection') return
    const targetIds = selectedTargetIds()
    const bounds = object.getBoundingRect()
    const cropDirection = bounds.width > bounds.height ? 'vertical' : 'horizontal'

    captureTransformBaseline(object)
    addTreatment(
      object,
      'bad-crop',
      {
        direction: badCropDirectionToParam(cropDirection),
        gap: Math.max(16, accidentIntensity * 0.4),
        drift: accidentIntensity,
      },
      seed,
    )
    object.set({ objectCaching: true } as Partial<FabricObject>)
    await refreshTreatmentStack(object)
    setInspectorTab('treatments')
    trackChaos('Bad crop', seed, targetIds, (next) => badCropAccident(next))
    commitHistory(`Applied bad crop accident #${seed}`)
  }

  async function flipMistakeAccident() {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object) return
    const clone = await object.clone()
    clone.set({
      left: (object.left ?? 0) + accidentIntensity * 0.24,
      top: (object.top ?? 0) + accidentIntensity * 0.12,
      scaleX: -(object.scaleX ?? 1),
      opacity: 0.24,
      angle: (object.angle ?? 0) + accidentIntensity * 0.08,
      globalCompositeOperation: 'difference',
    })
    tagObject(clone, (readObjectProp(object, 'kind') as LayerKind) ?? 'shape', 'Flipped mistake')
    canvas.add(clone)
    canvas.setActiveObject(object)
    commitHistory('Added flipped mistake')
  }

  function collideSelectionAccident() {
    const canvas = canvasRef.current
    const targets = accidentTargets()
    if (!canvas || !targets || targets.length < 2) return
    const lead = targets[0]
    const leadLeft = lead.left ?? 0
    const leadTop = lead.top ?? 0

    targets.slice(1).forEach((object, index) => {
      object.set({
        left: leadLeft + (index + 1) * 10,
        top: leadTop + (index + 1) * 8,
        angle: (object.angle ?? 0) + (index % 2 === 0 ? -12 : 12),
        globalCompositeOperation: index % 2 === 0 ? 'difference' : 'multiply',
      })
      object.setCoords()
    })
    canvas.requestRenderAll()
    commitHistory('Collided selected layers')
  }

  async function scatterSelected(seed = newSeed()) {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object || object.type === 'activeselection') return
    const targetIds = selectedTargetIds()
    captureTransformBaseline(object)
    addTreatment(object, 'scatter', { distance: 46, rotation: 18, scale: 0.14 }, seed)
    object.set({ objectCaching: true } as Partial<FabricObject>)
    await refreshTreatmentStack(object)
    trackChaos('Scatter', seed, targetIds, (next) => scatterSelected(next))
    commitHistory(`Scattered selection #${seed}`)
  }

  async function sliceSelected(direction: 'horizontal' | 'vertical', seed = newSeed()) {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object || object.type === 'activeselection') return
    const targetIds = selectedTargetIds()

    captureTransformBaseline(object)
    addTreatment(
      object,
      'slice',
      { direction: sliceDirectionToParam(direction), pieces: 5, gap: 9 },
      seed,
    )
    object.set({ objectCaching: true } as Partial<FabricObject>)
    await refreshTreatmentStack(object)
    setInspectorTab('treatments')
    trackChaos(direction === 'horizontal' ? 'Slice horizontal' : 'Slice vertical', seed, targetIds, (next) =>
      sliceSelected(direction, next),
    )
    commitHistory(direction === 'horizontal' ? 'Sliced into strips' : 'Sliced into columns')
  }

  async function aggressiveCropSelected(mode: 'close' | 'edge' | 'off-center', seed = newSeed()) {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object || object.type === 'activeselection') return
    const targetIds = selectedTargetIds()

    captureTransformBaseline(object)
    addTreatment(object, 'crop', { mode: cropModeToParam(mode) }, seed)
    object.set({ objectCaching: true } as Partial<FabricObject>)
    await refreshTreatmentStack(object)
    setInspectorTab('treatments')
    trackChaos(`${mode} crop`, seed, targetIds, (next) => aggressiveCropSelected(mode, next))
    commitHistory(`Applied ${mode} crop #${seed}`)
  }

  async function cropToPosterEdge(seed = newSeed()) {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object) return
    const random = createSeededRandom(seed)
    await aggressiveCropSelected('edge', seed)
    const cropTreatment = readTreatments(object).find((item) => item.type === 'crop' && item.enabled)
    if (!cropTreatment) return
    const cropped = findCropFragments(canvas, cropTreatment.id)[0]
    if (!cropped) return
    cropped.set({
      left: random() > 0.5 ? -poster.width * 0.08 : poster.width * 0.72,
      top: random() > 0.5 ? -poster.height * 0.04 : poster.height * 0.78,
    })
    cropped.setCoords()
    canvas.requestRenderAll()
    commitHistory(`Cropped layer to poster edge #${seed}`)
  }

  function addTypeStrip(seed = newSeed()) {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object || object.type !== 'textbox') return
    const targetIds = selectedTargetIds()
    const text = String(readObjectProp(object, 'text') ?? 'TYPE STRIP')
    const bounds = object.getBoundingRect()
    const strips = createTypeStrips(
      {
        id: String(readObjectProp(object, 'id') ?? 'type'),
        text,
        left: bounds.left,
        top: bounds.top + bounds.height + 18,
        width: Math.max(bounds.width, poster.width * 0.52),
      },
      { rows: 5, height: Math.max(18, poster.height * 0.018), gap: 4, jitter: 12, random: createSeededRandom(seed) },
    )

    strips.forEach((strip, index) => {
      const block = new Rect({
        left: strip.left,
        top: strip.top,
        width: strip.width,
        height: strip.height,
        fill: strip.inverted ? '#111111' : '#f8f6ef',
        angle: strip.angle,
        opacity: 0.96,
      })
      tagObject(block, 'shape', `Strip block ${index + 1}`)

      const label = new Textbox(strip.text, {
        left: strip.left + 6,
        top: strip.top + 3,
        width: strip.width - 12,
        height: strip.height,
        fontFamily: 'Arial Black',
        fontSize: Math.max(10, strip.height * 0.58),
        fontWeight: 900,
        charSpacing: -20,
        fill: strip.inverted ? '#f8f6ef' : '#111111',
        angle: strip.angle,
      })
      tagObject(label, 'text', `Repeated type ${index + 1}`)
      canvas.add(block, label)
    })

    trackChaos('Type strips', seed, targetIds, (next) => addTypeStrip(next))
    commitHistory(`Added type strips #${seed}`)
  }

  function breakSelectedType(seed = newSeed()) {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object || object.type !== 'textbox') return
    const targetIds = selectedTargetIds()

    captureTransformBaseline(object)
    addTreatment(
      object,
      'glyph-break',
      { intensity: typeIntensity, legibility: legibilityToParam(typeLegibility) },
      seed,
    )
    void refreshTreatmentStack(object).then(() => {
      setInspectorTab('treatments')
      trackChaos('Break letters', seed, targetIds, (next) => breakSelectedType(next))
      commitHistory(`Broke type into expressive glyphs #${seed}`)
    })
  }

  async function cloneTypeAsTexture() {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object || object.type !== 'textbox') return

    const clone = await object.clone()
    clone.set({
      left: (object.left ?? 0) - 18,
      top: (object.top ?? 0) + 22,
      angle: (object.angle ?? 0) - 9,
      opacity: 0.22,
      scaleX: (object.scaleX ?? 1) * 1.12,
      scaleY: (object.scaleY ?? 1) * 0.82,
      globalCompositeOperation: 'multiply',
      fill: '#111111',
    })
    tagObject(clone, 'text', 'Buried type texture')
    canvas.add(clone)
    canvas.sendObjectToBack(clone)
    canvas.setActiveObject(object)
    commitHistory('Added buried type texture')
  }

  async function distressSelected(seed = newSeed()) {
    applyTreatmentToSelection('distress', { intensity: 70 }, 'distress', seed)
  }

  function addPhotocopyNoise(seed = newSeed()) {
    const canvas = canvasRef.current
    if (!canvas) return
    const random = createSeededRandom(seed)
    const marks = createPhotocopyNoise(poster, { specks: 90, scratches: 18, scanlines: 9, random })

    marks.forEach((mark) => {
      const object =
        mark.kind === 'speck'
          ? new Rect({
              left: mark.left,
              top: mark.top,
              width: mark.size,
              height: mark.size,
              fill: '#111111',
              opacity: mark.opacity,
              angle: random() * 45,
            })
          : new Rect({
              left: mark.left,
              top: mark.top,
              width: mark.width,
              height: mark.height,
              fill: mark.kind === 'scanline' ? '#05b6d4' : '#111111',
              opacity: mark.opacity,
              angle: mark.angle,
              globalCompositeOperation: mark.kind === 'scanline' ? 'multiply' : 'source-over',
            })
      tagObject(object, 'shape', mark.kind)
      canvas.add(object)
    })

    trackChaos('Photocopy noise', seed, [], (next) => addPhotocopyNoise(next))
    commitHistory(`Added photocopy noise #${seed}`)
  }

  function addPrintScanSurface(seed = newSeed()) {
    const canvas = canvasRef.current
    if (!canvas) return
    const artifacts = createPrintScanArtifacts(poster, { generation: xeroxGeneration, random: createSeededRandom(seed) })

    artifacts.forEach((artifact) => {
      const object = new Rect({
        left: artifact.left,
        top: artifact.top,
        width: artifact.width,
        height: artifact.height,
        fill: artifact.kind === 'band' ? '#111111' : ACCENTS[0],
        opacity: artifact.opacity,
        angle: artifact.kind === 'drift' ? artifact.angle : 0,
        globalCompositeOperation: 'multiply',
      })
      tagObject(object, 'shape', artifact.kind === 'band' ? 'Xerox band' : 'Scanner drift')
      canvas.add(object)
    })

    trackChaos('Surface wear', seed, [], (next) => addPrintScanSurface(next))
    commitHistory(`Added print-scan surface #${seed}`)
  }

  function addDiagonalTexture() {
    const canvas = canvasRef.current
    if (!canvas) return
    const lines = createDiagonalTextureLines(poster, { spacing: 18, angle: -18, opacity: 0.12 })

    lines.forEach((line) => {
      const object = new Rect({
        left: line.left,
        top: line.top,
        width: line.width,
        height: line.height,
        fill: '#24485a',
        opacity: line.opacity,
        angle: line.angle,
        globalCompositeOperation: 'multiply',
      })
      tagObject(object, 'shape', 'Diagonal print texture')
      canvas.add(object)
    })

    commitHistory('Added diagonal texture')
  }

  async function addWhiteScrapes(seed = newSeed()) {
    if (!documentMeta) return
    const board = getActiveArtboard(documentMeta)
    if (!board) return
    const before = JSON.stringify(readPosterTreatments(board))
    const { artboard: nextBoard } = addPosterTreatment(board, 'scrape', { count: 7 }, seed)
    const after = JSON.stringify(readPosterTreatments(nextBoard))
    setDocumentMeta({
      ...documentMeta,
      artboards: documentMeta.artboards.map((item) => (item.id === board.id ? nextBoard : item)),
    })
    await refreshPosterTreatments(readPosterTreatments(nextBoard))
    setInspectorTab('treatments')
    trackChaos('White scrapes', seed, [], (next) => addWhiteScrapes(next))
    commitPosterTreatmentHistoryRef.current(board.id, `Added scrape mask treatment #${seed}`, before, after)
  }

  function addRedEchoType() {
    const canvas = canvasRef.current
    if (!canvas) return
    const entries = [
      { text: 'ECHO', left: poster.width * 0.06, top: poster.height * 0.08, width: poster.width * 0.58, size: poster.width * 0.17, angle: 0 },
      { text: 'ECHO', left: poster.width * 0.16, top: poster.height * 0.72, width: poster.width * 0.72, size: poster.width * 0.19, angle: -4 },
      { text: 'ECHO', left: poster.width * 0.72, top: poster.height * 0.36, width: poster.width * 0.64, size: poster.width * 0.18, angle: 90 },
    ]

    entries.forEach((entry, index) => {
      const text = new Textbox(entry.text, {
        left: entry.left,
        top: entry.top,
        width: entry.width,
        fontFamily: 'Arial Black',
        fontSize: entry.size,
        fontWeight: 900,
        charSpacing: -70,
        fill: '#ef241d',
        opacity: 0.9,
        angle: entry.angle,
        globalCompositeOperation: 'multiply',
      })
      tagObject(text, 'text', `Red echo type ${index + 1}`)
      canvas.add(text)
    })

    commitHistory('Added red echo type')
  }

  async function tearCollageSelected(seed = newSeed()) {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object || object.type === 'activeselection') return
    const targetIds = selectedTargetIds()

    captureTransformBaseline(object)
    addTreatment(object, 'tear', { pieces: 7, gap: 32 }, seed)
    object.set({ objectCaching: true } as Partial<FabricObject>)
    await refreshTreatmentStack(object)
    setInspectorTab('treatments')
    trackChaos('Tear collage', seed, targetIds, (next) => tearCollageSelected(next))
    commitHistory(`Made tear collage #${seed}`)
  }

  function addCropMarks() {
    const canvas = canvasRef.current
    if (!canvas) return
    const guides = createCropGuides(poster, Math.round(Math.min(poster.width, poster.height) * 0.075))

    guides.forEach((guide) => {
      if (guide.kind === 'cross') {
        const horizontal = new Rect({
          left: guide.left - guide.size / 2,
          top: guide.top,
          width: guide.size,
          height: 1,
          fill: '#111111',
          opacity: 0.62,
        })
        const vertical = new Rect({
          left: guide.left,
          top: guide.top - guide.size / 2,
          width: 1,
          height: guide.size,
          fill: '#111111',
          opacity: 0.62,
        })
        tagObject(horizontal, 'shape', 'Registration mark')
        tagObject(vertical, 'shape', 'Registration mark')
        canvas.add(horizontal, vertical)
        return
      }

      const line = new Rect({
        left: guide.left,
        top: guide.top,
        width: guide.width,
        height: guide.height,
        fill: guide.id.startsWith('grid') ? ACCENTS[0] : '#111111',
        opacity: guide.id.startsWith('grid') ? 0.18 : 0.58,
        globalCompositeOperation: 'multiply',
      })
      tagObject(line, 'shape', guide.id.startsWith('grid') ? 'Faint grid' : 'Crop mark')
      canvas.add(line)
    })

    commitHistory('Added crop marks and grid')
  }

  function applyPosterStyle(style: 'magazine' | 'type' | 'image' | 'minimal') {
    const canvas = canvasRef.current
    if (!canvas) return
    if (styleBaselineRef.current.size === 0) captureStyleBaseline()
    const baseline = styleBaselineRef.current

    if (style === 'minimal') {
      canvas.backgroundColor = '#f8f6ef'
      canvas.getObjects().forEach((object, index) => {
        const base = baseline.get(String(readObjectProp(object, 'id') ?? ''))
        object.set({
          fill: object.type === 'textbox' ? (index % 2 ? '#111111' : '#e11d48') : base?.fill,
          opacity: 1,
          angle: index % 2 ? -1 : 1,
        } as Partial<FabricObject>)
        object.setCoords()
      })
    } else {
      canvas.getObjects().forEach((object, index) => {
        const base = baseline.get(String(readObjectProp(object, 'id') ?? ''))
        if (!base) return
        object.set({
          left: base.left + (index % 2 ? 34 : -28),
          top: base.top + (index % 3 ? -18 : 26),
          angle: base.angle + (style === 'type' ? -12 : 9),
          opacity: style === 'image' && object.type !== 'image' ? 0.72 : base.opacity,
          globalCompositeOperation: style === 'magazine' ? BLEND_MODES[index % BLEND_MODES.length].value : 'source-over',
        } as Partial<FabricObject>)
        object.setCoords()
      })
    }

    canvas.requestRenderAll()
    commitHistory(`Applied ${style} preset`)
  }

  async function saveProjectAction() {
    const canvas = canvasRef.current
    if (!canvas) return
    const name = projectName.trim() || 'Untitled poster'
    try {
      // Fix: no more silent overwrite — name collisions now require confirmation.
      const existing = await findProjectByName(name)
      let id = projectId
      if (existing && existing.id !== projectId) {
        const overwrite = window.confirm(`A poster named “${name}” already exists. Overwrite it?`)
        if (!overwrite) {
          setStatus('Save cancelled — rename the poster and try again')
          return
        }
        id = existing.id
        setProjectId(existing.id)
      }
      await persistProject({
        id,
        name,
        savedAt: new Date().toISOString(),
        preset: poster,
        canvas: canvas.toObject(HISTORY_PROPS as unknown as string[]),
        document: documentMeta ?? undefined,
      })
      setSavedProjects(await listProjects())
      await clearAutosave()
      setStatus(`Saved “${name}”`)
    } catch {
      setStatus('Save failed — storage may be full or unavailable')
    }
  }

  async function loadProject(project: StoredProject, options: { keepId: boolean } = { keepId: true }) {
    const canvas = canvasRef.current
    if (!canvas) return
    setPoster(project.preset)
    setPresetId(project.preset.id)
    setProjectName(project.name)
    if (options.keepId) setProjectId(project.id)
    if (project.document) {
      setDocumentMeta(project.document)
      setDocumentPalette(project.document.palette)
      setPrintDpi(project.document.dpi)
      setBleedMm(project.document.bleedMm)
    }
    restoringRef.current = true
    await canvas.loadFromJSON(project.canvas)
    restoringRef.current = false
    await reconcileArtifactTreatments()
    await refreshPosterTreatments()
    canvas.requestRenderAll()
    resetHistory(JSON.stringify(canvas.toObject(HISTORY_PROPS as unknown as string[])), `Loaded ${project.name}`)
    lastChaosRef.current = null
    setLastChaos(null)
    captureStyleBaseline()
    syncSelected()
    syncLayers()
    setStatus(`Loaded ${project.name}`)
  }

  async function deleteSavedProject(id: string, name: string) {
    if (!window.confirm(`Delete saved poster “${name}”? This cannot be undone.`)) return
    try {
      await deleteProject(id)
      setSavedProjects(await listProjects())
      setStatus(`Deleted “${name}”`)
    } catch {
      setStatus('Could not delete the saved poster')
    }
  }

  async function exportAllArtboards() {
    if (!documentMeta || documentMeta.artboards.length < 2) {
      exportPoster()
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const activeId = documentMeta.activeArtboardId
    for (const board of documentMeta.artboards) {
      await switchToArtboard(board.id)
      exportPoster()
    }
    if (activeId !== documentMeta.activeArtboardId) {
      await switchToArtboard(activeId)
    }
    setStatus(`Exported ${documentMeta.artboards.length} artboards`)
  }

  function toggleCmykPreview(enabled: boolean) {
    const canvas = canvasRef.current
    if (!canvas) return
    setShowCmykPreview(enabled)
    canvas.getObjects().forEach((object) => {
      const fill = readObjectProp(object, 'fill')
      if (typeof fill === 'string' && fill.startsWith('#')) {
        const original = readObjectProp(object, 'originalFill') as string | undefined
        if (enabled) {
          object.set({
            originalFill: fill,
            fill: softProofHex(fill),
          } as Partial<FabricObject>)
        } else if (original) {
          object.set({ fill: original, originalFill: undefined } as Partial<FabricObject>)
        }
      }
    })
    canvas.requestRenderAll()
    setStatus(enabled ? 'CMYK soft-proof preview on' : 'CMYK soft-proof preview off')
  }

  function exportPoster() {
    const canvas = canvasRef.current
    if (!canvas) return
    const previousBackground = canvas.backgroundColor
    const format = exportFormat
    const rasterFormat = format === 'jpeg' ? 'jpeg' : 'png'
    const background =
      exportBackground === 'white' || (rasterFormat === 'jpeg' && exportBackground === 'transparent')
        ? '#ffffff'
        : exportBackground === 'transparent'
          ? ''
          : '#f6f1e6'

    try {
      canvas.discardActiveObject()
      canvas.backgroundColor = background
      canvas.requestRenderAll()
      const width = poster.width * exportScale
      const height = poster.height * exportScale
      const dataUrl = canvas.toDataURL({
        format: rasterFormat,
        multiplier: exportScale,
        quality: exportQuality / 100,
      })
      const baseName = safeFileName(projectName)

      if (format === 'pdf') {
        downloadPdfFromImageData(dataUrl, `${baseName}@${exportScale}x.pdf`, width, height, printDpi, {
          registrationMarks: pdfRegistrationMarks,
        })
      } else if (format === 'tiff') {
        const image = new Image()
        image.onload = () => {
          const scratch = document.createElement('canvas')
          scratch.width = width
          scratch.height = height
          const ctx = scratch.getContext('2d')
          ctx?.drawImage(image, 0, 0, width, height)
          const rgba = ctx?.getImageData(0, 0, width, height).data
          if (!rgba) return
          const blob = rgbaToTiffBlob(width, height, rgba)
          const link = document.createElement('a')
          link.href = URL.createObjectURL(blob)
          link.download = `${baseName}@${exportScale}x.tiff`
          link.click()
          URL.revokeObjectURL(link.href)
        }
        image.src = dataUrl
      } else {
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = `${baseName}@${exportScale}x.${rasterFormat === 'jpeg' ? 'jpg' : 'png'}`
        link.click()
      }
      setStatus(`Exported ${format.toUpperCase()} ${width} x ${height}`)
    } catch {
      setStatus('Export failed — try a smaller export size')
    } finally {
      canvas.backgroundColor = previousBackground
      canvas.requestRenderAll()
      syncSelected()
    }
  }

  function pushRecentColor(color: string) {
    setRecentColors((current) => [color, ...current.filter((item) => item !== color)].slice(0, 8))
  }

  async function pickColorWithEyeDropper() {
    const EyeDropperCtor = (window as unknown as { EyeDropper?: EyeDropperConstructor }).EyeDropper
    if (!EyeDropperCtor) {
      setStatus('Eyedropper is not supported in this browser')
      return
    }
    try {
      const result = await new EyeDropperCtor().open()
      updateActive({ fill: result.sRGBHex })
      pushRecentColor(result.sRGBHex)
      finalizeActive('Picked color')
    } catch {
      /* user cancelled the eyedropper */
    }
  }

  const selectedIsImage = selected?.kind === 'image' || selected?.kind === 'fragment'
  const selectedIsText = selected?.kind === 'text'

  const selectedObject = selected ? findObjectById(selected.id) : null
  const selectedTreatments = readTreatments(selectedObject)
  const activeBoard = documentMeta ? getActiveArtboard(documentMeta) : undefined
  const posterTreatments = readPosterTreatments(activeBoard)
  const selectedIsPath = selectedObject?.type === 'path' || selectedObject?.type === 'line'
  const textContrast = selectedIsText ? contrastRatio(String(selected?.fill ?? '#111111'), '#f6f1e6') : null
  const commands: CommandAction[] = [
    { id: 'filter-gallery', label: 'Open filter gallery', keywords: ['filter', 'gallery', 'effects', 'xerox'], scope: 'selection', run: openFilterGallery },
    { id: 'xerox', label: 'Xerox copy', keywords: ['xerox', 'photocopy', 'print'], scope: 'selection', run: () => void applyXeroxToSelected() },
    { id: 'scatter', label: 'Scatter selection', keywords: ['scatter', 'chaos'], scope: 'selection', run: () => scatterSelected() },
    { id: 'decay', label: 'Age selected', keywords: ['decay', 'age', 'wear'], scope: 'selection', run: () => void applyLayerDecayToSelected() },
    { id: 'distress', label: 'Distress selection', keywords: ['distress', 'grunge'], scope: 'selection', run: () => void distressSelected() },
    { id: 'align-left', label: 'Align left', keywords: ['align', 'layout'], scope: 'selection', run: () => alignSelection('left') },
    { id: 'export', label: 'Export poster', keywords: ['export', 'download', 'pdf'], scope: 'canvas', run: exportPoster },
    { id: 'save', label: 'Save project', keywords: ['save'], scope: 'canvas', run: () => void saveProjectAction() },
    { id: 'fork', label: 'Fork variation', keywords: ['variant', 'branch', 'comp'], scope: 'canvas', run: () => void forkVariation() },
    { id: 'clip', label: 'Clip to shape', keywords: ['mask', 'clip'], scope: 'selection', run: () => void clipSelectionToShape() },
    { id: 'grid', label: 'Toggle layout grid', keywords: ['grid', 'columns'], scope: 'canvas', run: () => setShowLayoutGrid((value) => !value) },
    { id: 'print-guides', label: 'Toggle print guides', keywords: ['bleed', 'trim', 'print'], scope: 'canvas', run: () => setShowPrintGuides((value) => !value) },
  ]

  return (
    <main className="editor-shell">
      <CommandPalette open={commandOpen} commands={commands} onClose={() => setCommandOpen(false)} />
      <OnboardingModal open={onboardingOpen} onStart={completeOnboarding} onSkip={completeOnboarding} />
      <VariantCompareModal
        open={variantCompare !== null}
        variant={comparingVariant}
        currentThumbnail={variantCompare?.currentThumbnail ?? null}
        onRestore={() => {
          if (variantCompare) void restoreVariant(variantCompare.variantId)
        }}
        onClose={() => setVariantCompare(null)}
      />
      <FilterGalleryModal
        open={filterGalleryOpen}
        source={selectedObject}
        selectedIsImage={selectedIsImage}
        onApply={applyFilterFromGallery}
        onClose={() => setFilterGalleryOpen(false)}
      />
      <TopBar
        onUndo={() => void undoAsync()}
        onRedo={redo}
        onSave={() => void saveProjectAction()}
        onOpenCommands={() => setCommandOpen(true)}
        onExport={exportPoster}
      />

      <section className="workspace">
        <LeftRail
          fileInputRef={fileInputRef}
          penMode={penMode}
          showInstruments={showInstruments}
          selected={Boolean(selected)}
          selectedIsImage={selectedIsImage}
          selectedIsText={selectedIsText}
          presetId={presetId}
          customSize={customSize}
          typeLegibility={typeLegibility}
          typeIntensity={typeIntensity}
          xeroxGeneration={xeroxGeneration}
          accidentIntensity={accidentIntensity}
          decayAmount={decayAmount}
          layerCount={layers.length}
          onAddText={addText}
          onImageInputChange={(file) => void handleImageFile(file)}
          onAddShape={addShape}
          onAddEllipse={addEllipse}
          onAddLine={addLine}
          onAddStar={addStarShape}
          onTogglePenMode={() => setPenMode((value) => !value)}
          onDuplicateSelected={() => void duplicateSelected()}
          onSliceHorizontal={() => void sliceSelected('horizontal')}
          onSliceVertical={() => void sliceSelected('vertical')}
          onScatter={() => scatterSelected()}
          onDeleteSelected={deleteSelected}
          onToggleInstruments={() => setShowInstruments((value) => !value)}
          onPresetChange={(id) => handlePresetChange(id)}
          onCustomSizeChange={applyCustomSize}
          onApplyPosterStyle={applyPosterStyle}
          onTypeLegibilityChange={setTypeLegibility}
          onTypeIntensityChange={setTypeIntensity}
          onTypeIntensityCommit={() => setStatus('Updated type intensity')}
          onXeroxGenerationChange={setXeroxGeneration}
          onXeroxGenerationCommit={() => setStatus('Updated xerox generation')}
          onAccidentIntensityChange={setAccidentIntensity}
          onAccidentIntensityCommit={() => setStatus('Updated accident intensity')}
          onDecayAmountChange={setDecayAmount}
          onDecayAmountCommit={() => setStatus('Updated layer decay amount')}
          onAddTypeStrip={() => addTypeStrip()}
          onDistressSelected={() => void distressSelected()}
          onAddPhotocopyNoise={() => addPhotocopyNoise()}
          onTearCollage={() => void tearCollageSelected()}
          onAddCropMarks={addCropMarks}
          onBreakSelectedType={() => breakSelectedType()}
          onCloneTypeAsTexture={() => void cloneTypeAsTexture()}
          onApplyXerox={() => void applyXeroxToSelected()}
          onAddMisprintDuplicate={() => void addMisprintDuplicate()}
          onAddPrintScanSurface={() => addPrintScanSurface()}
          onApplyLayerDecay={() => void applyLayerDecayToSelected()}
          onAddLayerDecayMarks={(kind) => addLayerDecayMarks(kind)}
          onAddLayerDecayOffset={() => void addLayerDecayOffset()}
          onDuplicateDriftAccident={() => void duplicateDriftAccident()}
          onBadCropAccident={() => void badCropAccident()}
          onFlipMistakeAccident={() => void flipMistakeAccident()}
          onCollideSelectionAccident={collideSelectionAccident}
          onNudgeLayoutAccident={() => nudgeLayoutAccident()}
          onApplyColdWashImage={applyColdWashImage}
          onAddDiagonalTexture={addDiagonalTexture}
          onAddWhiteScrapes={() => addWhiteScrapes()}
          onAddRedEchoType={addRedEchoType}
          onAggressiveCrop={(mode) => void aggressiveCropSelected(mode)}
          onCropToPosterEdge={() => void cropToPosterEdge()}
          onOpenLayersPanel={() => setInspectorTab('layers')}
          onOpenFilterGallery={openFilterGallery}
        />

        <EditorCanvas
          poster={poster}
          displayScale={displayScale}
          status={status}
          isPanMode={isPanMode}
          documentMeta={documentMeta}
          lastChaos={lastChaos}
          projectName={projectName}
          canvasEl={canvasEl}
          scrollRef={scrollRef}
          onSwitchArtboard={(artboardId) => void switchToArtboard(artboardId)}
          onChangeArtboardPreset={changeArtboardPreset}
          onStepZoom={stepZoom}
          onZoom100={() => setZoom(1)}
          onZoomFit={() => setZoom(null)}
          onReroll={() => void rerollLast()}
          onPanMouseDown={handlePanMouseDown}
          onPanMouseMove={handlePanMouseMove}
          onPanMouseUp={handlePanMouseUp}
          onAssetDrop={(assetId) => {
            const asset = storedAssets.find((item) => item.id === assetId)
            if (asset) void insertAsset(asset)
          }}
          onRestoreVariant={(variantId) => void restoreVariant(variantId)}
          onForkVariant={() => void forkVariation()}
        />

        <InspectorPanel
          inspectorTab={inspectorTab}
          onInspectorTabChange={setInspectorTab}
          projectName={projectName}
          onProjectNameChange={setProjectName}
          exportFormat={exportFormat}
          onExportFormatChange={setExportFormat}
          exportScale={exportScale}
          onExportScaleChange={setExportScale}
          exportBackground={exportBackground}
          onExportBackgroundChange={setExportBackground}
          exportQuality={exportQuality}
          onExportQualityChange={setExportQuality}
          onExportQualityCommit={() => setStatus('Updated export quality')}
          posterWidth={poster.width}
          posterHeight={poster.height}
          onExport={exportPoster}
          savedProjects={savedProjects}
          onLoadProject={(project) => void loadProject(project)}
          onDeleteProject={(id, name) => void deleteSavedProject(id, name)}
          posterTreatments={posterTreatments}
          selected={selected}
          selectedObject={selectedObject}
          selectedTreatments={selectedTreatments}
          onReorderPosterTreatment={(id, direction) => void reorderPosterTreatmentAction(id, direction)}
          onRerollPosterTreatment={(id) => void rerollPosterTreatment(id)}
          onTogglePosterTreatment={(id) => void togglePosterTreatment(id)}
          onRemovePosterTreatment={(id) => void removePosterTreatmentAction(id)}
          onReorderLayerTreatment={(id, direction) => void reorderLayerTreatment(id, direction)}
          onRerollLayerTreatment={(id) => void rerollTreatment(id)}
          onToggleLayerTreatment={(id) => void toggleTreatment(id)}
          onRemoveLayerTreatment={(object, id) => void removeLayerTreatment(object, id)}
          onSaveTreatmentStackAsComponent={() => void saveTreatmentStackAsComponent()}
          layers={layers}
          selectedLayerIds={selectedLayerIds}
          renamingLayerId={renamingLayerId}
          dragLayerId={dragLayerId}
          onSelectLayer={selectLayer}
          onToggleLayerVisibility={toggleLayerVisibility}
          onToggleLayerLock={toggleLayerLock}
          onRenameLayerStart={setRenamingLayerId}
          onRenameLayerEnd={(id, name) => {
            renameLayer(id, name.trim() || 'Layer')
            setRenamingLayerId(null)
          }}
          onDragLayerStart={setDragLayerId}
          onDragLayerOver={(id) => {
            if (dragLayerId && dragLayerId !== id) reorderLayer(dragLayerId, id)
          }}
          onDragLayerEnd={() => setDragLayerId(null)}
          onZoomToLayer={zoomToLayer}
          selectedIsText={selectedIsText}
          selectedIsImage={selectedIsImage}
          selectedIsPath={selectedIsPath}
          pathEditMode={pathEditMode}
          onTogglePathEditMode={togglePathEditMode}
          customFonts={customFonts}
          fontInputRef={fontInputRef}
          onFontFileChange={(file) => {
            void loadFontFile(file).then((family) => {
              setCustomFonts((current) => [...new Set([...current, family])])
              updateActive({ fontFamily: family })
              finalizeActive(`Loaded font ${family}`)
            })
          }}
          fontStretch={fontStretch}
          onFontStretchChange={setFontStretch}
          textContrast={textContrast}
          onUpdateActive={updateActive}
          onFinalizeActive={finalizeActive}
          onLoadGoogleFont={loadGoogleFont}
          documentPalette={documentPalette}
          onUpdatePaletteSwatch={updatePaletteSwatch}
          recentColors={recentColors}
          onPushRecentColor={pushRecentColor}
          onPickColorWithEyeDropper={() => void pickColorWithEyeDropper()}
          onApplyTextOnPath={applyTextOnPath}
          onApplyGradientFill={applyGradientFill}
          onApplyStrokeDash={applyStrokeDash}
          onPaintBrushMask={() => void paintBrushMask()}
          penStrokeWidth={penStrokeWidth}
          onPenStrokeColorChange={setPenStrokeColor}
          onPenStrokeWidthChange={setPenStrokeWidth}
          onMoveLayer={moveLayer}
          onApplyImageEffect={applyImageEffect}
          storedAssets={storedAssets}
          documentMeta={documentMeta}
          onInsertAsset={(asset) => void insertAsset(asset)}
          onInsertComponent={(componentId) => void insertComponent(componentId)}
          onSaveSelectionAsComponent={() => void saveSelectionAsComponent()}
          onAlignSelection={alignSelection}
          onDistributeSelection={distributeSelection}
          onClipSelectionToShape={() => void clipSelectionToShape()}
          gridOverlay={gridOverlay}
          onGridTensionChange={(value) => setGridOverlay((current) => ({ ...current, tension: value }))}
          onGridTensionCommit={() => {
            setShowLayoutGrid(true)
            const canvas = canvasRef.current
            if (!canvas) return
            for (const object of canvas.getObjects()) {
              if (readTreatments(object).some((item) => item.type === 'scatter')) {
                void refreshTreatmentStack(object)
              }
            }
          }}
          showLayoutGrid={showLayoutGrid}
          onToggleLayoutGrid={() => setShowLayoutGrid((value) => !value)}
          showBaselineGrid={showBaselineGrid}
          onToggleBaselineGrid={() => setShowBaselineGrid((value) => !value)}
          onRestoreVariant={(variantId) => void restoreVariant(variantId)}
          onOpenVariantCompare={(variantId) => void openVariantCompare(variantId)}
          onMergeVariant={(variantId) => void mergeVariant(variantId)}
          onRenameVariant={(variantId) => renameVariantById(variantId)}
          printDpi={printDpi}
          onPrintDpiChange={setPrintDpi}
          bleedMm={bleedMm}
          onBleedMmChange={setBleedMm}
          showPrintGuides={showPrintGuides}
          onTogglePrintGuides={() => setShowPrintGuides((value) => !value)}
          showCmykPreview={showCmykPreview}
          onToggleCmykPreview={() => toggleCmykPreview(!showCmykPreview)}
          pdfRegistrationMarks={pdfRegistrationMarks}
          onPdfRegistrationMarksChange={setPdfRegistrationMarks}
          onAddArtboard={addNewArtboard}
          newArtboardPreset={newArtboardPreset}
          onNewArtboardPresetChange={setNewArtboardPreset}
          onExportAllArtboards={() => void exportAllArtboards()}
        />
      </section>

    </main>
  )
}

export default App
