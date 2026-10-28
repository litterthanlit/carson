import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  agentBridgeUrl,
  answerAgentRequest,
  connectAgentBridge,
  diffAgentSnapshots,
  type AgentBridgeStatus,
  type AgentHandlers,
  type AgentSocket,
} from './agentBridge'
import { AGENT_CLOSE_REPLACED, AGENT_PROTOCOL, type AgentTreatment } from './agentProtocol'

function treatment(id: string): AgentTreatment {
  return { id, type: 'xerox', label: 'Xerox·5', enabled: true, seed: 1234, params: { generation: 5 } }
}

class FakeSocket implements AgentSocket {
  readyState = 0
  sent: unknown[] = []
  closedWith: number | undefined
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: ((event: { code: number }) => void) | null = null
  send(data: string) {
    this.sent.push(JSON.parse(data))
  }
  close(code?: number) {
    this.closedWith = code
    this.readyState = 3
  }
  open() {
    this.readyState = 1
    this.onopen?.()
  }
  receive(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) })
  }
  drop(code: number) {
    this.readyState = 3
    this.onclose?.({ code })
  }
}

const handlers = (overrides: Partial<AgentHandlers>) => overrides as AgentHandlers

describe('agent bridge url', () => {
  it('dials the default port for a bare ?agent and the given port or url otherwise', () => {
    expect(agentBridgeUrl('?agent', null)).toBe('ws://127.0.0.1:7417')
    expect(agentBridgeUrl('?agent=7420', null)).toBe('ws://127.0.0.1:7420')
    expect(agentBridgeUrl('?agent=ws://studio.local:9000', null)).toBe('ws://studio.local:9000')
  })

  it('falls back to the remembered toggle, and ?agent=off or nothing dials nothing', () => {
    expect(agentBridgeUrl('', '')).toBe('ws://127.0.0.1:7417')
    expect(agentBridgeUrl('', '7421')).toBe('ws://127.0.0.1:7421')
    expect(agentBridgeUrl('?agent=off', '7421')).toBeNull()
    expect(agentBridgeUrl('', null)).toBeNull()
  })

  it('refuses values that are not a port or a websocket url', () => {
    expect(agentBridgeUrl('?agent=99999', null)).toBeNull()
    expect(agentBridgeUrl('?agent=http://evil.example', null)).toBeNull()
  })
})

describe('answering agent requests', () => {
  it('runs the named handler with its params', async () => {
    const state = vi.fn(async () => ({ screen: 'home' }))
    const response = await answerAgentRequest(handlers({ state } as never), { type: 'request', id: 4, method: 'state', params: {} })
    expect(state).toHaveBeenCalledWith({})
    expect(response).toEqual({ type: 'response', id: 4, ok: true, result: { screen: 'home' } })
  })

  it('turns a thrown error into an error response the agent can read', async () => {
    const run = vi.fn(async () => {
      throw new Error('"Scatter" needs a selection')
    })
    expect(await answerAgentRequest(handlers({ run }), { type: 'request', id: 5, method: 'run', params: { command: 'scatter' } })).toEqual({
      type: 'response',
      id: 5,
      ok: false,
      error: '"Scatter" needs a selection',
    })
  })

  it('refuses unknown methods and ignores anything that is not a request', async () => {
    const unknown = await answerAgentRequest(handlers({}), { type: 'request', id: 6, method: 'eval', params: {} })
    expect(unknown).toMatchObject({ id: 6, ok: false })
    expect(await answerAgentRequest(handlers({}), { type: 'hello' })).toBeNull()
    expect(await answerAgentRequest(handlers({}), 'state')).toBeNull()
  })
})

describe('connecting the bridge', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('says hello on open and answers requests in the order they arrive', async () => {
    const sockets: FakeSocket[] = []
    const statuses: AgentBridgeStatus[] = []
    const order: string[] = []
    let releaseFirst = () => {}
    const run = vi.fn(async ({ command }: { command: string }) => {
      if (command === 'slow') await new Promise<void>((resolve) => (releaseFirst = resolve))
      order.push(command)
      return { status: command }
    })
    const stop = connectAgentBridge({
      url: 'ws://127.0.0.1:7417',
      handlers: () => handlers({ run } as never),
      title: () => 'Untitled poster',
      onStatus: (status) => statuses.push(status),
      createSocket: () => {
        const socket = new FakeSocket()
        sockets.push(socket)
        return socket
      },
    })
    const socket = sockets[0]!
    socket.open()
    expect(socket.sent[0]).toEqual({ type: 'hello', app: 'carson', protocol: AGENT_PROTOCOL, title: 'Untitled poster' })
    expect(statuses).toEqual(['connecting', 'connected'])

    socket.receive({ type: 'request', id: 1, method: 'run', params: { command: 'slow' } })
    socket.receive({ type: 'request', id: 2, method: 'run', params: { command: 'fast' } })
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1))
    releaseFirst()
    await vi.waitFor(() => expect(socket.sent).toHaveLength(3))
    expect(order).toEqual(['slow', 'fast'])
    expect(socket.sent.slice(1).map((message) => (message as { id: number }).id)).toEqual([1, 2])
    stop()
    expect(statuses.at(-1)).toBe('off')
  })

  it('redials after a drop, and stays down once another window takes over', () => {
    vi.useFakeTimers()
    const sockets: FakeSocket[] = []
    const statuses: AgentBridgeStatus[] = []
    connectAgentBridge({
      url: 'ws://127.0.0.1:7417',
      handlers: () => handlers({}),
      title: () => 'Poster',
      onStatus: (status) => statuses.push(status),
      createSocket: () => {
        const socket = new FakeSocket()
        sockets.push(socket)
        return socket
      },
    })
    sockets[0]!.drop(1006)
    vi.advanceTimersByTime(1000)
    expect(sockets).toHaveLength(2)
    sockets[1]!.open()
    sockets[1]!.drop(AGENT_CLOSE_REPLACED)
    vi.advanceTimersByTime(60_000)
    expect(sockets).toHaveLength(2)
    expect(statuses.at(-1)).toBe('replaced')
  })
})

describe('what a move changed', () => {
  it('reports new and removed layers and new treatments on layers and the poster', () => {
    const before = { layers: new Map([['text-1', [treatment('a')]], ['shape-2', []]]), poster: [] }
    const after = {
      layers: new Map([
        ['text-1', [treatment('a'), treatment('b')]],
        ['fragment-3', []],
      ]),
      poster: [treatment('press')],
    }
    expect(diffAgentSnapshots(before, after)).toEqual({
      addedLayers: ['fragment-3'],
      removedLayers: ['shape-2'],
      addedTreatments: [
        { layerId: 'text-1', treatment: treatment('b') },
        { layerId: null, treatment: treatment('press') },
      ],
    })
  })
})
