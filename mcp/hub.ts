/**
 * The agent's end of the bridge: a loopback WebSocket the Carson editor dials into.
 * One editor window at a time; a newer window replaces the older one.
 */
import { WebSocketServer, type WebSocket } from 'ws'
import {
  AGENT_CLOSE_PROTOCOL,
  AGENT_CLOSE_REPLACED,
  AGENT_PROTOCOL,
  type AgentEditorMessage,
  type AgentMethod,
  type AgentParams,
  type AgentResult,
} from '../src/lib/agentProtocol.ts'

export const NOT_CONNECTED =
  'No Carson editor is connected. Ask the designer to open the command palette (⌘K) and run "Connect agent", ' +
  'or to open Carson with ?agent in the URL. Or call carson_open_editor to open an editor window yourself.'

const HELLO_TIMEOUT_MS = 5_000
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000
const MAX_MESSAGE_BYTES = 256 * 1024 * 1024

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * Pages served from this machine may dial in, and so may local processes that send no Origin.
 * A site on the open web cannot: its Origin names its own host.
 */
export function isAllowedOrigin(origin: string | undefined, extra: readonly string[] = []): boolean {
  if (!origin || origin === 'null' || origin.startsWith('file://')) return true
  if (extra.includes(origin)) return true
  try {
    return LOOPBACK_HOSTS.has(new URL(origin).hostname)
  } catch {
    return false
  }
}

export type EditorInfo = { title: string; origin: string | null; connectedAt: Date }

type Pending = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class EditorHub {
  readonly port: number
  readonly host: string
  private readonly extraOrigins: readonly string[]
  private server: WebSocketServer | null = null
  private editor: { socket: WebSocket; info: EditorInfo } | null = null
  private readonly pending = new Map<number, Pending>()
  private nextId = 1
  private waiters: Array<() => void> = []
  /** Why the hub is not listening (port taken, for example), or null. */
  listenError: string | null = null

  constructor(options: { port: number; host?: string; extraOrigins?: readonly string[] }) {
    this.port = options.port
    this.host = options.host ?? '127.0.0.1'
    this.extraOrigins = options.extraOrigins ?? []
  }

  get address() {
    return `ws://${this.host}:${this.port}`
  }

  get editorInfo(): EditorInfo | null {
    return this.editor?.info ?? null
  }

  listen(): Promise<void> {
    return new Promise((resolve) => {
      const server = new WebSocketServer({
        host: this.host,
        port: this.port,
        maxPayload: MAX_MESSAGE_BYTES,
        verifyClient: ({ origin }: { origin?: string }) => isAllowedOrigin(origin, this.extraOrigins),
      })
      server.once('listening', () => {
        this.server = server
        this.listenError = null
        resolve()
      })
      server.once('error', (error: NodeJS.ErrnoException) => {
        this.listenError =
          error.code === 'EADDRINUSE'
            ? `Port ${this.port} is taken, most likely by another Carson MCP server. Close that agent session, or set CARSON_AGENT_PORT to a free port and open Carson with ?agent=<port>.`
            : `The bridge could not listen on ${this.address}: ${error.message}`
        resolve()
      })
      server.on('connection', (socket, request) => this.accept(socket, request.headers.origin ?? null))
    })
  }

  /** Resolves true once an editor has said hello, false after `timeoutMs`. */
  waitForEditor(timeoutMs: number): Promise<boolean> {
    if (this.editor) return Promise.resolve(true)
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer)
        resolve(true)
      }
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((waiter) => waiter !== done)
        resolve(false)
      }, timeoutMs)
      this.waiters.push(done)
    })
  }

  request<M extends AgentMethod>(
    method: M,
    params: AgentParams<M>,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  ): Promise<AgentResult<M>> {
    if (this.listenError) return Promise.reject(new Error(this.listenError))
    const editor = this.editor
    if (!editor) return Promise.reject(new Error(NOT_CONNECTED))
    const id = this.nextId++
    return new Promise<AgentResult<M>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Carson did not answer "${method}" within ${Math.round(timeoutMs / 1000)}s. The editor may be busy or waiting on the designer.`))
      }, timeoutMs)
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer })
      editor.socket.send(JSON.stringify({ type: 'request', id, method, params }))
    })
  }

  async close() {
    this.failPending('The Carson MCP server is shutting down.')
    this.editor?.socket.close()
    this.editor = null
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()))
    this.server = null
  }

  private accept(socket: WebSocket, origin: string | null) {
    const helloTimer = setTimeout(() => socket.close(), HELLO_TIMEOUT_MS)
    let greeted = false
    socket.on('message', (data) => {
      let message: AgentEditorMessage
      try {
        message = JSON.parse(String(data)) as AgentEditorMessage
      } catch {
        return
      }
      if (!greeted) {
        if (message.type !== 'hello' || message.app !== 'carson') return
        clearTimeout(helloTimer)
        if (message.protocol !== AGENT_PROTOCOL) {
          socket.close(AGENT_CLOSE_PROTOCOL, `This MCP server speaks protocol ${AGENT_PROTOCOL}`)
          return
        }
        greeted = true
        this.adopt(socket, { title: message.title, origin, connectedAt: new Date() })
        return
      }
      if (message.type !== 'response') return
      const pending = this.pending.get(message.id)
      if (!pending) return
      this.pending.delete(message.id)
      clearTimeout(pending.timer)
      if (message.ok) pending.resolve(message.result)
      else pending.reject(new Error(message.error))
    })
    socket.on('close', () => {
      clearTimeout(helloTimer)
      if (this.editor?.socket !== socket) return
      this.editor = null
      this.failPending('The Carson editor disconnected before it answered.')
    })
    socket.on('error', () => socket.close())
  }

  private adopt(socket: WebSocket, info: EditorInfo) {
    const previous = this.editor
    this.editor = { socket, info }
    if (previous) {
      this.failPending('Another Carson window took over the agent before this one answered.')
      previous.socket.close(AGENT_CLOSE_REPLACED, 'Another Carson window took over the agent')
    }
    for (const waiter of this.waiters.splice(0)) waiter()
  }

  private failPending(reason: string) {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(new Error(reason))
      this.pending.delete(id)
    }
  }
}
