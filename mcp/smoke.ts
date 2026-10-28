/**
 * End-to-end self-check: starts the Carson MCP server over stdio, opens a headless editor
 * through it, and plays a session the way an agent would. Exits non-zero on the first failure.
 *
 *   node mcp/smoke.ts [out-dir]
 *
 * Needs Playwright's Chromium (npx playwright install chromium, or CARSON_CHROMIUM_PATH).
 * Uses Carson at CARSON_URL, else starts the repo's Vite dev server. Renders land in out-dir.
 */
import { strict as assert } from 'node:assert'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/client'
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import type { AgentLayer, AgentState } from '../src/lib/agentProtocol.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(process.argv[2] ?? join(tmpdir(), 'carson-mcp-smoke'))
await mkdir(out, { recursive: true })

type Content = { type: string; text?: string; data?: string; mimeType?: string }
type ToolResult = { content: Content[]; isError?: boolean; structuredContent?: unknown }

const env: Record<string, string> = { ...getDefaultEnvironment(), CARSON_AGENT_PORT: process.env.CARSON_AGENT_PORT ?? '7499' }
for (const key of ['CARSON_URL', 'CARSON_CHROMIUM_PATH', 'PLAYWRIGHT_BROWSERS_PATH']) {
  if (process.env[key]) env[key] = process.env[key]!
}
const client = new Client({ name: 'carson-smoke', version: '1.0.0' })
await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(root, 'mcp/server.ts')], env, stderr: 'inherit' }))

async function call(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
  return (await client.callTool({ name, arguments: args })) as ToolResult
}
function textOf(result: ToolResult) {
  return result.content.filter((item) => item.type === 'text').map((item) => item.text).join('\n')
}
async function ok(name: string, args: Record<string, unknown> = {}) {
  const result = await call(name, args)
  assert.ok(!result.isError, `${name} failed: ${textOf(result)}`)
  console.error(`✓ ${name}${Object.keys(args).length ? ` ${JSON.stringify(args)}` : ''}`)
  return result
}
async function refused(name: string, args: Record<string, unknown>, pattern: RegExp) {
  const result = await call(name, args)
  assert.equal(result.isError, true, `${name} should have failed: ${textOf(result)}`)
  assert.match(textOf(result), pattern)
  console.error(`✓ ${name} refuses ${JSON.stringify(args)}`)
}
async function layers() {
  return ((await ok('carson_list_layers', { response_format: 'json', limit: 500 })).structuredContent as { layers: AgentLayer[] }).layers
}
async function state() {
  return (await ok('carson_status', { response_format: 'json' })).structuredContent as AgentState
}
async function look(file: string) {
  const result = await ok('carson_view_poster', { max_edge: 768 })
  const image = result.content.find((item) => item.type === 'image')
  assert.ok(image?.data && image.mimeType === 'image/jpeg', 'view_poster should return a JPEG')
  await writeFile(join(out, file), Buffer.from(image.data, 'base64'))
}

const { tools } = await client.listTools()
assert.deepEqual(
  tools.map((tool) => tool.name).sort(),
  [
    'carson_add_text',
    'carson_catalog',
    'carson_export_png',
    'carson_history',
    'carson_list_commands',
    'carson_list_layers',
    'carson_open_editor',
    'carson_place_image',
    'carson_run_command',
    'carson_save_poster',
    'carson_select_layers',
    'carson_set_tension',
    'carson_start_poster',
    'carson_status',
    'carson_treatment',
    'carson_update_layer',
    'carson_view_poster',
  ],
)

// Before an editor dials in: status explains how, everything else refuses with the same advice.
assert.match(textOf(await ok('carson_status')), /No Carson editor is connected/)
await refused('carson_list_layers', {}, /Connect agent/)

await ok('carson_open_editor', { headless: true })
await ok('carson_start_poster', { mode: 'wreck' })
let poster = await state()
assert.equal(poster.screen, 'editor')
assert.ok(poster.layerCount > 5, 'the wreck poster has layers')
await look('1-wreck.jpg')

const headline = (await layers()).find((layer) => layer.name === 'Oversized headline')
assert.ok(headline, 'the seed poster has its headline')

// An instrument, then its chip: tune, re-roll, bypass, enable.
const copier = textOf(await ok('carson_run_command', { command_id: 'copy-machine', layer_ids: [headline.id] }))
assert.match(copier, /New treatment on `.+`: .*copy-machine/)
let treatment = (await layers()).find((layer) => layer.id === headline.id)!.treatments.find((item) => item.type === 'copy-machine')
assert.ok(treatment, 'copy machine is on the headline stack')
const key = Object.keys(treatment.params)[0]!
await ok('carson_treatment', { layer_id: headline.id, treatment_id: treatment.id, action: 'set-params', params: { [key]: treatment.params[key]! + 1 } })
await ok('carson_treatment', { layer_id: headline.id, treatment_id: treatment.id, action: 'reroll' })
const rerolled = (await layers()).find((layer) => layer.id === headline.id)!.treatments.find((item) => item.id === treatment!.id)!
assert.equal(rerolled.params[key], treatment.params[key]! + 1, 'set-params moved the slider')
assert.notEqual(rerolled.seed, treatment.seed, 'reroll changed the seed')
await ok('carson_treatment', { layer_id: headline.id, treatment_id: treatment.id, action: 'bypass' })
treatment = (await layers()).find((layer) => layer.id === headline.id)!.treatments.find((item) => item.id === treatment!.id)!
assert.equal(treatment.enabled, false, 'bypass switched it off')
await ok('carson_treatment', { layer_id: headline.id, treatment_id: treatment.id, action: 'enable' })
await refused('carson_treatment', { layer_id: headline.id, treatment_id: treatment.id, action: 'set-params', params: { nonsense: 1 } }, /has no nonsense/)

await ok('carson_set_tension', { value: 85 })
assert.equal((await state()).tension, 85)

// Type from the designer, shaped and broken.
const catalog = (await ok('carson_catalog', { response_format: 'json' })).structuredContent as { fonts: Array<{ family: string }> }
const font = catalog.fonts.find((item) => item.family === 'Special Elite')?.family ?? catalog.fonts[0]!.family
const added = textOf(await ok('carson_add_text', { text: 'THE END OF PRINT', font_family: font, font_size: 260, left: 300, top: 3400, name: 'Smoke type' }))
const typeId = /New layers: `([^`]+)`/.exec(added)?.[1]
assert.ok(typeId, `add_text reports the new layer: ${added}`)
await ok('carson_update_layer', { layer_id: typeId, angle: -7, fill: '#e11d48', blend_mode: 'multiply' })
const typeLayer = (await layers()).find((layer) => layer.id === typeId)!
assert.equal(typeLayer.fill, '#e11d48')
assert.equal(typeLayer.blendMode, 'multiply')
assert.equal(typeLayer.fontFamily, font)
await ok('carson_run_command', { command_id: 'letter-break', layer_ids: [typeId] })

// Collage and press.
const paper = textOf(await ok('carson_run_command', { command_id: 'found-paper-receipt' }))
assert.match(paper, /New layers:/)
await ok('carson_run_command', { command_id: 'press-check' })
poster = await state()
assert.ok(poster.posterTreatments.some((item) => item.type === 'press-check'), 'Press Check is on the poster stack')
await look('2-played.jpg')

await refused('carson_run_command', { command_id: 'no-such-command' }, /No command "no-such-command"/)
await refused('carson_update_layer', { layer_id: 'ghost-1', opacity: 0.5 }, /No layer "ghost-1"/)
assert.match(textOf(await ok('carson_list_commands', { query: 'paper' })), /found-paper-receipt/)

// The trail: undo the press, redo it.
const before = poster.trail.frames.length
await ok('carson_history', { action: 'undo' })
assert.ok(!(await state()).posterTreatments.some((item) => item.type === 'press-check'), 'undo took Press Check off')
await ok('carson_history', { action: 'redo' })
assert.ok((await state()).posterTreatments.some((item) => item.type === 'press-check'), 'redo put it back')
assert.ok(before > 3, 'moves landed on the trail')

const image = join(root, 'public/apple-touch-icon.png')
assert.match(textOf(await ok('carson_place_image', { path: image })), /New layers:/)

const exported = join(out, 'poster.png')
await rm(exported, { force: true })
await ok('carson_export_png', { path: exported, scale: 0.25 })
const png = await readFile(exported)
assert.equal(png.subarray(1, 4).toString(), 'PNG', 'export wrote a PNG')
await refused('carson_export_png', { path: exported, scale: 0.25 }, /already exists/)

const name = `Smoke ${Date.now()}`
await ok('carson_save_poster', { name })
assert.ok((await state()).savedPosters.some((item) => item.name === name), 'the copy is saved')

const method = await client.readResource({ uri: 'carson://method' })
assert.match(String((method.contents[0] as { text?: string }).text), /How David Carson works/)

await client.close()
assert.ok(existsSync(join(out, '2-played.jpg')))
console.error(`Smoke test passed. Renders in ${out}`)
