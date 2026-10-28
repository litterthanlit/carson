import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { ActiveSelection, type Canvas, type FabricObject } from 'fabric'
import {
  AGENT_BRIDGE_KEY,
  BRIDGE_COMMANDS,
  INTERACTIVE_COMMANDS,
  agentBridgeUrl,
  agentSocketUrl,
  connectAgentBridge,
  diffAgentSnapshots,
  type AgentBridgeStatus,
  type AgentHandlers,
  type AgentSnapshot,
} from '../lib/agentBridge'
import type { AgentChange, AgentLayer, AgentState, AgentTextSpec, AgentTreatment } from '../lib/agentProtocol'
import { readObjectProp } from '../lib/canvasUtils'
import { FULL_BLEND_MODES, isBlendMode } from '../lib/color'
import type { CommandAction } from '../lib/commands'
import { applyPosterPreset, getPosterPreset, type PosterPreset } from '../lib/editorModel'
import { activeTrailFrame, type TrailFrame } from '../lib/explorationTrail'
import { FONT_LIBRARY, ensureLibraryFonts } from '../lib/fonts'
import type { HistoryState } from '../lib/historyLog'
import { INSTRUMENTS } from '../lib/instruments'
import { findObjectInTree, flattenLayerTree, topLevelLayer } from '../lib/layerGroups'
import type { StoredProject } from '../lib/storage'
import { readTreatments, treatmentLabel, type Treatment } from '../lib/treatments'
import type { SelectedState } from '../types/editor'

export type AgentEditorIntent =
  | { kind: 'seed' }
  | { kind: 'blank'; preset: PosterPreset }
  | { kind: 'project'; project: StoredProject }

type TreatmentActions = {
  reroll: (treatmentId: string) => Promise<void>
  toggle: (treatmentId: string) => Promise<void>
  remove: (treatmentId: string) => Promise<void>
  setParams: (treatmentId: string, params: Record<string, number>) => Promise<void>
}

/** What the editor hands the bridge each render. Read through a ref, so handlers see the latest. */
export type AgentBridgeDeps = {
  canvasRef: RefObject<Canvas | null>
  screen: 'home' | 'editor'
  projectId: string
  projectName: string
  dirty: boolean
  poster: PosterPreset
  status: string
  tension: number
  posterTreatments: Treatment[]
  trailFrames: TrailFrame[]
  trailOpIds: string[]
  trailCursor: number
  history: () => HistoryState
  lastChaos: { label: string; seed: number } | null
  recordingGesture: boolean
  savedProjects: StoredProject[]
  commands: () => CommandAction[]
  describeLayer: (object: FabricObject) => SelectedState
  syncSelected: () => void
  addText: (spec: AgentTextSpec) => void
  updateActive: (values: Partial<SelectedState>) => void
  finalizeActive: (message: string) => void
  renameLayer: (id: string, name: string) => void
  toggleLayerVisibility: (id: string) => void
  toggleLayerLock: (id: string) => void
  layerTreatments: Omit<TreatmentActions, 'remove'> & { remove: (treatmentId: string, object: FabricObject) => Promise<void> }
  posterTreatmentActions: TreatmentActions
  setTension: (value: number) => void
  commitTension: () => Promise<void>
  undo: () => Promise<void>
  redo: () => void
  jumpToOpId: (opId: string) => Promise<void>
  rasterize: (scale: number) => Promise<HTMLCanvasElement>
  confirmIfDirty: (reason: 'new' | 'open') => Promise<boolean>
  startEditor: (intent: AgentEditorIntent) => void
  save: () => Promise<void>
  saveAs: (name: string) => Promise<void>
  placeImage: (file: File, options: { fill?: boolean }) => Promise<void>
}

const NO_POSTER = 'No poster is open. Start a new poster or open a saved one first.'
const QUIET_POLL_MS = 100
const QUIET_MAX_MS = 15_000
const START_MAX_MS = 30_000

function idOf(object: FabricObject) {
  return String(readObjectProp(object, 'id') ?? '')
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function toAgentTreatment(treatment: Treatment): AgentTreatment {
  return {
    id: treatment.id,
    type: treatment.type,
    label: treatmentLabel(treatment),
    enabled: treatment.enabled,
    seed: treatment.seed,
    params: { ...treatment.params },
  }
}

function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function readRemembered(): string | null {
  try {
    return localStorage.getItem(AGENT_BRIDGE_KEY)
  } catch {
    return null
  }
}

function remember(value: string | null) {
  try {
    if (value === null) localStorage.removeItem(AGENT_BRIDGE_KEY)
    else localStorage.setItem(AGENT_BRIDGE_KEY, value)
  } catch {
    /* the toggle still works for this session */
  }
}

/**
 * Lets an agent (the Carson MCP server) play the editor: the same commands, selections and
 * treatment chips the designer uses, each committed to history and the trail.
 */
export function useAgentBridge(deps: AgentBridgeDeps) {
  const depsRef = useRef(deps)
  depsRef.current = deps
  const [url, setUrl] = useState(() => agentBridgeUrl(window.location.search, readRemembered()))
  // Bumped by Connect agent so the same url dials again (taking the agent back from another window).
  const [dial, setDial] = useState(0)
  const [status, setStatus] = useState<AgentBridgeStatus>('off')

  // settle() resolves once React has rendered past every state change made so far, so the
  // next step reads commands and selection that match the canvas.
  const [settleTick, setSettleTick] = useState(0)
  const settleWaitersRef = useRef<Array<() => void>>([])
  useEffect(() => {
    for (const resolve of settleWaitersRef.current.splice(0)) resolve()
  }, [settleTick])
  const settle = useCallback(
    () =>
      new Promise<void>((resolve) => {
        settleWaitersRef.current.push(resolve)
        setSettleTick((tick) => tick + 1)
      }),
    [],
  )

  const handlersRef = useRef<AgentHandlers | null>(null)
  if (!handlersRef.current) handlersRef.current = createHandlers(depsRef, settle)

  useEffect(() => {
    if (!url) return
    return connectAgentBridge({
      url,
      handlers: () => handlersRef.current!,
      title: () => depsRef.current.projectName,
      onStatus: setStatus,
    })
  }, [url, dial])

  const connect = useCallback(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('agent')
    const value = fromUrl && fromUrl !== 'off' ? fromUrl : (readRemembered() ?? '')
    remember(value)
    setUrl(agentSocketUrl(value) ?? agentSocketUrl(''))
    setDial((count) => count + 1)
  }, [])

  const disconnect = useCallback(() => {
    remember(null)
    setUrl(null)
  }, [])

  return { status, connect, disconnect }
}

function createHandlers(depsRef: RefObject<AgentBridgeDeps>, settle: () => Promise<void>): AgentHandlers {
  const d = () => depsRef.current

  function requireCanvas(): Canvas {
    const canvas = d().canvasRef.current
    if (d().screen !== 'editor' || !canvas) throw new Error(NO_POSTER)
    return canvas
  }

  function findLayer(canvas: Canvas, id: string): FabricObject {
    const object = findObjectInTree(canvas.getObjects(), id)
    if (!object) throw new Error(`No layer "${id}". List the layers to see the ids on this poster.`)
    return object
  }

  /** The layer itself must be selectable on its own, not only through the group it sits in. */
  function findTopLayer(canvas: Canvas, id: string): FabricObject {
    const object = findLayer(canvas, id)
    const top = topLevelLayer(object)
    if (top !== object) {
      throw new Error(`Layer "${id}" sits inside group "${idOf(top)}". Edit the group, or ungroup it first.`)
    }
    return object
  }

  function selectionIds(canvas: Canvas) {
    return canvas.getActiveObjects().map(idOf).filter(Boolean)
  }

  function selectLayers(canvas: Canvas, ids: string[]) {
    if (ids.length === 0) {
      canvas.discardActiveObject()
    } else {
      const objects = [...new Set(ids.map((id) => topLevelLayer(findLayer(canvas, id))))]
      canvas.setActiveObject(objects.length === 1 ? objects[0]! : new ActiveSelection(objects, { canvas }))
    }
    canvas.requestRenderAll()
    d().syncSelected()
  }

  function snapshot(): AgentSnapshot {
    const canvas = d().canvasRef.current
    const layers = new Map<string, AgentTreatment[]>()
    if (canvas && d().screen === 'editor') {
      for (const row of flattenLayerTree(canvas.getObjects())) {
        layers.set(row.id, readTreatments(row.object).map(toAgentTreatment))
      }
    }
    return { layers, poster: d().posterTreatments.map(toAgentTreatment) }
  }

  /** Wait until history stops moving: chained commits and async renders have landed. */
  async function quiet() {
    const started = Date.now()
    let last = d().history()
    let stable = 0
    while (stable < 2 && Date.now() - started < QUIET_MAX_MS) {
      await sleep(QUIET_POLL_MS)
      await settle()
      const next = d().history()
      stable = next === last ? stable + 1 : 0
      last = next
    }
  }

  async function change(perform: () => unknown): Promise<AgentChange> {
    const before = snapshot()
    await perform()
    await settle()
    await quiet()
    const after = snapshot()
    const history = d().history()
    const canvas = d().canvasRef.current
    return {
      ...diffAgentSnapshots(before, after),
      status: d().status,
      selection: canvas ? selectionIds(canvas) : [],
      trailHead: history.ops[history.cursor]?.label ?? null,
    }
  }

  function state(): AgentState {
    const deps = d()
    const canvas = deps.screen === 'editor' ? deps.canvasRef.current : null
    const history = deps.history()
    const active = activeTrailFrame(deps.trailFrames, deps.trailOpIds, deps.trailCursor)
    return {
      screen: deps.screen,
      project: { id: deps.projectId, name: deps.projectName, dirty: deps.dirty },
      poster: { preset: deps.poster.id, width: deps.poster.width, height: deps.poster.height },
      status: deps.status,
      tension: deps.tension,
      selection: canvas ? selectionIds(canvas) : [],
      layerCount: canvas ? flattenLayerTree(canvas.getObjects()).length : 0,
      posterTreatments: deps.posterTreatments.map(toAgentTreatment),
      trail: {
        frames: deps.trailFrames.map((frame) => ({ opId: frame.opId, label: frame.label, current: frame.id === active?.id })),
        canUndo: history.cursor > 0,
        canRedo: history.cursor < history.ops.length - 1,
      },
      lastChaos: deps.lastChaos,
      recordingGesture: deps.recordingGesture,
      savedPosters: deps.savedProjects.map((project) => ({
        id: project.id,
        name: project.name,
        savedAt: project.lastUsedAt ?? project.savedAt,
      })),
    }
  }

  function layer(object: FabricObject, depth: number, parentId: string | null, selected: Set<string>): AgentLayer {
    const view = d().describeLayer(object)
    const rect = object.getBoundingRect()
    return {
      id: view.id,
      name: view.name,
      kind: view.kind,
      parentId,
      depth,
      selected: selected.has(view.id),
      visible: view.visible,
      locked: view.locked,
      bounds: { left: round(rect.left), top: round(rect.top), width: round(rect.width), height: round(rect.height) },
      angle: view.angle,
      opacity: view.opacity,
      blendMode: view.blendMode ?? 'source-over',
      ...(typeof view.fill === 'string' ? { fill: view.fill } : {}),
      ...(view.text !== undefined ? { text: view.text } : {}),
      ...(view.fontFamily !== undefined ? { fontFamily: view.fontFamily } : {}),
      ...(view.fontSize !== undefined ? { fontSize: view.fontSize } : {}),
      ...(view.fontWeight !== undefined ? { fontWeight: view.fontWeight } : {}),
      treatments: readTreatments(object).map(toAgentTreatment),
    }
  }

  async function waitForFreshEditor(before: HistoryState) {
    const started = Date.now()
    while (Date.now() - started < START_MAX_MS) {
      await sleep(QUIET_POLL_MS)
      await settle()
      const deps = d()
      if (deps.screen === 'editor' && deps.canvasRef.current && deps.history() !== before) return
    }
    throw new Error('The poster did not finish opening within 30 seconds.')
  }

  return {
    state: async () => state(),

    layers: async () => {
      const canvas = requireCanvas()
      const selected = new Set(selectionIds(canvas))
      return flattenLayerTree(canvas.getObjects()).map((row) => layer(row.object, row.depth, row.parentId, selected))
    },

    commands: async () =>
      d()
        .commands().filter((command) => !BRIDGE_COMMANDS.has(command.id))
        .map((command) => ({
          id: command.id,
          label: command.label,
          scope: command.scope ?? 'any',
          enabled: !command.disabled,
          interactive: INTERACTIVE_COMMANDS.has(command.id),
          keywords: command.keywords,
        })),

    catalog: async () => ({
      fonts: FONT_LIBRARY.map((font) => ({ family: font.family, category: font.category, weights: font.weights })),
      presets: (['a3', 'a2', 'instagram', 'square'] as const).map((id) => {
        const preset = getPosterPreset(id)
        return { id, name: preset.name, width: preset.width, height: preset.height }
      }),
      blendModes: FULL_BLEND_MODES.map((mode) => ({ ...mode })),
      instruments: INSTRUMENTS.map((instrument) => ({
        id: instrument.id,
        name: instrument.name,
        treatmentType: instrument.treatmentType,
        scope: instrument.scope,
        defaultParams: { ...instrument.defaultParams },
      })),
    }),

    select: async ({ layerIds }) => {
      const canvas = requireCanvas()
      return change(() => selectLayers(canvas, layerIds))
    },

    run: async ({ command, layerIds }) => {
      const canvas = requireCanvas()
      if (BRIDGE_COMMANDS.has(command)) throw new Error('The agent bridge commands are for the designer.')
      if (layerIds) {
        selectLayers(canvas, layerIds)
        await settle()
      }
      const action = d().commands().find((item) => item.id === command)
      if (!action) throw new Error(`No command "${command}". List the commands to see what this poster can run.`)
      if (action.disabled) {
        throw new Error(
          action.scope === 'selection'
            ? `"${action.label}" needs a selection it can act on. Pass layer ids (text layers for type commands).`
            : `"${action.label}" is unavailable on this poster right now.`,
        )
      }
      return change(() => action.run())
    },

    addText: async (spec) => {
      requireCanvas()
      if (!spec.text.trim()) throw new Error('The text is empty.')
      if (spec.fontFamily) await ensureLibraryFonts([spec.fontFamily])
      return change(() => d().addText(definedOnly(spec) as AgentTextSpec))
    },

    updateLayer: async ({ layerId, patch }) => {
      const canvas = requireCanvas()
      const object = findTopLayer(canvas, layerId)
      if (patch.blendMode !== undefined && !isBlendMode(patch.blendMode)) {
        throw new Error(`Unknown blend mode "${patch.blendMode}". The catalog lists them.`)
      }
      if (patch.fontFamily) await ensureLibraryFonts([patch.fontFamily])
      selectLayers(canvas, [layerId])
      await settle()
      const { name, visible, locked, ...props } = definedOnly(patch)
      return change(() => {
        const deps = d()
        if (Object.keys(props).length > 0) {
          deps.updateActive(props as Partial<SelectedState>)
          deps.finalizeActive(`Edited ${String(readObjectProp(object, 'name') ?? 'layer')}`)
        }
        if (name !== undefined) deps.renameLayer(layerId, name)
        if (visible !== undefined && visible !== (object.visible !== false)) deps.toggleLayerVisibility(layerId)
        if (locked !== undefined && locked !== (object.selectable === false)) deps.toggleLayerLock(layerId)
      })
    },

    treatment: async ({ layerId, treatmentId, action, params }) => {
      const canvas = requireCanvas()
      let current: Treatment | undefined
      let actions: TreatmentActions
      if (layerId === undefined) {
        current = d().posterTreatments.find((item) => item.id === treatmentId)
        actions = d().posterTreatmentActions
      } else {
        const object = findTopLayer(canvas, layerId)
        current = readTreatments(object).find((item) => item.id === treatmentId)
        selectLayers(canvas, [layerId])
        await settle()
        const layerActions = d().layerTreatments
        actions = { ...layerActions, remove: (id) => layerActions.remove(id, object) }
      }
      if (!current) {
        throw new Error(
          `No treatment "${treatmentId}" on ${layerId === undefined ? 'the poster' : `layer "${layerId}"`}. List the layers (or read the state for poster treatments) to see treatment ids.`,
        )
      }
      if (action === 'set-params') {
        const unknown = Object.keys(params ?? {}).filter((key) => !(key in current.params))
        if (!params || Object.keys(params).length === 0) throw new Error('set-params needs params.')
        if (unknown.length > 0) {
          throw new Error(`"${current.type}" has no ${unknown.join(', ')}. Its params: ${Object.keys(current.params).join(', ')}.`)
        }
      }
      const target = current
      return change(async () => {
        if (action === 'reroll') await actions.reroll(target.id)
        else if (action === 'remove') await actions.remove(target.id)
        else if (action === 'set-params') await actions.setParams(target.id, params!)
        else if ((action === 'bypass') === target.enabled) await actions.toggle(target.id)
      })
    },

    tension: async ({ value }) => {
      requireCanvas()
      const next = Math.min(100, Math.max(0, Math.round(value)))
      d().setTension(next)
      await settle()
      return change(() => d().commitTension())
    },

    history: async ({ action, opId, steps = 1 }) => {
      requireCanvas()
      return change(async () => {
        if (action === 'jump') {
          if (!opId || !d().trailOpIds.includes(opId)) throw new Error(`No trail step "${opId}". Read the state for trail op ids.`)
          await d().jumpToOpId(opId)
          return
        }
        for (let step = 0; step < Math.max(1, steps); step += 1) {
          const history = d().history()
          if (action === 'undo' ? history.cursor <= 0 : history.cursor >= history.ops.length - 1) break
          if (action === 'undo') await d().undo()
          else d().redo()
          await settle()
        }
      })
    },

    render: async ({ scale, maxEdge, format }) => {
      requireCanvas()
      const { width, height } = d().poster
      const target = scale ?? (maxEdge ?? 1024) / Math.max(width, height)
      const raster = await d().rasterize(Math.min(4, Math.max(0.02, target)))
      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png'
      const dataUrl = raster.toDataURL(mimeType, 0.9)
      return { mimeType, data: dataUrl.slice(dataUrl.indexOf(',') + 1), width: raster.width, height: raster.height }
    },

    start: async (intent) => {
      let next: AgentEditorIntent
      if (intent.kind === 'open') {
        const project = d().savedProjects.find((item) => item.id === intent.projectId)
        if (!project) throw new Error(`No saved poster "${intent.projectId}". The state lists saved posters.`)
        next = { kind: 'project', project }
      } else if (intent.kind === 'blank') {
        next = { kind: 'blank', preset: applyPosterPreset(intent.preset, { width: intent.width, height: intent.height }) }
      } else {
        next = { kind: 'seed' }
      }
      const before = d().history()
      const allowed = await d().confirmIfDirty(intent.kind === 'open' ? 'open' : 'new')
      if (!allowed) throw new Error('The designer kept the current poster (they chose Cancel on Unsaved changes).')
      d().startEditor(next)
      await waitForFreshEditor(before)
      await quiet()
      return state()
    },

    save: async ({ name }) => {
      requireCanvas()
      return change(() => (name ? d().saveAs(name) : d().save()))
    },

    placeImage: async ({ name, dataUrl, fill }) => {
      requireCanvas()
      if (!dataUrl.startsWith('data:image/')) throw new Error(`${name} must arrive as an image data URL.`)
      const blob = await (await fetch(dataUrl)).blob()
      if (!blob.type.startsWith('image/')) throw new Error(`${name} is not an image.`)
      const file = new File([blob], name, { type: blob.type })
      return change(() => d().placeImage(file, { fill }))
    },
  }
}
