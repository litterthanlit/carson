import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignLeft,
  BringToFront,
  Crop,
  Download,
  FlipHorizontal,
  ImagePlus,
  Layers,
  ScanLine,
  Redo2,
  Save,
  Scissors,
  SendToBack,
  Shuffle,
  Sparkles,
  Square,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react'
import { Canvas, FabricObject, Image as FabricImage, Rect, Textbox, filters } from 'fabric'
import {
  applyPosterPreset,
  createCutFragments,
  createCropGuides,
  createPhotocopyNoise,
  createTearFragments,
  createTypeStrips,
  type PosterPreset,
  type PosterPresetId,
  scatterLayers,
} from './lib/editorModel'
import './App.css'

type LayerKind = 'text' | 'image' | 'shape' | 'fragment'
type SavedProject = {
  name: string
  savedAt: string
  preset: PosterPreset
  canvas: Record<string, unknown>
}
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

const STORAGE_KEY = 'carson.poster.projects.v1'
const HISTORY_PROPS = ['id', 'name', 'kind'] as const
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
const BLEND_MODES = ['source-over', 'multiply', 'screen', 'overlay', 'difference', 'exclusion']
const ACCENTS = ['#05b6d4', '#e11d48', '#a3e635']

function App() {
  const canvasEl = useRef<HTMLCanvasElement | null>(null)
  const canvasRef = useRef<Canvas | null>(null)
  const historyRef = useRef<string[]>([])
  const redoRef = useRef<string[]>([])
  const restoringRef = useRef(false)
  const layerIdRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [poster, setPoster] = useState<PosterPreset>(() => applyPosterPreset('a3'))
  const [presetId, setPresetId] = useState<PosterPresetId>('a3')
  const [customSize, setCustomSize] = useState({ width: 1200, height: 1600 })
  const [selected, setSelected] = useState<SelectedState | null>(null)
  const [layers, setLayers] = useState<SelectedState[]>([])
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>(() => readProjects())
  const [projectName, setProjectName] = useState('Untitled poster')
  const [assets, setAssets] = useState<string[]>([])
  const [status, setStatus] = useState('Ready')

  const displayScale = useMemo(() => {
    return Math.min(1, 660 / poster.width, 780 / poster.height)
  }, [poster.height, poster.width])

  useEffect(() => {
    if (!canvasEl.current) return

    const canvas = new Canvas(canvasEl.current, {
      width: poster.width,
      height: poster.height,
      backgroundColor: '#f6f1e6',
      preserveObjectStacking: true,
      selectionColor: 'rgba(225, 29, 72, 0.12)',
      selectionBorderColor: '#e11d48',
      selectionLineWidth: 1,
    })

    canvasRef.current = canvas
    seedPoster(canvas, poster)
    registerCanvasEvents(canvas)
    commitHistory('Started a new poster')

    return () => {
      canvas.dispose()
      canvasRef.current = null
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setDimensions({ width: poster.width, height: poster.height })
    canvas.backgroundColor = '#f6f1e6'
    canvas.requestRenderAll()
    commitHistory('Changed poster size')
  }, [poster])

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
    syncSelected()
    syncLayers()
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
      cornerColor: '#e11d48',
      cornerStrokeColor: '#111827',
      borderColor: '#e11d48',
      transparentCorners: false,
      cornerStyle: 'rect',
    } as Partial<FabricObject>)
  }

  function activeObject() {
    return canvasRef.current?.getActiveObject() ?? null
  }

  function commitHistory(message: string) {
    const canvas = canvasRef.current
    if (!canvas || restoringRef.current) return
    const snapshot = JSON.stringify(canvas.toObject(HISTORY_PROPS as unknown as string[]))
    const history = historyRef.current
    if (history.at(-1) !== snapshot) {
      historyRef.current = [...history.slice(-39), snapshot]
      redoRef.current = []
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
    syncSelected()
    syncLayers()
    setStatus(message)
  }

  function undo() {
    const history = historyRef.current
    if (history.length < 2) return
    const current = history.at(-1)
    const previous = history.at(-2)
    if (!current || !previous) return
    redoRef.current = [current, ...redoRef.current]
    historyRef.current = history.slice(0, -1)
    void restoreSnapshot(previous, 'Undo')
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
    canvas.remove(object)
    canvas.discardActiveObject()
    commitHistory('Deleted layer')
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
    if (!canvas) return
    const object = canvas.getObjects().find((item) => readObjectProp(item, 'id') === id)
    if (!object) return
    canvas.setActiveObject(object)
    canvas.requestRenderAll()
    syncSelected()
  }

  function handlePresetChange(nextId: PosterPresetId) {
    setPresetId(nextId)
    setPoster(applyPosterPreset(nextId, customSize))
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
    setAssets((current) => [file.name, ...current].slice(0, 8))
    commitHistory('Imported image')
  }

  function applyImageEffect(effect: 'grayscale' | 'contrast' | 'threshold' | 'blur' | 'noise' | 'clear') {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object || object.type !== 'image') return
    const image = object as FabricImage

    const effectMap = {
      grayscale: [new filters.Grayscale()],
      contrast: [new filters.Contrast({ contrast: 0.38 })],
      threshold: [new filters.BlackWhite()],
      blur: [new filters.Blur({ blur: 0.18 })],
      noise: [new filters.Noise({ noise: 120 })],
      clear: [],
    }

    image.filters = effectMap[effect]
    image.applyFilters()
    canvas.requestRenderAll()
    commitHistory(`Applied ${effect} effect`)
  }

  function scatterSelected() {
    const canvas = canvasRef.current
    const active = activeObject()
    if (!canvas || !active) return
    const targets = active.type === 'activeselection' ? canvas.getActiveObjects() : [active]
    const transforms = scatterLayers(
      targets.map((object) => ({
        id: String(readObjectProp(object, 'id') ?? ''),
        left: object.left ?? 0,
        top: object.top ?? 0,
        angle: object.angle ?? 0,
        scaleX: object.scaleX ?? 1,
        scaleY: object.scaleY ?? 1,
      })),
      { distance: 46, rotation: 18, scale: 0.14 },
    )

    targets.forEach((object, index) => {
      object.set(transforms[index])
      object.setCoords()
    })
    canvas.requestRenderAll()
    commitHistory('Scattered selection')
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

  function addTypeStrip() {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object || object.type !== 'textbox') return
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
      { rows: 5, height: Math.max(18, poster.height * 0.018), gap: 4, jitter: 12 },
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

    commitHistory('Added type strips')
  }

  async function distressSelected() {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object || object.type === 'activeselection') return

    const bounds = object.getBoundingRect()
    const imageUrl = object.toDataURL({ format: 'png', multiplier: 1.6 })
    const image = await FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' })
    image.filters = [new filters.Grayscale(), new filters.Contrast({ contrast: 0.75 }), new filters.BlackWhite(), new filters.Noise({ noise: 180 })]
    image.applyFilters()
    image.set({
      left: bounds.left,
      top: bounds.top,
      angle: object.angle ?? 0,
      opacity: object.opacity ?? 1,
      globalCompositeOperation: 'multiply',
    })
    tagObject(image, 'image', 'Distressed layer')
    canvas.remove(object)
    canvas.add(image)
    canvas.setActiveObject(image)
    commitHistory('Distressed selection')
  }

  function addPhotocopyNoise() {
    const canvas = canvasRef.current
    if (!canvas) return
    const marks = createPhotocopyNoise(poster, { specks: 90, scratches: 18, scanlines: 9 })

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
              angle: Math.random() * 45,
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

    commitHistory('Added photocopy noise')
  }

  async function tearCollageSelected() {
    const canvas = canvasRef.current
    const object = activeObject()
    if (!canvas || !object || object.type === 'activeselection') return

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
      { pieces: 7, gap: 32 },
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
    commitHistory('Made tear collage')
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

    if (style === 'minimal') {
      canvas.backgroundColor = '#f8f6ef'
      canvas.getObjects().forEach((object, index) => {
        object.set({
          fill: object.type === 'textbox' ? (index % 2 ? '#111111' : '#e11d48') : readObjectProp(object, 'fill'),
          opacity: 1,
          angle: index % 2 ? -1 : 1,
        } as Partial<FabricObject>)
      })
    } else {
      canvas.getObjects().forEach((object, index) => {
        object.set({
          left: (object.left ?? 0) + (index % 2 ? 34 : -28),
          top: (object.top ?? 0) + (index % 3 ? -18 : 26),
          angle: (object.angle ?? 0) + (style === 'type' ? -12 : 9),
          opacity: style === 'image' && object.type !== 'image' ? 0.72 : object.opacity,
          globalCompositeOperation: style === 'magazine' ? BLEND_MODES[index % BLEND_MODES.length] : 'source-over',
        } as Partial<FabricObject>)
        object.setCoords()
      })
    }

    canvas.requestRenderAll()
    commitHistory(`Applied ${style} preset`)
  }

  function saveProject() {
    const canvas = canvasRef.current
    if (!canvas) return
    const project: SavedProject = {
      name: projectName.trim() || 'Untitled poster',
      savedAt: new Date().toISOString(),
      preset: poster,
      canvas: canvas.toObject(HISTORY_PROPS as unknown as string[]),
    }
    const projects = [project, ...readProjects().filter((item) => item.name !== project.name)].slice(0, 12)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
    setSavedProjects(projects)
    setStatus('Saved locally')
  }

  async function loadProject(project: SavedProject) {
    const canvas = canvasRef.current
    if (!canvas) return
    setPoster(project.preset)
    setPresetId(project.preset.id)
    setProjectName(project.name)
    restoringRef.current = true
    await canvas.loadFromJSON(project.canvas)
    restoringRef.current = false
    canvas.requestRenderAll()
    historyRef.current = [JSON.stringify(canvas.toObject(HISTORY_PROPS as unknown as string[]))]
    redoRef.current = []
    syncSelected()
    syncLayers()
    setStatus(`Loaded ${project.name}`)
  }

  function exportPng() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.discardActiveObject()
    canvas.requestRenderAll()
    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 })
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `${projectName.trim() || 'poster'}.png`
    link.click()
    syncSelected()
    setStatus('Exported PNG')
  }

  const selectedIsImage = selected?.kind === 'image' || selected?.kind === 'fragment'
  const selectedIsText = selected?.kind === 'text'

  return (
    <main className="editor-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">C</span>
          <div>
            <h1>Carson Lab</h1>
            <p>Manual poster editor</p>
          </div>
        </div>
        <div className="top-actions" aria-label="Poster actions">
          <button type="button" className="icon-button" aria-label="Undo" onClick={undo}>
            <Undo2 size={18} />
          </button>
          <button type="button" className="icon-button" aria-label="Redo" onClick={redo}>
            <Redo2 size={18} />
          </button>
          <button type="button" className="toolbar-button" onClick={saveProject}>
            <Save size={17} />
            Save
          </button>
          <button type="button" className="primary-button" onClick={exportPng}>
            <Download size={17} />
            Export PNG
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="rail left-rail" aria-label="Tools and layers">
          <div className="panel-section">
            <h2>Tools</h2>
            <div className="tool-grid">
              <button type="button" onClick={addText}>
                <Type size={17} />
                Text
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus size={17} />
                Image
              </button>
              <button type="button" onClick={addShape}>
                <Square size={17} />
                Block
              </button>
              <button type="button" onClick={duplicateSelected} disabled={!selected}>
                <FlipHorizontal size={17} />
                Copy
              </button>
              <button type="button" onClick={() => sliceSelected('horizontal')} disabled={!selected}>
                <Scissors size={17} />
                Strips
              </button>
              <button type="button" onClick={() => sliceSelected('vertical')} disabled={!selected}>
                <Scissors size={17} />
                Columns
              </button>
              <button type="button" onClick={scatterSelected} disabled={!selected}>
                <Shuffle size={17} />
                Scatter
              </button>
              <button type="button" onClick={deleteSelected} disabled={!selected}>
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
              <button type="button" onClick={() => applyPosterStyle('magazine')}>
                Magazine chaos
              </button>
              <button type="button" onClick={() => applyPosterStyle('type')}>
                Oversized type
              </button>
              <button type="button" onClick={() => applyPosterStyle('image')}>
                Image fracture
              </button>
              <button type="button" onClick={() => applyPosterStyle('minimal')}>
                B/W red
              </button>
            </div>
          </div>

          <div className="panel-section">
            <h2>Manual Effects</h2>
            <div className="preset-row">
              <button type="button" onClick={addTypeStrip} disabled={!selectedIsText}>
                <Type size={17} />
                Type strip
              </button>
              <button type="button" onClick={() => void distressSelected()} disabled={!selected}>
                <Sparkles size={17} />
                Distress
              </button>
              <button type="button" onClick={addPhotocopyNoise}>
                <ScanLine size={17} />
                Photocopy noise
              </button>
              <button type="button" onClick={() => void tearCollageSelected()} disabled={!selected}>
                <Scissors size={17} />
                Tear collage
              </button>
              <button type="button" onClick={addCropMarks}>
                <Crop size={17} />
                Crop marks/grid
              </button>
            </div>
          </div>

          <div className="panel-section layer-section">
            <div className="panel-title">
              <h2>Layers</h2>
              <Layers size={17} />
            </div>
            <div className="layer-list">
              {layers.map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  className={selected?.id === layer.id ? 'active layer-row' : 'layer-row'}
                  onClick={() => selectLayer(layer.id)}
                >
                  <span>{layer.name}</span>
                  <small>{layer.kind}</small>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="canvas-stage" aria-label="Poster canvas">
          <div className="stage-toolbar">
            <span>{poster.name}</span>
            <span>
              {poster.width} x {poster.height}px
            </span>
            <span>{status}</span>
          </div>
          <div className="canvas-scroll">
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

        <aside className="rail inspector" aria-label="Inspector">
          <div className="panel-section">
            <h2>Project</h2>
            <label>
              Name
              <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
            </label>
            <div className="saved-list">
              {savedProjects.length === 0 ? (
                <p className="empty">No local saves yet.</p>
              ) : (
                savedProjects.map((project) => (
                  <button key={`${project.name}-${project.savedAt}`} type="button" onClick={() => void loadProject(project)}>
                    <span>{project.name}</span>
                    <small>{new Date(project.savedAt).toLocaleString()}</small>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="panel-section">
            <div className="panel-title">
              <h2>Selection</h2>
              <AlignLeft size={17} />
            </div>
            {!selected ? (
              <p className="empty">Select a layer to edit it.</p>
            ) : (
              <div className="control-stack">
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
                          updateActive({ fontFamily: event.target.value })
                          finalizeActive('Changed font')
                        }}
                      >
                        {FONT_STACKS.map((font) => (
                          <option key={font} value={font}>
                            {font}
                          </option>
                        ))}
                      </select>
                    </label>
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
                  onChange={(value) => updateActive({ angle: value })}
                  onCommit={() => finalizeActive('Rotated layer')}
                />
                <Slider
                  label="Opacity"
                  value={Math.round(selected.opacity * 100)}
                  min={5}
                  max={100}
                  onChange={(value) => updateActive({ opacity: value / 100 })}
                  onCommit={() => finalizeActive('Changed opacity')}
                />
                <Slider
                  label="Stretch X"
                  value={Math.round(selected.scaleX * 100)}
                  min={20}
                  max={320}
                  onChange={(value) => updateActive({ scaleX: value / 100 })}
                  onCommit={() => finalizeActive('Stretched layer')}
                />
                <Slider
                  label="Stretch Y"
                  value={Math.round(selected.scaleY * 100)}
                  min={20}
                  max={320}
                  onChange={(value) => updateActive({ scaleY: value / 100 })}
                  onCommit={() => finalizeActive('Stretched layer')}
                />
                <Slider
                  label="Skew X"
                  value={selected.skewX ?? 0}
                  min={-45}
                  max={45}
                  onChange={(value) => updateActive({ skewX: value })}
                  onCommit={() => finalizeActive('Skewed layer')}
                />
                <label>
                  Color
                  <input
                    type="color"
                    value={typeof selected.fill === 'string' ? selected.fill : '#111111'}
                    onChange={(event) => updateActive({ fill: event.target.value })}
                    onBlur={() => finalizeActive('Changed color')}
                    disabled={selectedIsImage}
                  />
                </label>
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
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="button-row">
                  <button type="button" onClick={() => moveLayer('front')}>
                    <BringToFront size={16} />
                    Front
                  </button>
                  <button type="button" onClick={() => moveLayer('back')}>
                    <SendToBack size={16} />
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="panel-section">
            <h2>Image Effects</h2>
            <div className="preset-row">
              {(['grayscale', 'contrast', 'threshold', 'blur', 'noise', 'clear'] as const).map((effect) => (
                <button key={effect} type="button" onClick={() => applyImageEffect(effect)} disabled={!selectedIsImage}>
                  {effect}
                </button>
              ))}
            </div>
          </div>

          <div className="panel-section">
            <h2>Assets</h2>
            {assets.length === 0 ? (
              <p className="empty">Imported images appear here.</p>
            ) : (
              <ul className="asset-list">
                {assets.map((asset) => (
                  <li key={asset}>{asset}</li>
                ))}
              </ul>
            )}
          </div>
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
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  onCommit: () => void
}) {
  return (
    <label>
      <span className="slider-label">
        {label}
        <strong>{Math.round(value)}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
      />
    </label>
  )
}

function readProjects(): SavedProject[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function readObjectProp(object: FabricObject | null, key: string) {
  if (!object) return undefined
  return (object as unknown as Record<string, unknown>)[key]
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
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
