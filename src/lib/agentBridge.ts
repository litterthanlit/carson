/**
 * The editor's end of the agent bridge: dial the agent's loopback socket, say hello, and answer
 * its requests one at a time. Handlers live in `useAgentBridge`; this file is transport and
 * the pure pieces around it.
 */
import {
  AGENT_CLOSE_PROTOCOL,
  AGENT_CLOSE_REPLACED,
  AGENT_DEFAULT_PORT,
  AGENT_PROTOCOL,
  isAgentMethod,
  type AgentChange,
  type AgentHello,
  type AgentMethod,
  type AgentParams,
  type AgentResponse,
  type AgentResult,
  type AgentTreatment,
} from './agentProtocol'

/** localStorage key for the Connect agent toggle; holds what `?agent=` would. */
export const AGENT_BRIDGE_KEY = 'carson.agent.v1'

/** Commands that open a dialog, ask the designer for a name, or arm a tool they finish by hand. */
export const INTERACTIVE_COMMANDS: ReadonlySet<string> = new Set([
  'save-component',
  'gesture-save-performance',
  'new-poster',
  'open-poster',
  'save-as',
  'filter-gallery',
  'texture-gallery',
  'comps-gallery',
  'distort',
  'warp',
  'pen-tool',
  'frame-tool',
  'paint-mask',
])

/** Commands about the agent bridge itself; an agent cannot run them on its own socket. */
export const BRIDGE_COMMANDS: ReadonlySet<string> = new Set(['agent-connect', 'agent-disconnect'])

export type AgentBridgeStatus = 'off' | 'connecting' | 'connected' | 'replaced' | 'incompatible'

export type AgentHandlers = { [M in AgentMethod]: (params: AgentParams<M>) => Promise<AgentResult<M>> }

/**
 * Where the editor dials: `?agent` (default port), `?agent=7420`, `?agent=ws://host:port`,
 * otherwise whatever the Connect agent command remembered. `?agent=off` dials nothing.
 */
export function agentBridgeUrl(search: string, remembered: string | null): string | null {
  const params = new URLSearchParams(search)
  const value = params.has('agent') ? (params.get('agent') ?? '') : remembered
  if (value === null || value === 'off') return null
  return agentSocketUrl(value)
}

export function agentSocketUrl(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === '') return `ws://127.0.0.1:${AGENT_DEFAULT_PORT}`
  if (/^\d+$/.test(trimmed)) {
    const port = Number(trimmed)
    return port > 0 && port < 65536 ? `ws://127.0.0.1:${port}` : null
  }
  return /^wss?:\/\/[^\s]+$/.test(trimmed) ? trimmed : null
}

/** Run one request through the handlers. Anything that is not a request gets no answer. */
export async function answerAgentRequest(handlers: AgentHandlers, raw: unknown): Promise<AgentResponse | null> {
  if (!raw || typeof raw !== 'object') return null
  const message = raw as { type?: unknown; id?: unknown; method?: unknown; params?: unknown }
  if (message.type !== 'request' || typeof message.id !== 'number') return null
  const { id } = message
  if (!isAgentMethod(message.method)) {
    return { type: 'response', id, ok: false, error: `Carson does not know the method "${String(message.method)}".` }
  }
  const handler = handlers[message.method] as (params: unknown) => Promise<unknown>
  try {
    const result = await handler(message.params ?? {})
    return { type: 'response', id, ok: true, result }
  } catch (error) {
    return { type: 'response', id, ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export type AgentSocket = {
  readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
  onopen: (() => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onclose: ((event: { code: number }) => void) | null
}

const SOCKET_OPEN = 1
const RETRY_MAX_MS = 10_000

/** Dial `url` and keep dialing until stopped, replaced by another window, or refused as incompatible. */
export function connectAgentBridge(options: {
  url: string
  handlers: () => AgentHandlers
  title: () => string
  onStatus: (status: AgentBridgeStatus) => void
  createSocket?: (url: string) => AgentSocket
}): () => void {
  const createSocket = options.createSocket ?? ((url: string) => new WebSocket(url) as unknown as AgentSocket)
  let socket: AgentSocket | null = null
  let stopped = false
  let retry = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let queue: Promise<void> = Promise.resolve()

  const dial = () => {
    if (stopped) return
    options.onStatus('connecting')
    const current = createSocket(options.url)
    socket = current
    current.onopen = () => {
      retry = 0
      const hello: AgentHello = { type: 'hello', app: 'carson', protocol: AGENT_PROTOCOL, title: options.title() }
      current.send(JSON.stringify(hello))
      options.onStatus('connected')
    }
    current.onmessage = (event) => {
      let raw: unknown
      try {
        raw = JSON.parse(String(event.data))
      } catch {
        return
      }
      // One move at a time: the next request waits until the canvas settles from this one.
      queue = queue.then(async () => {
        const response = await answerAgentRequest(options.handlers(), raw)
        if (response && current.readyState === SOCKET_OPEN) current.send(JSON.stringify(response))
      })
    }
    current.onclose = (event) => {
      if (socket !== current) return
      socket = null
      if (stopped) return
      if (event.code === AGENT_CLOSE_REPLACED || event.code === AGENT_CLOSE_PROTOCOL) {
        options.onStatus(event.code === AGENT_CLOSE_REPLACED ? 'replaced' : 'incompatible')
        return
      }
      options.onStatus('connecting')
      const delay = Math.min(RETRY_MAX_MS, 1000 * 2 ** retry)
      retry += 1
      timer = setTimeout(dial, delay)
    }
  }

  dial()
  return () => {
    stopped = true
    if (timer !== null) clearTimeout(timer)
    const current = socket
    socket = null
    current?.close()
    options.onStatus('off')
  }
}

/** Treatments per layer (and on the poster) before and after a move. */
export type AgentSnapshot = {
  layers: Map<string, AgentTreatment[]>
  poster: AgentTreatment[]
}

export function diffAgentSnapshots(
  before: AgentSnapshot,
  after: AgentSnapshot,
): Pick<AgentChange, 'addedLayers' | 'removedLayers' | 'addedTreatments'> {
  const addedLayers = [...after.layers.keys()].filter((id) => !before.layers.has(id))
  const removedLayers = [...before.layers.keys()].filter((id) => !after.layers.has(id))
  const addedTreatments: AgentChange['addedTreatments'] = []
  for (const [layerId, treatments] of after.layers) {
    const known = new Set((before.layers.get(layerId) ?? []).map((item) => item.id))
    for (const treatment of treatments) if (!known.has(treatment.id)) addedTreatments.push({ layerId, treatment })
  }
  const knownPoster = new Set(before.poster.map((item) => item.id))
  for (const treatment of after.poster) {
    if (!knownPoster.has(treatment.id)) addedTreatments.push({ layerId: null, treatment })
  }
  return { addedLayers, removedLayers, addedTreatments }
}
