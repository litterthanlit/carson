/**
 * Open a Carson editor window for an agent working alone: Chromium (via Playwright) pointed at a
 * running Carson, or at a Vite dev server this process starts from the repo.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BrowserContext } from 'playwright'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_URL = 'http://127.0.0.1:5173/'
const VITE_READY_MS = 30_000
/** Same value as ONBOARDING_KEY in src/lib/editorConstants.ts (launch.test.ts holds them together). */
export const ONBOARDING_KEY = 'carson.onboarding.v2'

let context: BrowserContext | null = null
let vite: ChildProcess | null = null

async function isCarson(url: string) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) })
    return response.ok && (await response.text()).includes('<title>Carson</title>')
  } catch {
    return false
  }
}

function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      probe.close(() => (address && typeof address === 'object' ? resolvePort(address.port) : reject(new Error('No free port'))))
    })
  })
}

async function startVite(): Promise<string> {
  const bin = join(REPO_ROOT, 'node_modules/.bin/vite')
  if (!existsSync(bin)) {
    throw new Error(`Carson is not running at ${DEFAULT_URL} and ${REPO_ROOT} has no node_modules. Run "npm install" there, or start Carson and pass its url.`)
  }
  const port = await freePort()
  const url = `http://127.0.0.1:${port}/`
  const child = spawn(bin, ['--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: REPO_ROOT, stdio: 'ignore' })
  vite = child
  const started = Date.now()
  while (Date.now() - started < VITE_READY_MS) {
    if (child.exitCode !== null) throw new Error('The Carson dev server exited while starting. Run "npm run dev" to see why.')
    if (await isCarson(url)) return url
    await new Promise((done) => setTimeout(done, 250))
  }
  throw new Error(`The Carson dev server did not answer ${url} within 30 seconds.`)
}

/** The url with `?agent=<port>`, so the page dials this server's bridge. */
export function agentPageUrl(base: string, port: number) {
  const url = new URL(base)
  url.searchParams.set('agent', String(port))
  return url.toString()
}

/** Opens (or reopens) this server's own editor window. Its saved posters live in its own profile. */
export async function openEditorWindow(options: { url?: string; headless: boolean; port: number }) {
  let base = options.url ?? process.env.CARSON_URL
  if (base) {
    if (!(await isCarson(base))) throw new Error(`No Carson editor answers at ${base}. Start it with "npm run dev", or pass another url.`)
  } else {
    base = (await isCarson(DEFAULT_URL)) ? DEFAULT_URL : await startVite()
  }

  let playwright: typeof import('playwright')
  try {
    playwright = await import('playwright')
  } catch {
    throw new Error(`Playwright is not installed. Run "npm install" in ${REPO_ROOT}, then "npx playwright install chromium".`)
  }

  await context?.close().catch(() => {})
  const profile = join(tmpdir(), 'carson-mcp-profile')
  context = await playwright.chromium.launchPersistentContext(profile, {
    headless: options.headless,
    viewport: { width: 1440, height: 960 },
    ...(process.env.CARSON_CHROMIUM_PATH ? { executablePath: process.env.CARSON_CHROMIUM_PATH } : {}),
  })
  // An agent's window skips the first-run intro; nobody is there to click through it.
  await context.addInitScript((key: string) => {
    try {
      if (!localStorage.getItem(key)) localStorage.setItem(key, 'done')
    } catch {
      /* storage blocked: the intro shows, the bridge still works */
    }
  }, ONBOARDING_KEY)
  const page = context.pages()[0] ?? (await context.newPage())
  const pageUrl = agentPageUrl(base, options.port)
  await page.goto(pageUrl)
  return { url: pageUrl, profile }
}

export async function closeEditorWindow() {
  await context?.close().catch(() => {})
  context = null
  vite?.kill('SIGTERM')
  vite = null
}
