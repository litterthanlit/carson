#!/usr/bin/env node
/**
 * Carson MCP server: lets an agent play a live Carson editor as a studio assistant.
 *
 * Serves MCP on stdio. The editor dials this process over a loopback WebSocket
 * (CARSON_AGENT_PORT, default 7417) and every tool call runs through the editor's own commands,
 * so each move is visible to the designer, lands on the trail, and undoes with ⌘Z.
 *
 * Run: node mcp/server.ts   (Node 22.18+ runs the TypeScript directly)
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, extname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/server'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import * as z from 'zod/v4'
import { AGENT_DEFAULT_PORT, type AgentLayerPatch, type AgentState } from '../src/lib/agentProtocol.ts'
import { formatCatalog, formatChange, formatCommands, formatLayer, formatState } from './format.ts'
import { EditorHub, NOT_CONNECTED } from './hub.ts'
import { closeEditorWindow, openEditorWindow } from './launch.ts'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHARACTER_LIMIT = 25_000
const SLOW_MS = 120_000
const MAX_EXPORT_PIXELS = 120_000_000
const MAX_IMAGE_BYTES = 30 * 1024 * 1024
const IMAGE_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
}

const port = Number(process.env.CARSON_AGENT_PORT ?? AGENT_DEFAULT_PORT)
const hub = new EditorHub({
  port,
  extraOrigins: (process.env.CARSON_AGENT_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
})

const INSTRUCTIONS = `Carson is a poster editor for David Carson-style work: seeded, non-destructive chaos (instruments such as Copy machine, Scatter, Letter break, Ink bleed, Press Check) played on real type, images and found paper. These tools drive a live Carson editor window over a local bridge. The designer may be watching it.

How to work:
1. Call carson_status first. If no editor is connected, ask the designer to run "Connect agent" from Carson's command palette (⌘K), or call carson_open_editor to open a window of your own.
2. Look before and after you act: carson_view_poster returns the poster as an image.
3. Act through the editor. carson_list_commands and carson_run_command are the same actions as ⌘K. carson_treatment re-rolls, bypasses, removes or tunes one treatment chip. carson_set_tension turns the Tension dial that scales every instrument.
4. Every move lands on the exploration trail. carson_history undoes, redoes or jumps back.

You are a studio assistant, not the author: work with the designer's own elements, do what they ask, propose options, and keep every change undoable. The carson://method resource explains how David Carson works and which tool does what.`

type Format = 'markdown' | 'json'
const responseFormat = z
  .enum(['markdown', 'json'])
  .default('markdown')
  .describe("'markdown' for readable text, 'json' for structured data")
const layerIds = z.array(z.string().min(1)).describe('Layer ids from carson_list_layers, e.g. ["text-3", "image-7"]')

function text(value: string) {
  return { content: [{ type: 'text' as const, text: value }] }
}

function json(value: object) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }], structuredContent: value as Record<string, unknown> }
}

function editor() {
  const info = hub.editorInfo
  if (hub.listenError) throw new Error(hub.listenError)
  if (!info) throw new Error(NOT_CONNECTED)
  return info
}

function requireEditing(state: AgentState) {
  if (state.screen !== 'editor') throw new Error('Carson is on its home screen. Start or open a poster with carson_start_poster first.')
}

function resolvePath(path: string) {
  return isAbsolute(path) ? path : resolve(process.cwd(), path)
}

function createServer(): McpServer {
  const server = new McpServer({ name: 'carson-mcp-server', version: '1.0.0' }, { instructions: INSTRUCTIONS })

  server.registerTool(
    'carson_status',
    {
      title: 'Carson status',
      description: `Whether a Carson editor is connected, and what it shows: poster size, selection, Tension, status line, poster treatments, the exploration trail (with op ids for carson_history) and saved posters.

Call this first. When nothing is connected the result says how to connect; it is not an error.`,
      inputSchema: z.strictObject({ response_format: responseFormat }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ response_format }) => {
      if (hub.listenError) return text(`The Carson bridge is not listening. ${hub.listenError}`)
      const info = hub.editorInfo
      if (!info) {
        return text(`No Carson editor is connected (the bridge listens on ${hub.address}).

To connect: the designer opens Carson's command palette (⌘K) and runs "Connect agent", or opens Carson with ?agent${port === AGENT_DEFAULT_PORT ? '' : `=${port}`} in the URL. Or call carson_open_editor to open an editor window of your own.`)
      }
      const state = await hub.request('state', {})
      return (response_format as Format) === 'json' ? json({ editor: info, ...state }) : text(formatState(state, info))
    },
  )

  server.registerTool(
    'carson_open_editor',
    {
      title: 'Open a Carson editor window',
      description: `Open a Carson editor window that dials this server: Chromium via Playwright, headless unless headless=false. Uses Carson at url (or CARSON_URL, or http://127.0.0.1:5173/); when none is running it starts the repo's Vite dev server itself.

Use it when you work alone. When the designer already has Carson open, ask them to run "Connect agent" instead: this window has its own browser profile, so it does not see their saved posters. A newer window takes over the bridge from an older one.`,
      inputSchema: z.strictObject({
        url: z.url().optional().describe('Where Carson is served, e.g. "http://127.0.0.1:5173/"'),
        headless: z.boolean().default(true).describe('false shows the window on screen'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ url, headless }) => {
      if (hub.listenError) throw new Error(hub.listenError)
      const opened = await openEditorWindow({ url, headless, port })
      if (!(await hub.waitForEditor(20_000))) {
        throw new Error(`Opened ${opened.url}, but the editor did not connect within 20 seconds.`)
      }
      const state = await hub.request('state', {})
      return text(`Opened ${opened.url} (${headless ? 'headless' : 'on screen'}; profile ${opened.profile}).\n\n${formatState(state, editor())}`)
    },
  )

  server.registerTool(
    'carson_start_poster',
    {
      title: 'Start or open a poster',
      description: `Replace what the editor shows with a new or saved poster.

- mode "wreck": Carson's own layered collage, ready to play instruments on.
- mode "blank": an empty sheet; preset "a3" | "a2" | "instagram" | "square", or "custom" with width and height (320–10000px).
- mode "open": a saved poster by poster_id (carson_status lists them).

When the current poster has unsaved changes, Carson asks the designer first and this call waits for their answer (up to 2 minutes). Returns the new editor state.`,
      inputSchema: z.strictObject({
        mode: z.enum(['wreck', 'blank', 'open']),
        preset: z.enum(['a3', 'a2', 'instagram', 'square', 'custom']).default('a3').describe('Size for mode "blank"'),
        width: z.number().int().min(320).max(10_000).optional().describe('Pixels, preset "custom" only'),
        height: z.number().int().min(320).max(10_000).optional().describe('Pixels, preset "custom" only'),
        poster_id: z.string().optional().describe('Saved poster id, mode "open" only'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ mode, preset, width, height, poster_id }) => {
      const info = editor()
      if (mode === 'open' && !poster_id) throw new Error('mode "open" needs poster_id. carson_status lists saved posters.')
      const intent =
        mode === 'open'
          ? { kind: 'open' as const, projectId: poster_id! }
          : mode === 'blank'
            ? { kind: 'blank' as const, preset, width, height }
            : { kind: 'wreck' as const }
      const state = await hub.request('start', intent, SLOW_MS)
      return text(formatState(state, info))
    },
  )

  server.registerTool(
    'carson_list_layers',
    {
      title: 'List layers',
      description: `The poster's layers, topmost first: id, name, kind, position and size in poster pixels, text and type settings, and each layer's treatment stack (treatment ids, seeds, params for carson_treatment). Children of a group are indented under it.

Paginates with limit/offset; when more exist the result gives next_offset.`,
      inputSchema: z.strictObject({
        limit: z.number().int().min(1).max(500).default(100),
        offset: z.number().int().min(0).default(0),
        response_format: responseFormat,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ limit, offset, response_format }) => {
      editor()
      const all = await hub.request('layers', {})
      const render = (count: number) => {
        const layers = all.slice(offset, offset + count)
        const nextOffset = offset + layers.length
        const hasMore = all.length > nextOffset
        const page = { total: all.length, count: layers.length, offset, layers, has_more: hasMore, ...(hasMore ? { next_offset: nextOffset } : {}) }
        if ((response_format as Format) === 'json') return { page, text: JSON.stringify(page, null, 2) }
        const lines = [`# Layers (${layers.length} of ${all.length}, topmost first)`, '', ...layers.map(formatLayer)]
        if (hasMore) lines.push('', `More layers: call again with offset=${nextOffset}.`)
        return { page, text: lines.join('\n') }
      }
      let count = limit
      let result = render(count)
      while (count > 1 && result.text.length > CHARACTER_LIMIT) {
        count = Math.ceil(count / 2)
        result = render(count)
      }
      if (all.length === 0) return text('The poster has no layers yet. Add type with carson_add_text, or paste found paper with carson_run_command.')
      if ((response_format as Format) === 'json') return { content: [{ type: 'text' as const, text: result.text }], structuredContent: result.page }
      return text(result.text)
    },
  )

  server.registerTool(
    'carson_select_layers',
    {
      title: 'Select layers',
      description: 'Select layers on the canvas, as a click in the Layers panel would. An empty list clears the selection. Most tools also take layer_ids and select for you.',
      inputSchema: z.strictObject({ layer_ids: layerIds }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ layer_ids }) => {
      editor()
      const change = await hub.request('select', { layerIds: layer_ids })
      return text(formatChange(layer_ids.length > 0 ? 'Selected.' : 'Cleared the selection.', change))
    },
  )

  server.registerTool(
    'carson_list_commands',
    {
      title: 'List commands',
      description: `Every action in Carson's command palette (⌘K) with its id for carson_run_command: instruments (Copy machine, Ink bleed, Scatter, Letter break, Misprint offset, Type strip, Age, Ink loss, Fold marks, Distress), collage moves (Paste found paper, Tear edges, Weave, Photograph the collage, Crumple the sheet), Press Check and the press, frames, masks, layer styles, adjustment layers, saved instruments and gestures, layout and print toggles, save and export.

Commands marked "unavailable now" need a selection they can act on (or another state); those marked "opens UI for the designer" open a dialog, ask the designer for a name, or arm a tool they finish by hand, so the call returns (or waits on them) before the work is done. query filters by words in the label, id or keywords, e.g. "paper", "copier", "mask".`,
      inputSchema: z.strictObject({
        query: z.string().max(100).optional().describe('Words to match, e.g. "torn paper"'),
        response_format: responseFormat,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ query, response_format }) => {
      editor()
      const all = await hub.request('commands', {})
      const tokens = (query ?? '').toLowerCase().split(/\s+/).filter(Boolean)
      const commands = all.filter((command) => {
        const haystack = [command.id, command.label, ...command.keywords].join(' ').toLowerCase()
        return tokens.every((token) => haystack.includes(token))
      })
      if ((response_format as Format) === 'json') return json({ total: commands.length, commands })
      if (commands.length === 0) return text(`No command matches "${query}". Try a shorter query, or none to see them all.`)
      return text(`# Carson commands${query ? ` matching "${query}"` : ''} (${commands.length})\n\n${formatCommands(commands)}`)
    },
  )

  server.registerTool(
    'carson_run_command',
    {
      title: 'Run a command',
      description: `Run one command-palette action by id (from carson_list_commands), exactly as the designer would from ⌘K. Pass layer_ids to select its targets first; selection commands act on the current selection otherwise.

Returns the status line, the trail step it made, new and removed layer ids, and any new treatment (with its id and params, ready for carson_treatment). Chaos instruments are seeded: run the same command again, or carson_treatment reroll, for another take.

Examples: command_id "copy-machine" with layer_ids ["image-4"]; "found-paper-receipt"; "press-check"; "letter-break" on a text layer.`,
      inputSchema: z.strictObject({
        command_id: z.string().min(1).describe('e.g. "copy-machine", "scatter", "tear-edges", "found-paper-kraft"'),
        layer_ids: layerIds.optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ command_id, layer_ids }) => {
      editor()
      const change = await hub.request('run', { command: command_id, layerIds: layer_ids }, SLOW_MS)
      return text(formatChange(`Ran ${command_id}.`, change))
    },
  )

  server.registerTool(
    'carson_add_text',
    {
      title: 'Add type',
      description: `Add a text layer, the way the Text tool does. Coordinates and sizes are poster pixels (carson_status gives the poster size); defaults put Archivo Black at 8% of the poster width near the top left. font_family must be a Carson library font (carson_catalog lists them).

Use it for words the designer gives you. Then shape it with carson_update_layer and play instruments on it with carson_run_command.`,
      inputSchema: z.strictObject({
        text: z.string().min(1).max(5_000),
        name: z.string().max(120).optional().describe('Layer name, e.g. "Headline"'),
        left: z.number().optional(),
        top: z.number().optional(),
        width: z.number().positive().optional().describe('Text box width; lines wrap inside it'),
        font_family: z.string().optional().describe('e.g. "Archivo Black", "Special Elite"'),
        font_size: z.number().positive().optional(),
        font_weight: z.number().int().min(100).max(1000).optional(),
        fill: z.string().optional().describe('CSS color, e.g. "#e11d48"'),
        angle: z.number().min(-360).max(360).optional(),
        line_height: z.number().positive().optional(),
        char_spacing: z.number().optional().describe('Tracking in thousandths of an em, e.g. -40 or 200'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => {
      editor()
      const change = await hub.request('addText', {
        text: args.text,
        name: args.name,
        left: args.left,
        top: args.top,
        width: args.width,
        fontFamily: args.font_family,
        fontSize: args.font_size,
        fontWeight: args.font_weight,
        fill: args.fill,
        angle: args.angle,
        lineHeight: args.line_height,
        charSpacing: args.char_spacing,
      })
      return text(formatChange('Added type.', change))
    },
  )

  server.registerTool(
    'carson_update_layer',
    {
      title: 'Edit a layer',
      description: `Change one layer's properties, as the Inspector does: position, rotation, scale, opacity, blend mode, fill, text and type settings, name, visibility, lock. Only the fields you pass change. Undoes as one step.

Layers inside a group can't be edited on their own; edit the group or ungroup first.`,
      inputSchema: z.strictObject({
        layer_id: z.string().min(1),
        name: z.string().max(120).optional(),
        text: z.string().max(5_000).optional(),
        left: z.number().optional(),
        top: z.number().optional(),
        angle: z.number().min(-360).max(360).optional(),
        opacity: z.number().min(0).max(1).optional(),
        scale_x: z.number().positive().max(100).optional(),
        scale_y: z.number().positive().max(100).optional(),
        fill: z.string().optional().describe('CSS color'),
        font_family: z.string().optional(),
        font_size: z.number().positive().optional(),
        font_weight: z.number().int().min(100).max(1000).optional(),
        char_spacing: z.number().optional(),
        line_height: z.number().positive().optional(),
        blend_mode: z.string().optional().describe('e.g. "multiply", "screen", "difference" (carson_catalog lists them)'),
        visible: z.boolean().optional(),
        locked: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ layer_id, ...args }) => {
      editor()
      const patch: AgentLayerPatch = {
        name: args.name,
        text: args.text,
        left: args.left,
        top: args.top,
        angle: args.angle,
        opacity: args.opacity,
        scaleX: args.scale_x,
        scaleY: args.scale_y,
        fill: args.fill,
        fontFamily: args.font_family,
        fontSize: args.font_size,
        fontWeight: args.font_weight,
        charSpacing: args.char_spacing,
        lineHeight: args.line_height,
        blendMode: args.blend_mode,
        visible: args.visible,
        locked: args.locked,
      }
      if (Object.values(patch).every((value) => value === undefined)) throw new Error('Pass at least one property to change.')
      const change = await hub.request('updateLayer', { layerId: layer_id, patch })
      return text(formatChange(`Edited ${layer_id}.`, change))
    },
  )

  server.registerTool(
    'carson_treatment',
    {
      title: 'Work a treatment chip',
      description: `Act on one treatment in a layer's stack (or on the poster's own stack when layer_id is omitted), like its chip in the Treatments tab:

- "reroll": same instrument, new seed — another take on the accident.
- "bypass" / "enable": switch it off or on without losing it.
- "remove": take it off the stack.
- "set-params": move its sliders, e.g. {"generation": 7} for xerox or {"amount": 80} for decay. Only keys the treatment already has are accepted; carson_list_layers shows them.

Treatment ids come from carson_list_layers (layer treatments), carson_status (poster treatments), or the result of the command that added one.`,
      inputSchema: z.strictObject({
        layer_id: z.string().min(1).optional().describe('Omit for a poster treatment such as Press Check'),
        treatment_id: z.string().min(1),
        action: z.enum(['reroll', 'bypass', 'enable', 'remove', 'set-params']),
        params: z.record(z.string(), z.number()).optional().describe('For "set-params"'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ layer_id, treatment_id, action, params }) => {
      editor()
      const change = await hub.request('treatment', { layerId: layer_id, treatmentId: treatment_id, action, params }, SLOW_MS)
      return text(formatChange(`${action} ${treatment_id}.`, change))
    },
  )

  server.registerTool(
    'carson_set_tension',
    {
      title: 'Turn the Tension dial',
      description: 'Set Tension, the one dial that scales every instrument on the poster: 0 composed, about 50 restless, 100 wild. Treatments re-render at the new intensity; their stored params stay as they are.',
      inputSchema: z.strictObject({ value: z.number().min(0).max(100) }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ value }) => {
      editor()
      const change = await hub.request('tension', { value }, SLOW_MS)
      return text(formatChange(`Tension ${Math.round(value)}.`, change))
    },
  )

  server.registerTool(
    'carson_history',
    {
      title: 'Undo, redo, or jump on the trail',
      description: 'Undo or redo (steps times), or jump to a trail step by op_id from carson_status, as ⌘Z, ⇧⌘Z and the exploration trail do. Use it to back out of a take you or the designer do not want.',
      inputSchema: z.strictObject({
        action: z.enum(['undo', 'redo', 'jump']),
        steps: z.number().int().min(1).max(50).default(1),
        op_id: z.string().optional().describe('For "jump"'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ action, steps, op_id }) => {
      editor()
      if (action === 'jump' && !op_id) throw new Error('"jump" needs op_id. carson_status lists trail op ids.')
      const change = await hub.request('history', { action, steps, opId: op_id }, SLOW_MS)
      return text(formatChange(action === 'jump' ? `Jumped to ${op_id}.` : `${action} ×${steps}.`, change))
    },
  )

  server.registerTool(
    'carson_view_poster',
    {
      title: 'Look at the poster',
      description: 'Render the whole poster, without selection chrome, as an image you can see. max_edge sets the longest side in pixels. Look after each move: the accident is the point, and you can only judge it by eye.',
      inputSchema: z.strictObject({
        max_edge: z.number().int().min(256).max(2048).default(1024),
        format: z.enum(['jpeg', 'png']).default('jpeg'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ max_edge, format }) => {
      editor()
      const image = await hub.request('render', { maxEdge: max_edge, format }, SLOW_MS)
      return {
        content: [
          { type: 'image' as const, data: image.data, mimeType: image.mimeType },
          { type: 'text' as const, text: `Poster rendered at ${image.width}×${image.height}.` },
        ],
      }
    },
  )

  server.registerTool(
    'carson_export_png',
    {
      title: 'Export a PNG',
      description: `Write the poster to a PNG file on this machine at scale × the poster size (copier and Press Check rebake at that scale, as Export does). Relative paths resolve against ${process.cwd()}. Refuses to replace an existing file unless overwrite is true.`,
      inputSchema: z.strictObject({
        path: z.string().min(1).describe('e.g. "out/poster.png"'),
        scale: z.number().min(0.1).max(4).default(1),
        overwrite: z.boolean().default(false),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ path, scale, overwrite }) => {
      editor()
      const target = resolvePath(path.toLowerCase().endsWith('.png') ? path : `${path}.png`)
      if (!overwrite && existsSync(target)) throw new Error(`${target} already exists. Pass overwrite: true to replace it, or choose another path.`)
      const state = await hub.request('state', {})
      requireEditing(state)
      const pixels = state.poster.width * state.poster.height * scale * scale
      if (pixels > MAX_EXPORT_PIXELS) {
        const largest = Math.sqrt(MAX_EXPORT_PIXELS / (state.poster.width * state.poster.height))
        throw new Error(`scale ${scale} would be ${Math.round(pixels / 1e6)} megapixels. Use scale ${Math.floor(largest * 10) / 10} or less.`)
      }
      const image = await hub.request('render', { scale, format: 'png' }, SLOW_MS)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, Buffer.from(image.data, 'base64'))
      return text(`Wrote ${target} (${image.width}×${image.height}).`)
    },
  )

  server.registerTool(
    'carson_save_poster',
    {
      title: 'Save the poster',
      description: 'Save the poster in the editor\'s own storage (the browser it runs in), as ⌘S does. With name, save a copy under that name instead (File → Save as); names must be unique.',
      inputSchema: z.strictObject({ name: z.string().min(1).max(120).optional() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ name }) => {
      editor()
      const change = await hub.request('save', { name })
      return text(formatChange(name ? `Saved a copy as "${name}".` : 'Saved.', change))
    },
  )

  server.registerTool(
    'carson_place_image',
    {
      title: 'Place an image',
      description: `Place an image file from this machine on the poster (PNG, JPEG, WebP, GIF or SVG, up to 30 MB), as dropping it on the canvas does. fill=true covers the whole poster. Relative paths resolve against ${process.cwd()}.

Place the designer's own photos, scans and found matter; Carson's instruments then work on it.`,
      inputSchema: z.strictObject({
        path: z.string().min(1),
        fill: z.boolean().default(false),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ path, fill }) => {
      editor()
      const source = resolvePath(path)
      const type = IMAGE_TYPES[extname(source).toLowerCase()]
      if (!type) throw new Error(`${source} is not a PNG, JPEG, WebP, GIF or SVG file.`)
      const info = await stat(source).catch(() => null)
      if (!info?.isFile()) throw new Error(`No file at ${source}.`)
      if (info.size > MAX_IMAGE_BYTES) throw new Error(`${source} is ${Math.round(info.size / 1e6)} MB; the limit is 30 MB.`)
      const data = await readFile(source)
      const name = source.split(/[\\/]/).pop() ?? 'image'
      const change = await hub.request('placeImage', { name, fill, dataUrl: `data:${type};base64,${data.toString('base64')}` }, SLOW_MS)
      return text(formatChange(`Placed ${name}.`, change))
    },
  )

  server.registerTool(
    'carson_catalog',
    {
      title: 'Fonts, sizes, blend modes, instruments',
      description: 'What Carson offers: library fonts by category (for font_family), poster presets, blend modes (for blend_mode), and the instrument registry with default params (the keys carson_treatment set-params accepts).',
      inputSchema: z.strictObject({ response_format: responseFormat }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ response_format }) => {
      editor()
      const catalog = await hub.request('catalog', {})
      return (response_format as Format) === 'json' ? json(catalog) : text(formatCatalog(catalog))
    },
  )

  server.registerResource(
    'carson-method',
    'carson://method',
    {
      title: 'How David Carson works',
      description: 'The method behind Carson (sourced and inferred), mapped to the tools that implement each move, and the gaps.',
      mimeType: 'text/markdown',
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'text/markdown', text: await readFile(join(REPO_ROOT, 'docs/CARSON-METHOD.md'), 'utf8') }],
    }),
  )

  return server
}

await hub.listen()
if (hub.listenError) console.error(`carson-mcp-server: ${hub.listenError}`)
else console.error(`carson-mcp-server: bridge on ${hub.address}, MCP on stdio`)

const stdio = serveStdio(createServer)

let shuttingDown = false
async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  await Promise.allSettled([stdio.close(), hub.close(), closeEditorWindow()])
  process.exit(0)
}
process.stdin.on('end', () => void shutdown())
process.stdin.on('close', () => void shutdown())
process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
