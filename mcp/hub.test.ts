import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { AGENT_CLOSE_PROTOCOL, AGENT_CLOSE_REPLACED, AGENT_PROTOCOL } from '../src/lib/agentProtocol'
import { EditorHub, NOT_CONNECTED, isAllowedOrigin } from './hub'
import { ONBOARDING_KEY as LAUNCH_ONBOARDING_KEY, agentPageUrl } from './launch'
import { ONBOARDING_KEY } from '../src/lib/editorConstants'

let hub: EditorHub | null = null
const sockets: WebSocket[] = []

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate()
  await hub?.close()
  hub = null
})

async function startHub(port: number) {
  hub = new EditorHub({ port })
  await hub.listen()
  expect(hub.listenError).toBeNull()
  return hub
}

/** A stand-in editor: dials, says hello, and answers `state` with its title. */
function fakeEditor(port: number, title: string, options: { protocol?: number; origin?: string } = {}) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`, options.origin ? { origin: options.origin } : {})
  sockets.push(socket)
  const closed = new Promise<number>((resolve) => socket.on('close', (code) => resolve(code)))
  socket.on('open', () => socket.send(JSON.stringify({ type: 'hello', app: 'carson', protocol: options.protocol ?? AGENT_PROTOCOL, title })))
  socket.on('message', (data) => {
    const request = JSON.parse(String(data)) as { id: number; method: string }
    if (request.method === 'state') socket.send(JSON.stringify({ type: 'response', id: request.id, ok: true, result: { title } }))
    if (request.method === 'run') socket.send(JSON.stringify({ type: 'response', id: request.id, ok: false, error: 'needs a selection' }))
  })
  return { socket, closed }
}

describe('which pages may dial the bridge', () => {
  it('lets in loopback pages, file pages and local processes', () => {
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true)
    expect(isAllowedOrigin('http://127.0.0.1:4173')).toBe(true)
    expect(isAllowedOrigin('http://[::1]:5173')).toBe(true)
    expect(isAllowedOrigin('null')).toBe(true)
    expect(isAllowedOrigin(undefined)).toBe(true)
  })

  it('keeps out the open web unless named', () => {
    expect(isAllowedOrigin('https://evil.example')).toBe(false)
    expect(isAllowedOrigin('http://localhost.evil.example')).toBe(false)
    expect(isAllowedOrigin('https://studio.example', ['https://studio.example'])).toBe(true)
  })
})

describe('editor hub', () => {
  it('asks the connected editor and returns its answer or its error', async () => {
    const editorHub = await startHub(7461)
    await expect(editorHub.request('state', {})).rejects.toThrow(NOT_CONNECTED)
    fakeEditor(7461, 'Poster A')
    expect(await editorHub.waitForEditor(2_000)).toBe(true)
    expect(editorHub.editorInfo?.title).toBe('Poster A')
    expect(await editorHub.request('state', {})).toEqual({ title: 'Poster A' })
    await expect(editorHub.request('run', { command: 'scatter' })).rejects.toThrow('needs a selection')
  })

  it('hands the bridge to the newest window and tells the older one to stay down', async () => {
    const editorHub = await startHub(7462)
    const first = fakeEditor(7462, 'Poster A')
    await editorHub.waitForEditor(2_000)
    fakeEditor(7462, 'Poster B')
    expect(await first.closed).toBe(AGENT_CLOSE_REPLACED)
    expect(await editorHub.request('state', {})).toEqual({ title: 'Poster B' })
  })

  it('turns away an editor on another protocol version', async () => {
    const editorHub = await startHub(7463)
    const stale = fakeEditor(7463, 'Old', { protocol: AGENT_PROTOCOL + 1 })
    expect(await stale.closed).toBe(AGENT_CLOSE_PROTOCOL)
    expect(editorHub.editorInfo).toBeNull()
  })

  it('refuses a page served from another site', async () => {
    const editorHub = await startHub(7464)
    const foreign = fakeEditor(7464, 'Phish', { origin: 'https://evil.example' })
    foreign.socket.on('error', () => {})
    await foreign.closed
    expect(editorHub.editorInfo).toBeNull()
  })

  it('times out a request the editor never answers', async () => {
    const editorHub = await startHub(7465)
    fakeEditor(7465, 'Silent')
    await editorHub.waitForEditor(2_000)
    await expect(editorHub.request('layers', {}, 50)).rejects.toThrow(/did not answer "layers"/)
  })

  it('explains a taken port instead of crashing', async () => {
    await startHub(7466)
    const second = new EditorHub({ port: 7466 })
    await second.listen()
    expect(second.listenError).toMatch(/Port 7466 is taken/)
    await expect(second.request('state', {})).rejects.toThrow(/Port 7466 is taken/)
  })
})

describe('agent window', () => {
  it('skips the same first-run intro the editor checks for', () => {
    expect(LAUNCH_ONBOARDING_KEY).toBe(ONBOARDING_KEY)
  })

  it('points the page at this server', () => {
    expect(agentPageUrl('http://127.0.0.1:5173/', 7417)).toBe('http://127.0.0.1:5173/?agent=7417')
    expect(agentPageUrl('http://127.0.0.1:5173/?x=1', 7420)).toBe('http://127.0.0.1:5173/?x=1&agent=7420')
  })
})
