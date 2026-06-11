import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignLeft,
  BringToFront,
  Circle,
  Crop,
  Dices,
  Download,
  Eye,
  EyeOff,
  FlipHorizontal,
  Grid3x3,
  ImagePlus,
  Layers,
  Lock,
  LockOpen,
  Maximize,
  Minus,
  Pipette,
  ScanLine,
  Redo2,
  Save,
  Scissors,
  SendToBack,
  Shuffle,
  Sparkles,
  Square,
  Star,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import {
  ActiveSelection,
  Canvas,
  Ellipse,
  FabricObject,
  Gradient,
  Image as FabricImage,
  Line,
  Polygon,
  Rect,
  Textbox,
  filters,
} from 'fabric'
import {
  applyPosterPreset,
  createAccidentTransforms,
  createAggressiveCropFrame,
  createCutFragments,
  createCropGuides,
  createDiagonalTextureLines,
  createExpressiveGlyphs,
  createLayerDecayMarks,
  createPhotocopyNoise,
  createPrintScanArtifacts,
  createScrapeMasks,
  createTearFragments,
  createTypeStrips,
  getLayerDecayProfile,
  getPrintScanProfile,
  type ExpressiveLegibility,
  type PosterPreset,
  type PosterPresetId,
} from './lib/editorModel'
import { createSeededRandom, newSeed } from './lib/random'
import { computeSnap } from './lib/snapping'
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
import {
  addTreatment,
  captureTransformBaseline,
  readTreatments,
  removeTreatment,
  renderTreatmentStack,
  treatmentLabel,
  updateTreatment,
  type Treatment,
} from './lib/treatments'
import {
  createDefaultDocument,
  forkVariant,
  getActiveArtboard,
  switchArtboard,
  addArtboard,
  type DocumentMeta,
} from './lib/document'
import { loadFontFile, loadGoogleFont, GOOGLE_FONTS } from './lib/fonts'
import { contrastRatio, FULL_BLEND_MODES, legibilityBand } from './lib/color'
import { alignObjects, buildColumnGrid, distributeObjects, type GridOverlay } from './lib/grid'
import { buildPrintGuides, downloadPdfFromImageData, rgbaToTiffBlob } from './lib/print'
import { createThumbnail, listAssets, newAssetId, saveAsset, type StoredAsset } from './lib/assets'
import type { CommandAction } from './lib/commands'
import { CommandPalette } from './components/CommandPalette'
import { OnboardingModal } from './components/OnboardingModal'
import './App.css'

type LayerKind = 'text' | 'image' | 'shape' | 'fragment'
type ExportFormat = 'png' | 'jpeg' | 'pdf' | 'tiff'
type InspectorTab = 'inspect' | 'treatments' | 'layers' | 'assets' | 'layout' | 'print'
type ExportBackground = 'paper' | 'white' | 'transparent'
type SelectedState = {
  id: string
  kind: LayerKind
  name: string
  left: number
  top: number
  angle: number
  opacity: number
  scaleX: number
  scaleY: number
  visible: boolean
  locked: boolean
  fontFamily?: string
  fontSize?: number
  fontWeight?: string | number
  charSpacing?: number
  lineHeight?: number
  text?: string
  fill?: string
  skewX?: number
  skewY?: number
  blendMode?: string
}
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

const HISTORY_PROPS = [
  'id',
  'name',
  'kind',
  'selectable',
  'evented',
  'treatments',
  'transformBaseline',
  'stroke',
  'strokeWidth',
  'strokeDashArray',
  'clipPath',
] as const
const FONT_STACKS = [
  'Arial Black',
  'Impact',
  'Helvetica',
  'Arial Narrow',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
]
const BLEND_MODES = FULL_BLEND_MODES
const ONBOARDING_KEY = 'carson.onboarding.v1'
const ACCENTS = ['#05b6d4', '#e11d48', '#a3e635']
const ZOOM_LEVELS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8]
const SNAP_SCREEN_THRESHOLD = 6

const formatPercent = (value: number) => `${Math.round(value)}%`
const formatDegrees = (value: number) => `${Math.round(value)}°`
const formatLineHeight = (value: number) => (value / 100).toFixed(2)

type EyeDropperResult = { sRGBHex: string }
type EyeDropperConstructor = new () => { open: () => Promise<EyeDropperResult> }

function App() {
  const canvasEl = useRef<HTMLCanvasElement | null>(null)
  const canvasRef = useRef<Canvas | null>(null)
  const historyRef = useRef<string[]>([])
  const redoRef = useRef<string[]>([])
  const restoringRef = useRef(false)
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
  const gridOverlayRef = useRef<GridOverlay>({ columns: 4, rows: 8, margin: 48, gutter: 16, tension: 0 })
  const printDpiRef = useRef(300)
  const bleedMmRef = useRef(3)

  const [poster, setPoster] = useState<PosterPreset>(() => applyPosterPreset('a3'))
  const [presetId, setPresetId] = useState<PosterPresetId>('a3')
  const [customSize, setCustomSize] = useState({ width: 1200, height: 1600 })
  const [selected, setSelected] = useState<SelectedState | null>(null)
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
  const [documentMeta, setDocumentMeta] = useState<DocumentMeta | null>(null)
  const [customFonts, setCustomFonts] = useState<string[]>([])
  const [storedAssets, setStoredAssets] = useState<StoredAsset[]>([])
  const [documentPalette, setDocumentPalette] = useState<string[]>(['#111111', '#e11d48', '#05b6d4', '#f6f1e6'])
  const [fontStretch, setFontStretch] = useState(100)
  const [gridOverlay, setGridOverlay] = useState<GridOverlay>({ columns: 4, rows: 8, margin: 48, gutter: 16, tension: 0 })
  const [showLayoutGrid, setShowLayoutGrid] = useState(false)
  const [showPrintGuides, setShowPrintGuides] = useState(false)
  const [printDpi, setPrintDpi] = useState(300)
  const [bleedMm, setBleedMm] = useState(3)
  const [onboardingOpen, setOnboardingOpen] = useState(() => !localStorage.getItem(ONBOARDING_KEY))
  const fontInputRef = useRef<HTMLInputElement | null>(null)

  showPrintGuidesRef.current = showPrintGuides
  showLayoutGridRef.current = showLayoutGrid
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
  }, [showLayoutGrid, showPrintGuides, gridOverlay, printDpi, bleedMm])

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

  function registerCanvasEvents(canvas: Canvas) {
    const sync = () => {
      syncSelected()
      syncLayers()
    }

    canvas.on('selection:created', sync)
    canvas.on('selection:updated', sync)
    canvas.on('selection:cleared', sync)
    canvas.on('object:modified', () => commitHistory('Changed layer'))
    canvas.on('object:added', syncLayers)
    canvas.on('object:removed', syncLayers)

    // Snapping v1: canvas edges, centers, and object-to-object. Hold Cmd/Ctrl to suspend.
    canvas.on('object:moving', (event) => {
      const target = event.target
      guidesRef.current = { v: [], h: [] }
      if (!target) return
      const pointerEvent = event.e as MouseEvent | TouchEvent | undefined
      const suspended = pointerEvent && 'metaKey' in pointerEvent && (pointerEvent.metaKey || pointerEvent.ctrlKey)
      if (suspended) {
        canvas.requestRenderAll()
        return
      }
      const bounds = target.getBoundingRect()
      const others = canvas
        .getObjects()
        .filter((object) => object !== target && object.visible !== false && !canvas.getActiveObjects().includes(object))
        .map((object) => object.getBoundingRect())
      const threshold = SNAP_SCREEN_THRESHOLD / displayScaleRef.current
      const snap = computeSnap(bounds, others, { width: canvas.getWidth(), height: canvas.getHeight() }, threshold)
      if (snap.dx !== 0 || snap.dy !== 0) {
        target.set({ left: (target.left ?? 0) + snap.dx, top: (target.top ?? 0) + snap.dy })
        target.setCoords()
      }
      guidesRef.current = { v: snap.vGuides, h: snap.hGuides }
      canvas.requestRenderAll()
    })

    canvas.on('mouse:up', () => {
      if (guidesRef.current.v.length > 0 || guidesRef.current.h.length > 0) {
        guidesRef.current = { v: [], h: [] }
        canvas.requestRenderAll()
      }
    })

    canvas.on('after:render', () => {
      const { v, h } = guidesRef.current
      const ctx = canvas.contextTop
      if (!ctx) return
      canvas.clearContext(ctx)
      ctx.save()
      ctx.lineWidth = 1 / displayScaleRef.current

      if (showLayoutGridRef.current) {
        const overlay = gridOverlayRef.current
        const columns = buildColumnGrid(
          { width: canvas.getWidth(), height: canvas.getHeight() },
          overlay,
        )
        ctx.strokeStyle = 'rgba(5, 182, 212, 0.35)'
        ctx.setLineDash([4, 8])
        for (const column of columns) {
          ctx.strokeRect(column.left, column.top, column.width, column.height)
        }
      }

      if (showPrintGuidesRef.current) {
        const guides = buildPrintGuides(
          { width: canvas.getWidth(), height: canvas.getHeight() },
          printDpiRef.current,
          bleedMmRef.current,
        )
        for (const guide of guides) {
          ctx.strokeStyle =
            guide.kind === 'bleed' ? 'rgba(225, 29, 72, 0.55)' : guide.kind === 'safe' ? 'rgba(17, 17, 17, 0.35)' : 'rgba(17, 17, 17, 0.7)'
          ctx.setLineDash(guide.kind === 'bleed' ? [10, 6] : [])
          ctx.strokeRect(guide.left, guide.top, guide.width, guide.height)
        }
      }

      if (v.length > 0 || h.length > 0) {
        ctx.strokeStyle = '#e11d48'
        ctx.setLineDash([6, 4])
        for (const x of v) {
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, canvas.getHeight())
          ctx.stroke()
        }
        for (const y of h) {
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(canvas.getWidth(), y)
          ctx.stroke()
        }
      }
      ctx.restore()
    })
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
      object.set({ left: (object.left ?? 0) + dx, top: (object.top ?? 0) + dy })
      object.setCoords()
      canvas.requestRenderAll()
      syncSelected()
      if (nudgeTimerRef.current) window.clearTimeout(nudgeTimerRef.current)
      nudgeTimerRef.current = window.setTimeout(() => commitHistory('Nudged layer'), 350)
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

  function commitHistory(message: string) {
    const canvas = canvasRef.current
    if (!canvas || restoringRef.current) return
    const snapshot = JSON.stringify(canvas.toObject(HISTORY_PROPS as unknown as string[]))
    const history = historyRef.current
    if (history.at(-1) !== snapshot) {
      historyRef.current = [...history.slice(-39), snapshot]
      redoRef.current = []
      scheduleAutosave()
      if (!message.endsWith(' preset')) captureStyleBaseline()
    }
    syncSelected()
    syncLayers()
    setStatus(message)
  }

  async function restoreSnapshot(snapshot: string, message: string) {
    const canvas = canvasRef.current
    if (!canvas) return
    restoringRef.current = true
    await canvas.loadFromJSON(JSON.parse(snapshot))
    restoringRef.current = false
    canvas.requestRenderAll()
    captureStyleBaseline()
    syncSelected()
    syncLayers()
    setStatus(message)
  }

  function undoAsync() {
    const history = historyRef.current
    if (history.length < 2) return Promise.resolve()
    const current = history.at(-1)
    const previous = history.at(-2)
    if (!current || !previous) return Promise.resolve()
    redoRef.current = [current, ...redoRef.current]
    historyRef.current = history.slice(0, -1)
    return restoreSnapshot(previous, 'Undo')
  }

  function redo() {
    const [next, ...rest] = redoRef.current
    if (!next) return
    redoRef.current = rest
    historyRef.current = [...historyRef.current, next]
    void restoreSnapshot(next, 'Redo')
  }

  function syncLayers() {
    const canvas = canvasRef.current
    if (!canvas) return
    setLayers(canvas.getObjects().map(toSelectedState).reverse())
  }

  function syncSelected() {
    const object = activeObject()
    setSelected(object ? toSelectedState(object) : null)
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
    }
  }

  function updateActive(values: Partial<SelectedState>) {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object) return
    object.set(values as Partial<FabricObject>)
    object.setCoords()
    canvas.requestRenderAll()
    syncSelected()
    syncLayers()
  }

  function finalizeActive(message: string) {
    activeObject()?.setCoords()
    canvasRef.current?.requestRenderAll()
    commitHistory(message)
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

  function rerollTreatment(treatmentId: string) {
    const object = activeObject()
    if (!object) return
    updateTreatment(object, treatmentId, { seed: newSeed() })
    renderTreatmentStack(object)
    canvasRef.current?.requestRenderAll()
    commitHistory('Re-rolled treatment')
  }

  function toggleTreatment(treatmentId: string) {
    const object = activeObject()
    if (!object) return
    const treatment = readTreatments(object).find((item) => item.id === treatmentId)
    if (!treatment) return
    updateTreatment(object, treatmentId, { enabled: !treatment.enabled })
    renderTreatmentStack(object)
    canvasRef.current?.requestRenderAll()
    commitHistory(treatment.enabled ? 'Bypassed treatment' : 'Enabled treatment')
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
    setDocumentMeta(forkVariant(documentMeta, snapshot, name))
    setStatus(`Forked ${name} — open Layout tab to compare`)
    commitHistory(`Forked ${name}`)
  }

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
    setPoster(target.preset)
    setPresetId(target.preset.id)
    setDocumentMeta(next)
    canvas.requestRenderAll()
    captureStyleBaseline()
    syncSelected()
    syncLayers()
    setStatus(`Switched to ${target.name}`)
  }

  function addNewArtboard() {
    if (!documentMeta) return
    const next = addArtboard(documentMeta, 'instagram')
    setDocumentMeta(next)
    const board = getActiveArtboard(next)
    if (board) void switchToArtboard(board.id)
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

  function applyGradientFill() {
    const object = activeObject()
    if (!object || selectedIsImage) return
    const gradient = new Gradient({
      type: 'linear',
      coords: { x1: 0, y1: 0, x2: 100, y2: 0 },
      colorStops: [
        { offset: 0, color: documentPalette[0] ?? '#111111' },
        { offset: 1, color: documentPalette[1] ?? '#e11d48' },
      ],
    })
    object.set({ fill: gradient })
    canvasRef.current?.requestRenderAll()
    finalizeActive('Applied gradient fill')
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
    if (direction === 'front') canvas.bringObjectToFront(object)
    else canvas.sendObjectToBack(object)
    commitHistory(direction === 'front' ? 'Moved layer to front' : 'Moved layer to back')
  }

  function selectLayer(id: string) {
    const canvas = canvasRef.current
    const object = findObjectById(id)
    if (!canvas || !object) return
    canvas.setActiveObject(object)
    canvas.requestRenderAll()
    syncSelected()
  }

  function toggleLayerVisibility(id: string) {
    const object = findObjectById(id)
    if (!object) return
    object.set({ visible: object.visible === false })
    canvasRef.current?.requestRenderAll()
    commitHistory(object.visible === false ? 'Hid layer' : 'Showed layer')
  }

  function toggleLayerLock(id: string) {
    const canvas = canvasRef.current
    const object = findObjectById(id)
    if (!canvas || !object) return
    const locking = object.selectable !== false
    object.set({ selectable: !locking, evented: !locking })
    if (locking && canvas.getActiveObject() === object) {
      canvas.discardActiveObject()
    }
    canvas.requestRenderAll()
    commitHistory(locking ? 'Locked layer' : 'Unlocked layer')
  }

  function renameLayer(id: string, name: string) {
    const object = findObjectById(id)
    if (!object) return
    object.set({ name } as Partial<FabricObject>)
    commitHistory('Renamed layer')
  }

  function reorderLayer(draggedId: string, targetId: string) {
    const canvas = canvasRef.current
    const dragged = findObjectById(draggedId)
    const target = findObjectById(targetId)
    if (!canvas || !dragged || !target || dragged === target) return
    const targetIndex = canvas.getObjects().indexOf(target)
    canvas.moveObjectTo(dragged, targetIndex)
    canvas.requestRenderAll()
    commitHistory('Reordered layers')
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
    renderTreatmentStack(object)
    canvas.requestRenderAll()
    trackChaos(label, seed, targetIds, (next) => applyTreatmentToSelection(type, params, label, next))
    commitHistory(`Applied ${label} #${seed}`)
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

  function applyColdDiveImage() {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object || object.type !== 'image') return
    const image = object as FabricImage

    image.filters = [
      new filters.Grayscale(),
      new filters.Contrast({ contrast: 0.42 }),
      new filters.BlendColor({ color: '#2f6f8f', mode: 'tint', alpha: 0.22 }),
      new filters.Noise({ noise: 85 }),
    ]
    image.applyFilters()
    image.set({
      opacity: 0.92,
      globalCompositeOperation: 'multiply',
    })
    canvas.requestRenderAll()
    commitHistory('Applied cold wash image treatment')
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
    const imageUrl = object.toDataURL({ format: 'png', multiplier: 1 })
    const fragments = createCutFragments(
      {
        id: String(readObjectProp(object, 'id') ?? 'layer'),
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      },
      { pieces: 3, gap: Math.max(16, accidentIntensity * 0.4), direction: cropDirection },
    )
    const cropped = await cropFragments(imageUrl, fragments)
    canvas.remove(object)

    for (const [index, url] of cropped.entries()) {
      if (index === 1) continue
      const fragment = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
      const frame = fragments[index]
      fragment.set({
        left: frame.left + (index === 0 ? -accidentIntensity * 0.35 : accidentIntensity * 0.35),
        top: frame.top + (index === 0 ? accidentIntensity * 0.15 : -accidentIntensity * 0.15),
        angle: index === 0 ? -4 : 5,
        opacity: object.opacity ?? 1,
        globalCompositeOperation: 'multiply',
      })
      tagObject(fragment, 'fragment', `Bad crop ${index + 1}`)
      canvas.add(fragment)
    }
    canvas.discardActiveObject()
    trackChaos('Bad crop', seed, targetIds, (next) => badCropAccident(next))
    commitHistory('Applied bad crop accident')
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

  function scatterSelected(seed = newSeed()) {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object || object.type === 'activeselection') return
    const targetIds = selectedTargetIds()
    captureTransformBaseline(object)
    addTreatment(object, 'scatter', { distance: 46, rotation: 18, scale: 0.14 }, seed)
    object.set({ objectCaching: true } as Partial<FabricObject>)
    renderTreatmentStack(object)
    canvas.requestRenderAll()
    trackChaos('Scatter', seed, targetIds, (next) => scatterSelected(next))
    commitHistory(`Scattered selection #${seed}`)
  }

  async function sliceSelected(direction: 'horizontal' | 'vertical') {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object || object.type === 'activeselection') return

    const imageUrl = object.toDataURL({ format: 'png', multiplier: 1 })
    const bounds = object.getBoundingRect()
    const fragments = createCutFragments(
      {
        id: String(readObjectProp(object, 'id') ?? 'layer'),
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      },
      { pieces: 5, gap: 9, direction },
    )

    const cropped = await cropFragments(imageUrl, fragments)
    canvas.remove(object)
    for (const [index, url] of cropped.entries()) {
      const fragment = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
      const frame = fragments[index]
      fragment.set({
        left: frame.left,
        top: frame.top,
        angle: index % 2 === 0 ? -2 : 3,
        opacity: object.opacity ?? 1,
      })
      tagObject(fragment, 'fragment', `Cut ${index + 1}`)
      canvas.add(fragment)
    }
    canvas.discardActiveObject()
    commitHistory(direction === 'horizontal' ? 'Sliced into strips' : 'Sliced into columns')
  }

  async function aggressiveCropSelected(mode: 'close' | 'edge' | 'off-center', seed = newSeed()) {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object || object.type === 'activeselection') return
    const targetIds = selectedTargetIds()

    const imageUrl = object.toDataURL({ format: 'png', multiplier: 1 })
    const bounds = object.getBoundingRect()
    const frame = createAggressiveCropFrame(
      {
        id: String(readObjectProp(object, 'id') ?? 'layer'),
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      },
      { mode, random: createSeededRandom(seed) },
    )
    const [url] = await cropFragments(imageUrl, [frame])
    const crop = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
    crop.set({
      left: frame.left,
      top: frame.top,
      angle: (object.angle ?? 0) + (mode === 'edge' ? -2 : mode === 'off-center' ? 3 : 0),
      opacity: object.opacity ?? 1,
      globalCompositeOperation: mode === 'close' ? 'source-over' : 'multiply',
    })
    tagObject(crop, 'fragment', `${mode} crop`)
    canvas.remove(object)
    canvas.add(crop)
    canvas.setActiveObject(crop)
    trackChaos(`${mode} crop`, seed, targetIds, (next) => aggressiveCropSelected(mode, next))
    commitHistory(`Applied ${mode} crop #${seed}`)
  }

  async function cropToPosterEdge(seed = newSeed()) {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object) return
    const random = createSeededRandom(seed)
    await aggressiveCropSelected('edge', seed)
    const cropped = activeObject()
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

    const text = String(readObjectProp(object, 'text') ?? '')
    const glyphs = createExpressiveGlyphs(
      {
        id: String(readObjectProp(object, 'id') ?? 'type'),
        text,
        left: object.left ?? 0,
        top: object.top ?? 0,
        fontSize: Number(readObjectProp(object, 'fontSize') ?? 80),
        charSpacing: Number(readObjectProp(object, 'charSpacing') ?? 0),
      },
      { intensity: typeIntensity, legibility: typeLegibility, random: createSeededRandom(seed) },
    )
    const fill = String(readObjectProp(object, 'fill') ?? '#111111')
    const fontFamily = String(readObjectProp(object, 'fontFamily') ?? 'Impact')
    const fontWeight = readObjectProp(object, 'fontWeight') as string | number | undefined
    const baseAngle = object.angle ?? 0

    canvas.remove(object)
    glyphs.forEach((glyph, index) => {
      const letter = new Textbox(glyph.text, {
        left: glyph.left,
        top: glyph.top,
        width: Math.max(16, glyph.fontSize * 0.9),
        fontFamily,
        fontSize: glyph.fontSize,
        fontWeight,
        fill: index % 7 === 0 && typeLegibility === 'low' ? ACCENTS[index % ACCENTS.length] : fill,
        opacity: glyph.opacity,
        angle: baseAngle + glyph.angle,
        scaleX: glyph.scaleX,
        scaleY: glyph.scaleY,
        charSpacing: -20,
      })
      tagObject(letter, 'text', `Glyph ${glyph.text}`)
      canvas.add(letter)
    })

    canvas.discardActiveObject()
    trackChaos('Break letters', seed, targetIds, (next) => breakSelectedType(next))
    commitHistory(`Broke type into expressive glyphs #${seed}`)
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

  function addDiveTexture() {
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

  function addWhiteScrapes(seed = newSeed()) {
    const canvas = canvasRef.current
    if (!canvas) return
    const random = createSeededRandom(seed)
    const masks = createScrapeMasks(poster, { count: 7, random })

    masks.forEach((mask, index) => {
      const scrape = new Rect({
        left: mask.left,
        top: mask.top,
        width: mask.width,
        height: mask.height,
        fill: '#f8f6ef',
        opacity: mask.opacity,
        angle: mask.angle,
      })
      tagObject(scrape, 'shape', `White scrape ${index + 1}`)
      canvas.add(scrape)

      const chips = createPhotocopyNoise({ width: mask.width, height: mask.height }, { specks: 9, scratches: 2, scanlines: 0, random })
      chips.forEach((chip) => {
        const chipObject = new Rect({
          left: mask.left + chip.left,
          top: mask.top + chip.top,
          width: chip.kind === 'speck' ? chip.size : chip.width,
          height: chip.kind === 'speck' ? chip.size : chip.height,
          fill: '#111111',
          opacity: chip.opacity * 0.42,
          angle: chip.kind === 'speck' ? mask.angle : chip.angle,
          globalCompositeOperation: 'multiply',
        })
        tagObject(chipObject, 'shape', 'Scrape grit')
        canvas.add(chipObject)
      })
    })

    trackChaos('White scrapes', seed, [], (next) => addWhiteScrapes(next))
    commitHistory(`Added white scrape masks #${seed}`)
  }

  function addDiveRedType() {
    const canvas = canvasRef.current
    if (!canvas) return
    const entries = [
      { text: 'dive', left: poster.width * 0.06, top: poster.height * 0.08, width: poster.width * 0.58, size: poster.width * 0.17, angle: 0 },
      { text: 'dive', left: poster.width * 0.16, top: poster.height * 0.72, width: poster.width * 0.72, size: poster.width * 0.19, angle: -4 },
      { text: 'dive', left: poster.width * 0.72, top: poster.height * 0.36, width: poster.width * 0.64, size: poster.width * 0.18, angle: 90 },
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

    const imageUrl = object.toDataURL({ format: 'png', multiplier: 1 })
    const bounds = object.getBoundingRect()
    const fragments = createTearFragments(
      {
        id: String(readObjectProp(object, 'id') ?? 'layer'),
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      },
      { pieces: 7, gap: 32, random: createSeededRandom(seed) },
    )

    const cropped = await cropFragments(imageUrl, fragments)
    canvas.remove(object)
    for (const [index, url] of cropped.entries()) {
      const fragment = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
      const frame = fragments[index]
      fragment.set({
        left: frame.left,
        top: frame.top,
        angle: frame.angle,
        opacity: object.opacity ?? 1,
        globalCompositeOperation: index % 3 === 0 ? 'multiply' : 'source-over',
      })
      tagObject(fragment, 'fragment', `Torn scrap ${index + 1}`)
      canvas.add(fragment)
    }
    canvas.discardActiveObject()
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
    canvas.requestRenderAll()
    historyRef.current = [JSON.stringify(canvas.toObject(HISTORY_PROPS as unknown as string[]))]
    redoRef.current = []
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
        downloadPdfFromImageData(dataUrl, `${baseName}@${exportScale}x.pdf`, width, height, printDpi)
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

  const scopeSel = <span className="scope-badge" aria-hidden="true">SEL</span>
  const scopeAll = <span className="scope-badge scope-all" aria-hidden="true">ALL</span>
  const selectedObject = selected ? findObjectById(selected.id) : null
  const selectedTreatments = readTreatments(selectedObject)
  const textContrast = selectedIsText ? contrastRatio(String(selected?.fill ?? '#111111'), '#f6f1e6') : null
  const commands: CommandAction[] = [
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
      <header className="topbar glass-bar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">C</span>
          <div>
            <h1>Carson</h1>
            <p>Poster editor</p>
          </div>
        </div>
        <div className="top-actions" aria-label="Poster actions">
          <button type="button" className="icon-button" aria-label="Undo" title="Undo (Cmd+Z)" onClick={() => void undoAsync()}>
            <Undo2 size={18} />
          </button>
          <button type="button" className="icon-button" aria-label="Redo" title="Redo (Cmd+Shift+Z)" onClick={redo}>
            <Redo2 size={18} />
          </button>
          <button type="button" className="toolbar-button" title="Save to this browser (Cmd+S)" onClick={() => void saveProjectAction()}>
            <Save size={17} />
            Save
          </button>
          <button type="button" className="toolbar-button" title="Command palette (Cmd+K)" onClick={() => setCommandOpen(true)}>
            <Sparkles size={17} />
            Commands
          </button>
          <button type="button" className="primary-button" title="Export the poster (Cmd+E)" onClick={exportPoster}>
            <Download size={17} />
            Export
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="rail left-rail glass-panel" aria-label="Tools and layers">
          <div className="panel-section">
            <h2>Tools</h2>
            <div className="tool-grid">
              <button type="button" title="Add a text layer (T)" onClick={addText}>
                <Type size={17} />
                Text
              </button>
              <button type="button" title="Import an image from your computer" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus size={17} />
                Image
              </button>
              <button type="button" title="Add a solid block (B)" onClick={addShape}>
                <Square size={17} />
                Block
              </button>
              <button type="button" title="Add an ellipse" onClick={addEllipse}>
                <Circle size={17} />
                Ellipse
              </button>
              <button type="button" title="Add a line" onClick={addLine}>
                <Minus size={17} />
                Line
              </button>
              <button type="button" title="Add a star" onClick={addStarShape}>
                <Star size={17} />
                Star
              </button>
              <button type="button" title="Duplicate the selected layer (Cmd+D)" onClick={() => void duplicateSelected()} disabled={!selected}>
                <FlipHorizontal size={17} />
                Copy
              </button>
              <button type="button" title="Slice the selected layer into horizontal strips" onClick={() => void sliceSelected('horizontal')} disabled={!selected}>
                <Scissors size={17} />
                Strips
              </button>
              <button type="button" title="Slice the selected layer into vertical columns" onClick={() => void sliceSelected('vertical')} disabled={!selected}>
                <Scissors size={17} />
                Columns
              </button>
              <button type="button" title="Scatter the selected layers with seeded randomness — press R to re-roll" onClick={() => scatterSelected()} disabled={!selected}>
                <Shuffle size={17} />
                Scatter
              </button>
              <button type="button" title="Delete the selected layer (Delete)" onClick={deleteSelected} disabled={!selected}>
                <Trash2 size={17} />
                Delete
              </button>
            </div>
            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleImageFile(file)
                event.currentTarget.value = ''
              }}
            />
          </div>

          <div className="panel-section">
            <h2>Poster</h2>
            <label>
              Size
              <select value={presetId} onChange={(event) => handlePresetChange(event.target.value as PosterPresetId)}>
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
                    max={3000}
                    value={customSize.width}
                    onChange={(event) => applyCustomSize({ ...customSize, width: Number(event.target.value) })}
                  />
                </label>
                <label>
                  H
                  <input
                    type="number"
                    min={320}
                    max={3000}
                    value={customSize.height}
                    onChange={(event) => applyCustomSize({ ...customSize, height: Number(event.target.value) })}
                  />
                </label>
              </div>
            ) : null}
            <div className="preset-row">
              <button type="button" title="Shift every layer into colliding blend chaos — affects the whole poster" onClick={() => applyPosterStyle('magazine')}>
                Magazine chaos {scopeAll}
              </button>
              <button type="button" title="Rotate the whole layout toward oversized type — affects the whole poster" onClick={() => applyPosterStyle('type')}>
                Oversized type {scopeAll}
              </button>
              <button type="button" title="Fracture the layout around imagery — affects the whole poster" onClick={() => applyPosterStyle('image')}>
                Image fracture {scopeAll}
              </button>
              <button type="button" title="Reset to black/white/red minimalism — affects the whole poster" onClick={() => applyPosterStyle('minimal')}>
                B/W red {scopeAll}
              </button>
            </div>
          </div>

          <div className="panel-section">
            <h2>Manual Effects</h2>
            <div className="preset-row">
              <button type="button" title="Repeat the selected text as printed strips below it" onClick={() => addTypeStrip()} disabled={!selectedIsText}>
                <Type size={17} />
                Type strip {scopeSel}
              </button>
              <button type="button" title="Convert the selected layer into harsh black & white grit (rasterizes it)" onClick={() => void distressSelected()} disabled={!selected}>
                <Sparkles size={17} />
                Distress {scopeSel}
              </button>
              <button type="button" title="Sprinkle photocopier specks, scratches, and scanlines across the poster" onClick={() => addPhotocopyNoise()}>
                <ScanLine size={17} />
                Photocopy noise {scopeAll}
              </button>
              <button type="button" title="Tear the selected layer into shifted scraps (rasterizes it)" onClick={() => void tearCollageSelected()} disabled={!selected}>
                <Scissors size={17} />
                Tear collage {scopeSel}
              </button>
              <button type="button" title="Stamp decorative crop marks and a faint grid onto the artwork" onClick={addCropMarks}>
                <Crop size={17} />
                Crop marks/grid {scopeAll}
              </button>
            </div>
          </div>

          <div className="panel-section">
            <h2>Expressive Type Lab</h2>
            <label>
              Legibility
              <select value={typeLegibility} onChange={(event) => setTypeLegibility(event.target.value as ExpressiveLegibility)}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <Slider
              label="Intensity"
              value={typeIntensity}
              min={0}
              max={100}
              onChange={setTypeIntensity}
              onCommit={() => setStatus('Updated type intensity')}
            />
            <div className="preset-row">
              <button type="button" title="Break the selected text into loose, expressive letters" onClick={() => breakSelectedType()} disabled={!selectedIsText}>
                <Type size={17} />
                Break letters {scopeSel}
              </button>
              <button type="button" title="Bury a ghost copy of the selected text behind the layout" onClick={() => void cloneTypeAsTexture()} disabled={!selectedIsText}>
                <Layers size={17} />
                Bury type {scopeSel}
              </button>
            </div>
          </div>

          <div className="panel-section">
            <h2>Xerox / Print-Scan</h2>
            <Slider
              label="Generation"
              value={xeroxGeneration}
              min={1}
              max={10}
              onChange={setXeroxGeneration}
              onCommit={() => setStatus('Updated xerox generation')}
            />
            <div className="preset-row">
              <button type="button" title="Re-photocopy the selected layer at the chosen generation (rasterizes it)" onClick={() => void applyXeroxToSelected()} disabled={!selected}>
                <ScanLine size={17} />
                Copy selected {scopeSel}
              </button>
              <button type="button" title="Add a faint misregistered print echo behind the selected layer" onClick={() => void addMisprintDuplicate()} disabled={!selected}>
                <Layers size={17} />
                Misprint offset {scopeSel}
              </button>
              <button type="button" title="Add photocopier bands and scanner drift across the poster" onClick={() => addPrintScanSurface()}>
                <Sparkles size={17} />
                Surface wear {scopeAll}
              </button>
            </div>
          </div>

          <div className="panel-section">
            <h2>Layer Decay</h2>
            <Slider
              label="Amount"
              value={decayAmount}
              min={0}
              max={100}
              onChange={setDecayAmount}
              onCommit={() => setStatus('Updated layer decay amount')}
            />
            <div className="preset-row">
              <button type="button" title="Age the selected layer with contrast, noise, and drift (rasterizes it)" onClick={() => void applyLayerDecayToSelected()} disabled={!selected}>
                <Sparkles size={17} />
                Age selected {scopeSel}
              </button>
              <button type="button" title="Chip ink away from the selected layer" onClick={() => addLayerDecayMarks('ink-loss')} disabled={!selected}>
                <Scissors size={17} />
                Ink loss {scopeSel}
              </button>
              <button type="button" title="Add fold creases across the selected layer" onClick={() => addLayerDecayMarks('fold')} disabled={!selected}>
                <ScanLine size={17} />
                Fold marks {scopeSel}
              </button>
              <button type="button" title="Add the full wear treatment to the selected layer" onClick={() => addLayerDecayMarks('all')} disabled={!selected}>
                <Layers size={17} />
                Wear overlay {scopeSel}
              </button>
              <button type="button" title="Add a faint decayed echo behind the selected layer" onClick={() => void addLayerDecayOffset()} disabled={!selected}>
                <Shuffle size={17} />
                Decay offset {scopeSel}
              </button>
            </div>
          </div>

          <div className="panel-section">
            <h2>Accident Engine</h2>
            <Slider
              label="Intensity"
              value={accidentIntensity}
              min={0}
              max={100}
              onChange={setAccidentIntensity}
              onCommit={() => setStatus('Updated accident intensity')}
            />
            <div className="preset-row">
              <button type="button" title="Clone the selection with accidental drift — press R to re-roll" onClick={() => void duplicateDriftAccident()} disabled={!selected}>
                <Shuffle size={17} />
                Duplicate drift {scopeSel}
              </button>
              <button type="button" title="Crop the selection badly on purpose (rasterizes it)" onClick={() => void badCropAccident()} disabled={!selected}>
                <Crop size={17} />
                Bad crop {scopeSel}
              </button>
              <button type="button" title="Add a flipped ghost of the selection" onClick={() => void flipMistakeAccident()} disabled={!selected}>
                <FlipHorizontal size={17} />
                Flip mistake {scopeSel}
              </button>
              <button type="button" title="Pile the selected layers into a collision (needs 2+ selected)" onClick={collideSelectionAccident} disabled={!selected}>
                <Layers size={17} />
                Collide selection {scopeSel}
              </button>
              <button type="button" title="Nudge every layer with accidental drift — press R to re-roll" onClick={() => nudgeLayoutAccident()}>
                <Sparkles size={17} />
                Nudge layout {scopeAll}
              </button>
            </div>
          </div>

          <div className="panel-section">
            <h2>Texture Tools</h2>
            <div className="preset-row">
              <button type="button" title="Apply a cold, tinted print wash to the selected image" onClick={applyColdDiveImage} disabled={!selectedIsImage}>
                <ImagePlus size={17} />
                Cold wash {scopeSel}
              </button>
              <button type="button" title="Lay diagonal print texture lines across the poster" onClick={addDiveTexture}>
                <ScanLine size={17} />
                Diagonal texture {scopeAll}
              </button>
              <button type="button" title="Scrape white bands with grit across the poster" onClick={() => addWhiteScrapes()}>
                <Scissors size={17} />
                White scrapes {scopeAll}
              </button>
              <button type="button" title="Stamp three large red echo words across the poster" onClick={addDiveRedType}>
                <Type size={17} />
                Red echo type {scopeAll}
              </button>
            </div>
          </div>

          <div className="panel-section">
            <h2>Aggressive Crop Tools</h2>
            <div className="preset-row">
              <button type="button" title="Crop tight into the center of the selection (rasterizes it)" onClick={() => void aggressiveCropSelected('close')} disabled={!selected}>
                <Crop size={17} />
                Close crop {scopeSel}
              </button>
              <button type="button" title="Crop the selection off-center — press R to re-roll (rasterizes it)" onClick={() => void aggressiveCropSelected('off-center')} disabled={!selected}>
                <Crop size={17} />
                Off-center crop {scopeSel}
              </button>
              <button type="button" title="Crop the selection hard to one edge (rasterizes it)" onClick={() => void aggressiveCropSelected('edge')} disabled={!selected}>
                <Crop size={17} />
                Edge crop {scopeSel}
              </button>
              <button type="button" title="Crop the selection and throw it to the poster edge (rasterizes it)" onClick={() => void cropToPosterEdge()} disabled={!selected}>
                <Scissors size={17} />
                Throw to edge {scopeSel}
              </button>
              <button type="button" title="Slice the selection into vertical strips" onClick={() => void sliceSelected('vertical')} disabled={!selected}>
                <Scissors size={17} />
                Crop strips {scopeSel}
              </button>
            </div>
          </div>

          <div className="panel-section layer-section">
            <div className="panel-title">
              <h2>
                Layers <span className="section-count">[{layers.length}]</span>
              </h2>
              <Layers size={15} />
            </div>
            <div className="layer-list">
              {layers.map((layer) => (
                <div
                  key={layer.id}
                  className={selected?.id === layer.id ? 'active layer-row' : 'layer-row'}
                  draggable={renamingLayerId !== layer.id}
                  onDragStart={() => setDragLayerId(layer.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    if (dragLayerId) reorderLayer(dragLayerId, layer.id)
                    setDragLayerId(null)
                  }}
                  onDragEnd={() => setDragLayerId(null)}
                >
                  {renamingLayerId === layer.id ? (
                    <input
                      autoFocus
                      className="layer-rename"
                      defaultValue={layer.name}
                      onBlur={(event) => {
                        renameLayer(layer.id, event.target.value.trim() || layer.name)
                        setRenamingLayerId(null)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
                        if (event.key === 'Escape') setRenamingLayerId(null)
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="layer-select"
                      title="Click to select · double-click to rename · drag to reorder"
                      onClick={() => selectLayer(layer.id)}
                      onDoubleClick={() => setRenamingLayerId(layer.id)}
                    >
                      <span>{layer.name}</span>
                      <small>{layer.kind}</small>
                    </button>
                  )}
                  <span className="layer-controls">
                    <button
                      type="button"
                      className="icon-button layer-toggle"
                      aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                      title={layer.visible ? 'Hide layer' : 'Show layer'}
                      onClick={() => toggleLayerVisibility(layer.id)}
                    >
                      {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                    <button
                      type="button"
                      className="icon-button layer-toggle"
                      aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                      title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                      onClick={() => toggleLayerLock(layer.id)}
                    >
                      {layer.locked ? <Lock size={13} /> : <LockOpen size={13} />}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="canvas-stage" aria-label="Poster canvas">
          <div className="stage-toolbar glass-bar">
            <span>
              {poster.name} · {poster.width} x {poster.height}px
              {poster.dpi ? ` @ ${poster.dpi}dpi` : ''}
            </span>
            {documentMeta && documentMeta.artboards.length > 1 ? (
              <span className="artboard-tabs">
                {documentMeta.artboards.map((board) => (
                  <button
                    key={board.id}
                    type="button"
                    className={board.id === documentMeta.activeArtboardId ? 'active' : undefined}
                    onClick={() => void switchToArtboard(board.id)}
                  >
                    {board.name}
                  </button>
                ))}
              </span>
            ) : null}
            <span className="zoom-controls">
              <button type="button" className="icon-button" aria-label="Zoom out" title="Zoom out (Cmd+-)" onClick={() => stepZoom(-1)}>
                <ZoomOut size={15} />
              </button>
              <button type="button" className="zoom-readout" title="Reset to 100% (Cmd+1)" onClick={() => setZoom(1)}>
                {Math.round(displayScale * 100)}%
              </button>
              <button type="button" className="icon-button" aria-label="Zoom in" title="Zoom in (Cmd+=)" onClick={() => stepZoom(1)}>
                <ZoomIn size={15} />
              </button>
              <button type="button" className="icon-button" aria-label="Fit poster to view" title="Fit to view (Cmd+0)" onClick={() => setZoom(null)}>
                <Maximize size={15} />
              </button>
            </span>
            {lastChaos ? (
              <button
                type="button"
                className="reroll-button"
                title={`Undo and re-run ${lastChaos.label} with a new seed (R)`}
                onClick={() => void rerollLast()}
              >
                <Dices size={14} />
                Re-roll {lastChaos.label} #{lastChaos.seed}
              </button>
            ) : null}
            <span role="status" aria-live="polite" className="stage-status">
              {status}
            </span>
          </div>
          <div
            ref={scrollRef}
            className={isPanMode ? 'canvas-scroll panning' : 'canvas-scroll'}
            onMouseDown={handlePanMouseDown}
            onMouseMove={handlePanMouseMove}
            onMouseUp={handlePanMouseUp}
            onMouseLeave={handlePanMouseUp}
          >
            <div
              className="canvas-shell"
              style={
                {
                  '--poster-width': `${poster.width}px`,
                  '--poster-height': `${poster.height}px`,
                  '--poster-display-width': `${poster.width * displayScale}px`,
                  '--poster-display-height': `${poster.height * displayScale}px`,
                } as React.CSSProperties
              }
            >
              <canvas ref={canvasEl} />
            </div>
          </div>
        </section>

        <aside className="rail inspector glass-panel" aria-label="Inspector">
          <div className="inspector-tabs" role="tablist" aria-label="Inspector panels">
            {(
              [
                ['inspect', 'Inspect'],
                ['treatments', 'Treatments'],
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
                onClick={() => setInspectorTab(id)}
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
              <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
            </label>
            <div className="export-box">
              <h3>Export</h3>
              <div className="split-inputs">
                <label>
                  Format
                  <select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as ExportFormat)}>
                    <option value="png">PNG</option>
                    <option value="jpeg">JPG</option>
                    <option value="pdf">PDF</option>
                    <option value="tiff">TIFF</option>
                  </select>
                </label>
                <label>
                  Size
                  <select value={exportScale} onChange={(event) => setExportScale(Number(event.target.value))}>
                    <option value={1}>1x</option>
                    <option value={2}>2x</option>
                    <option value={3}>3x</option>
                    <option value={4}>4x</option>
                  </select>
                </label>
              </div>
              <label>
                Background
                <select value={exportBackground} onChange={(event) => setExportBackground(event.target.value as ExportBackground)}>
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
                  onChange={setExportQuality}
                  onCommit={() => setStatus('Updated export quality')}
                />
              ) : null}
              <button type="button" className="primary-button export-button" onClick={exportPoster}>
                <Download size={17} />
                Export {poster.width * exportScale} x {poster.height * exportScale}
              </button>
            </div>
            <div className="saved-list">
              {savedProjects.length === 0 ? (
                <p className="empty">No saved posters yet.</p>
              ) : (
                savedProjects.map((project) => (
                  <div key={project.id} className="saved-row">
                    <button type="button" title={`Load “${project.name}”`} onClick={() => void loadProject(project)}>
                      <span>{project.name}</span>
                      <small>{new Date(project.savedAt).toLocaleString()}</small>
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Delete saved poster ${project.name}`}
                      title="Delete this saved poster"
                      onClick={() => void deleteSavedProject(project.id, project.name)}
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
              <p className="hint">Non-destructive — text stays editable under filters.</p>
              {!selected ? (
                <p className="empty">Select a layer to view its treatment stack.</p>
              ) : selectedTreatments.length === 0 ? (
                <p className="empty">No treatments yet. Try Xerox or Scatter from the left rail.</p>
              ) : (
                <ul className="treatment-stack">
                  {selectedTreatments.map((treatment) => (
                    <li key={treatment.id} className={treatment.enabled ? undefined : 'bypassed'}>
                      <span>{treatmentLabel(treatment)}</span>
                      <small>#{treatment.seed}</small>
                      <span className="treatment-actions">
                        <button type="button" title="Re-roll seed" onClick={() => rerollTreatment(treatment.id)}>
                          <Dices size={12} />
                        </button>
                        <button type="button" title={treatment.enabled ? 'Bypass' : 'Enable'} onClick={() => toggleTreatment(treatment.id)}>
                          {treatment.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
                        <button type="button" title="Remove" onClick={() => {
                          if (!selectedObject) return
                          removeTreatment(selectedObject, treatment.id)
                          renderTreatmentStack(selectedObject)
                          canvasRef.current?.requestRenderAll()
                          commitHistory('Removed treatment')
                        }}>
                          <Trash2 size={12} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
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
                    onChange={(event) => updateActive({ name: event.target.value })}
                    onBlur={() => finalizeActive('Renamed layer')}
                  />
                </label>
                {selectedIsText ? (
                  <>
                    <label>
                      Text
                      <textarea
                        value={selected.text ?? ''}
                        rows={4}
                        onChange={(event) => updateActive({ text: event.target.value })}
                        onBlur={() => finalizeActive('Edited text')}
                      />
                    </label>
                    <label>
                      Font
                      <select
                        value={selected.fontFamily ?? FONT_STACKS[0]}
                        onChange={(event) => {
                          void loadGoogleFont(event.target.value).finally(() => {
                            updateActive({ fontFamily: event.target.value })
                            finalizeActive('Changed font')
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
                        if (!file) return
                        void loadFontFile(file).then((family) => {
                          setCustomFonts((current) => [...new Set([...current, family])])
                          updateActive({ fontFamily: family })
                          finalizeActive(`Loaded font ${family}`)
                        })
                        event.currentTarget.value = ''
                      }}
                    />
                    <Slider
                      label="Weight axis"
                      value={Number(selected.fontWeight) || 700}
                      min={100}
                      max={900}
                      onChange={(value) => updateActive({ fontWeight: value })}
                      onCommit={() => finalizeActive('Changed weight')}
                    />
                    <Slider
                      label="Width axis"
                      value={fontStretch}
                      min={50}
                      max={200}
                      format={formatPercent}
                      onChange={(value) => {
                        setFontStretch(value)
                        updateActive({ scaleX: value / 100 })
                      }}
                      onCommit={() => finalizeActive('Changed width axis')}
                    />
                    <p className="hint legibility-readout">
                      Legibility: {legibilityBand(textContrast)} · contrast {textContrast ? textContrast.toFixed(1) : '—'}:1
                    </p>
                    <Slider
                      label="Size"
                      value={selected.fontSize ?? 80}
                      min={12}
                      max={360}
                      onChange={(value) => updateActive({ fontSize: value })}
                      onCommit={() => finalizeActive('Changed type size')}
                    />
                    <Slider
                      label="Spacing"
                      value={selected.charSpacing ?? 0}
                      min={-120}
                      max={260}
                      onChange={(value) => updateActive({ charSpacing: value })}
                      onCommit={() => finalizeActive('Changed spacing')}
                    />
                    <Slider
                      label="Line"
                      value={Math.round((selected.lineHeight ?? 1) * 100)}
                      min={50}
                      max={180}
                      format={formatLineHeight}
                      onChange={(value) => updateActive({ lineHeight: value / 100 })}
                      onCommit={() => finalizeActive('Changed line height')}
                    />
                  </>
                ) : null}

                <div className="split-inputs">
                  <label>
                    X
                    <input
                      type="number"
                      value={selected.left}
                      onChange={(event) => updateActive({ left: Number(event.target.value) })}
                      onBlur={() => finalizeActive('Moved layer')}
                    />
                  </label>
                  <label>
                    Y
                    <input
                      type="number"
                      value={selected.top}
                      onChange={(event) => updateActive({ top: Number(event.target.value) })}
                      onBlur={() => finalizeActive('Moved layer')}
                    />
                  </label>
                </div>
                <Slider
                  label="Rotate"
                  value={selected.angle}
                  min={-180}
                  max={180}
                  format={formatDegrees}
                  onChange={(value) => updateActive({ angle: value })}
                  onCommit={() => finalizeActive('Rotated layer')}
                />
                <Slider
                  label="Opacity"
                  value={Math.round(selected.opacity * 100)}
                  min={5}
                  max={100}
                  format={formatPercent}
                  onChange={(value) => updateActive({ opacity: value / 100 })}
                  onCommit={() => finalizeActive('Changed opacity')}
                />
                <Slider
                  label="Stretch X"
                  value={Math.round(selected.scaleX * 100)}
                  min={20}
                  max={320}
                  format={formatPercent}
                  onChange={(value) => updateActive({ scaleX: value / 100 })}
                  onCommit={() => finalizeActive('Stretched layer')}
                />
                <Slider
                  label="Stretch Y"
                  value={Math.round(selected.scaleY * 100)}
                  min={20}
                  max={320}
                  format={formatPercent}
                  onChange={(value) => updateActive({ scaleY: value / 100 })}
                  onCommit={() => finalizeActive('Stretched layer')}
                />
                <Slider
                  label="Skew X"
                  value={selected.skewX ?? 0}
                  min={-45}
                  max={45}
                  format={formatDegrees}
                  onChange={(value) => updateActive({ skewX: value })}
                  onCommit={() => finalizeActive('Skewed layer')}
                />
                <label>
                  Color
                  <span className="color-row">
                    <input
                      type="color"
                      value={typeof selected.fill === 'string' ? selected.fill : '#111111'}
                      onChange={(event) => updateActive({ fill: event.target.value })}
                      onBlur={(event) => {
                        pushRecentColor(event.target.value)
                        finalizeActive('Changed color')
                      }}
                      disabled={selectedIsImage}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Pick a color from the screen"
                      title="Pick a color from the screen"
                      onClick={() => void pickColorWithEyeDropper()}
                      disabled={selectedIsImage}
                    >
                      <Pipette size={14} />
                    </button>
                  </span>
                </label>
                <div className="swatch-row" aria-label="Document palette">
                  {documentPalette.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="swatch"
                      style={{ background: color }}
                      title={`Document swatch ${color}`}
                      disabled={selectedIsImage}
                      onClick={() => {
                        updateActive({ fill: color })
                        finalizeActive('Applied palette color')
                      }}
                    />
                  ))}
                </div>
                {!selectedIsImage ? (
                  <button type="button" title="Apply a linear gradient from palette colors" onClick={applyGradientFill}>
                    Apply gradient fill
                  </button>
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
                          updateActive({ fill: color })
                          finalizeActive('Changed color')
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
                      updateActive({ globalCompositeOperation: event.target.value } as Partial<SelectedState>)
                      finalizeActive('Changed blend mode')
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
                  <button type="button" title="Bring the layer to the front" onClick={() => moveLayer('front')}>
                    <BringToFront size={16} />
                    Front
                  </button>
                  <button type="button" title="Send the layer to the back" onClick={() => moveLayer('back')}>
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
                  onClick={() => applyImageEffect(effect)}
                  disabled={!selectedIsImage}
                >
                  {effect} {effect === 'clear' ? null : scopeSel}
                </button>
              ))}
            </div>
          </div>

          <div className="panel-section">
            <h2>Shortcuts</h2>
            <ul className="shortcut-list">
              <li><kbd>Cmd+Z</kbd> Undo · <kbd>Cmd+Shift+Z</kbd> Redo</li>
              <li><kbd>Cmd+D</kbd> Duplicate · <kbd>Delete</kbd> Remove</li>
              <li><kbd>Cmd+K</kbd> Commands · <kbd>Cmd+B</kbd> Fork variant</li>
              <li><kbd>Arrows</kbd> Nudge · <kbd>Shift+Arrows</kbd> Nudge ×10</li>
              <li><kbd>T</kbd> Text · <kbd>B</kbd> Block · <kbd>R</kbd> Re-roll</li>
              <li><kbd>Cmd+0</kbd> Fit · <kbd>Cmd+1</kbd> 100% · <kbd>Cmd+Scroll</kbd> Zoom</li>
              <li><kbd>Space+Drag</kbd> Pan · <kbd>Cmd+Drag</kbd> No snapping</li>
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
                    <button key={asset.id} type="button" className="asset-thumb" title={asset.name} onClick={() => void insertAsset(asset)}>
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
                      <button key={component.id} type="button" onClick={() => void insertComponent(component.id)}>
                        {component.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
              <button type="button" title="Save the current selection as a reusable component" onClick={() => void saveSelectionAsComponent()} disabled={!selected}>
                Save selection as component
              </button>
            </div>
          ) : null}

          {inspectorTab === 'layout' ? (
            <div className="panel-section">
              <h2>Layout & grid</h2>
              <div className="button-row">
                <button type="button" onClick={() => alignSelection('left')}>Align left</button>
                <button type="button" onClick={() => alignSelection('center')}>Center</button>
                <button type="button" onClick={() => alignSelection('right')}>Align right</button>
              </div>
              <div className="button-row">
                <button type="button" onClick={() => distributeSelection('horizontal')}>Distribute H</button>
                <button type="button" onClick={() => distributeSelection('vertical')}>Distribute V</button>
                <button type="button" onClick={() => void clipSelectionToShape()}>Clip to shape</button>
              </div>
              <Slider
                label="Grid tension"
                value={gridOverlay.tension}
                min={0}
                max={100}
                format={formatPercent}
                onChange={(value) => setGridOverlay((current) => ({ ...current, tension: value }))}
                onCommit={() => setShowLayoutGrid(true)}
              />
              <button type="button" onClick={() => setShowLayoutGrid((value) => !value)}>
                <Grid3x3 size={16} />
                {showLayoutGrid ? 'Hide column grid' : 'Show column grid'}
              </button>
              {documentMeta && documentMeta.variants.length > 0 ? (
                <>
                  <h3>Variations</h3>
                  <ul className="asset-list">
                    {documentMeta.variants.map((variant) => (
                      <li key={variant.id}>{variant.name} · {new Date(variant.savedAt).toLocaleString()}</li>
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
                <input type="number" value={printDpi} min={72} max={600} onChange={(event) => setPrintDpi(Number(event.target.value))} />
              </label>
              <label>
                Bleed (mm)
                <input type="number" value={bleedMm} min={0} max={20} onChange={(event) => setBleedMm(Number(event.target.value))} />
              </label>
              <button type="button" onClick={() => setShowPrintGuides((value) => !value)}>
                {showPrintGuides ? 'Hide bleed/trim guides' : 'Show bleed/trim guides'}
              </button>
              <button type="button" onClick={() => addNewArtboard()}>
                Add artboard (IG portrait)
              </button>
              <p className="hint">
                Print guides are document chrome — they never bake into artwork. Export PDF for print shops.
              </p>
            </div>
          ) : null}
        </aside>
      </section>
    </main>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
  onCommit,
  format,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  onCommit: () => void
  format?: (value: number) => string
}) {
  const display = format ? format(value) : String(Math.round(value))

  return (
    <div className="dial">
      <div className="dial-header">
        <span className="dial-label">{label}</span>
        <span className="dial-value">{display}</span>
      </div>
      <input
        className="dial-input"
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
        onKeyUp={(event) => {
          if (event.key.startsWith('Arrow')) onCommit()
        }}
      />
    </div>
  )
}

function readObjectProp(object: FabricObject | null, key: string) {
  if (!object) return undefined
  return (object as unknown as Record<string, unknown>)[key]
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function safeFileName(projectName: string) {
  return (
    projectName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'poster'
  )
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function buildStarPoints(points: number, outer: number, inner: number) {
  const result: { x: number; y: number }[] = []
  const step = Math.PI / points
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner
    const angle = i * step - Math.PI / 2
    result.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius })
  }
  return result
}

function cropFragments(imageUrl: string, fragments: ReturnType<typeof createCutFragments>) {
  return new Promise<string[]>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const output = fragments.map((fragment) => {
        const crop = document.createElement('canvas')
        crop.width = Math.max(1, Math.round(fragment.width))
        crop.height = Math.max(1, Math.round(fragment.height))
        const context = crop.getContext('2d')
        context?.drawImage(
          image,
          fragment.clipLeft,
          fragment.clipTop,
          fragment.width,
          fragment.height,
          0,
          0,
          fragment.width,
          fragment.height,
        )
        return crop.toDataURL('image/png')
      })
      resolve(output)
    }
    image.onerror = reject
    image.src = imageUrl
  })
}

export default App
