#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(skillDir, '../../..')
const host = process.env.CARSON_VERIFY_HOST || '127.0.0.1'
const port = process.env.CARSON_VERIFY_PORT || '4173'
const runId = process.env.CARSON_VERIFY_RUN_ID || `${Date.now()}-${process.pid}`
const runDir = process.env.CARSON_VERIFY_RUN_DIR || `/tmp/carson-verify-${runId}`
const url = `http://${host}:${port}/`
const viteBin = join(root, 'node_modules/.bin/vite')

await mkdir(runDir, { recursive: true })
await mkdir(join(skillDir, '.run'), { recursive: true })

if (await portBusy(port)) {
  console.error(`Port ${port} is already in use. Set CARSON_VERIFY_PORT to a free port.`)
  process.exit(1)
}

const logPath = join(runDir, 'vite.log')
const log = createWriteStream(logPath, { flags: 'a' })
await new Promise((resolveStream) => log.on('open', resolveStream))

const child = spawn(viteBin, ['--host', host, '--port', port, '--strictPort'], {
  cwd: root,
  detached: true,
  stdio: ['ignore', log, log],
  env: process.env,
})
child.unref()

const pid = child.pid
if (!pid) {
  console.error('Failed to spawn Vite.')
  process.exit(1)
}

let ready = false
for (let i = 0; i < 60; i += 1) {
  if (child.exitCode != null) {
    console.error('Vite exited before becoming ready. Last log:')
    console.error(await readTail(logPath))
    process.exit(1)
  }
  if (await urlReady(url)) {
    ready = true
    break
  }
  await delay(250)
}

if (!ready) {
  child.kill('SIGTERM')
  console.error(`Vite did not answer ${url} within 15s. Last log:`)
  console.error(await readTail(logPath))
  process.exit(1)
}

const listenPid = (await listenPidOnPort(port)) || pid
const run = {
  runId,
  host,
  port: Number(port),
  url,
  pid: listenPid,
  root,
  runDir,
}
await writeFile(join(runDir, 'run.json'), JSON.stringify(run, null, 2))
await writeFile(join(runDir, 'vite.pid'), String(listenPid))
await writeFile(join(skillDir, '.run/current-path'), `${runDir}\n`)

console.log(`CARSON_VERIFY_RUN_DIR=${runDir}`)
console.log(`URL=${url}`)
console.log(`PID=${listenPid}`)

async function portBusy(portValue) {
  const pidOnPort = await listenPidOnPort(portValue)
  return pidOnPort != null
}

async function listenPidOnPort(portValue) {
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const execFileAsync = promisify(execFile)
  try {
    const { stdout } = await execFileAsync('lsof', ['-nP', `-iTCP:${portValue}`, '-sTCP:LISTEN', '-t'])
    const first = stdout.trim().split('\n')[0]
    return first ? Number(first) : null
  } catch {
    return null
  }
}

async function urlReady(target) {
  try {
    const response = await fetch(target)
    const html = await response.text()
    return response.ok && html.includes('<title>Carson</title>')
  } catch {
    return false
  }
}

async function readTail(path) {
  try {
    const text = await readFile(path, 'utf8')
    return text.split('\n').slice(-40).join('\n')
  } catch {
    return ''
  }
}

function delay(ms) {
  return new Promise((resolveDelay) => {
    const timer = globalThis.setTimeout
    timer(resolveDelay, ms)
  })
}
