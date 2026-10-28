/**
 * Wire protocol between the editor and an agent (the MCP server in `mcp/`).
 *
 * The editor dials out to the agent over a loopback WebSocket and says hello. The agent then
 * sends requests one at a time; the editor answers each through the same handlers the
 * designer's own clicks use, so every agent move lands on the exploration trail and undoes
 * with Cmd+Z. Types only: Node imports this file directly, so nothing here touches the DOM.
 */
import type { PosterPresetId } from './editorModel'

export const AGENT_PROTOCOL = 1
export const AGENT_DEFAULT_PORT = 7417

/** Close code for an editor window that another Carson window replaced. It must not redial. */
export const AGENT_CLOSE_REPLACED = 4001
/** Close code for an editor that spoke a different protocol version. */
export const AGENT_CLOSE_PROTOCOL = 4002

export type AgentTreatment = {
  id: string
  type: string
  label: string
  enabled: boolean
  seed: number
  params: Record<string, number>
}

export type AgentBounds = { left: number; top: number; width: number; height: number }

export type AgentLayer = {
  id: string
  name: string
  kind: string
  parentId: string | null
  depth: number
  selected: boolean
  visible: boolean
  locked: boolean
  bounds: AgentBounds
  angle: number
  opacity: number
  blendMode: string
  fill?: string
  text?: string
  fontFamily?: string
  fontSize?: number
  fontWeight?: string | number
  treatments: AgentTreatment[]
}

export type AgentCommand = {
  id: string
  label: string
  scope: 'selection' | 'canvas' | 'any'
  enabled: boolean
  /** Opens a dialog, asks the designer for a name, or arms a tool they finish by hand. */
  interactive: boolean
  keywords: string[]
}

export type AgentTrailFrame = { opId: string; label: string; current: boolean }

export type AgentSavedPoster = { id: string; name: string; savedAt: string }

export type AgentState = {
  screen: 'home' | 'editor'
  project: { id: string; name: string; dirty: boolean }
  poster: { preset: PosterPresetId; width: number; height: number }
  status: string
  /** 0 composed … 100 wild; scales every instrument's intensity. */
  tension: number
  selection: string[]
  layerCount: number
  posterTreatments: AgentTreatment[]
  trail: { frames: AgentTrailFrame[]; canUndo: boolean; canRedo: boolean }
  lastChaos: { label: string; seed: number } | null
  recordingGesture: boolean
  savedPosters: AgentSavedPoster[]
}

/** What one agent move did, so the agent can aim the next one without re-reading everything. */
export type AgentChange = {
  status: string
  selection: string[]
  addedLayers: string[]
  removedLayers: string[]
  addedTreatments: Array<{ layerId: string | null; treatment: AgentTreatment }>
  trailHead: string | null
}

export type AgentTextSpec = {
  text: string
  name?: string
  left?: number
  top?: number
  width?: number
  fontFamily?: string
  fontSize?: number
  fontWeight?: number
  fill?: string
  angle?: number
  lineHeight?: number
  charSpacing?: number
}

export type AgentLayerPatch = {
  name?: string
  text?: string
  left?: number
  top?: number
  angle?: number
  opacity?: number
  scaleX?: number
  scaleY?: number
  fill?: string
  fontFamily?: string
  fontSize?: number
  fontWeight?: number
  charSpacing?: number
  lineHeight?: number
  blendMode?: string
  visible?: boolean
  locked?: boolean
}

export type AgentTreatmentAction = 'reroll' | 'bypass' | 'enable' | 'remove' | 'set-params'

export type AgentStartIntent =
  | { kind: 'wreck' }
  | { kind: 'blank'; preset: PosterPresetId; width?: number; height?: number }
  | { kind: 'open'; projectId: string }

export type AgentRender = { mimeType: 'image/png' | 'image/jpeg'; data: string; width: number; height: number }

export type AgentCatalog = {
  fonts: Array<{ family: string; category: string; weights: number[] }>
  presets: Array<{ id: PosterPresetId; name: string; width: number; height: number }>
  blendModes: Array<{ value: string; label: string }>
  instruments: Array<{ id: string; name: string; treatmentType: string; scope: string; defaultParams: Record<string, number> }>
}

type None = Record<string, never>

export type AgentMethods = {
  state: { params: None; result: AgentState }
  layers: { params: None; result: AgentLayer[] }
  commands: { params: None; result: AgentCommand[] }
  catalog: { params: None; result: AgentCatalog }
  select: { params: { layerIds: string[] }; result: AgentChange }
  run: { params: { command: string; layerIds?: string[] }; result: AgentChange }
  addText: { params: AgentTextSpec; result: AgentChange }
  updateLayer: { params: { layerId: string; patch: AgentLayerPatch }; result: AgentChange }
  treatment: {
    params: { layerId?: string; treatmentId: string; action: AgentTreatmentAction; params?: Record<string, number> }
    result: AgentChange
  }
  tension: { params: { value: number }; result: AgentChange }
  history: { params: { action: 'undo' | 'redo' | 'jump'; opId?: string; steps?: number }; result: AgentChange }
  render: { params: { scale?: number; maxEdge?: number; format?: 'png' | 'jpeg' }; result: AgentRender }
  start: { params: AgentStartIntent; result: AgentState }
  save: { params: { name?: string }; result: AgentChange }
  placeImage: { params: { name: string; dataUrl: string; fill?: boolean }; result: AgentChange }
}

export type AgentMethod = keyof AgentMethods
export type AgentParams<M extends AgentMethod> = AgentMethods[M]['params']
export type AgentResult<M extends AgentMethod> = AgentMethods[M]['result']

export const AGENT_METHODS: readonly AgentMethod[] = [
  'state',
  'layers',
  'commands',
  'catalog',
  'select',
  'run',
  'addText',
  'updateLayer',
  'treatment',
  'tension',
  'history',
  'render',
  'start',
  'save',
  'placeImage',
]

export type AgentRequest<M extends AgentMethod = AgentMethod> = {
  type: 'request'
  id: number
  method: M
  params: AgentParams<M>
}

export type AgentResponse =
  | { type: 'response'; id: number; ok: true; result: unknown }
  | { type: 'response'; id: number; ok: false; error: string }

export type AgentHello = { type: 'hello'; app: 'carson'; protocol: number; title: string }

/** Everything the editor sends: one hello, then one response per request. */
export type AgentEditorMessage = AgentHello | AgentResponse

export function isAgentMethod(value: unknown): value is AgentMethod {
  return typeof value === 'string' && (AGENT_METHODS as readonly string[]).includes(value)
}
