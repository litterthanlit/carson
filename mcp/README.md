# Carson MCP server

An [MCP](https://modelcontextprotocol.io) server that lets an agent (Claude Code, Cursor, Claude Desktop, any MCP host) play a live Carson editor as a studio assistant. The agent looks at the poster, runs the same commands as ⌘K, plays instruments, tunes treatment chips, turns Tension, and undoes. Every move goes through the editor's own handlers, so the designer sees it happen, it lands on the exploration trail, and ⌘Z takes it back.

```
agent host ──stdio──▶ mcp/server.ts ◀──ws://127.0.0.1:7417── Carson editor (browser tab or agent window)
                       carson_* tools                         same commands, history and trail as the designer
```

The editor dials the server, not the other way round. The server listens on loopback only and accepts pages served from this machine.

## Requirements

- Node 22.18 or later. Node runs `mcp/server.ts` directly (type stripping), with no build step.
- `npm install` in the repo root.
- For `carson_open_editor` only: Playwright's Chromium (`npx playwright install chromium`).

## Add it to an agent

The repo ships project configs, so opening the repo is enough for:

- **Claude Code**: `.mcp.json`. Approve the `carson` server when asked.
- **Cursor**: `.cursor/mcp.json`.

Anywhere else, run `node /absolute/path/to/carson/mcp/server.ts` over stdio. Claude Code from another directory:

```bash
claude mcp add carson -- node /absolute/path/to/carson/mcp/server.ts
```

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "carson": { "command": "node", "args": ["/absolute/path/to/carson/mcp/server.ts"] }
  }
}
```

## Connect the editor

Pick one:

1. **The designer's own Carson.** In the editor, open Commands (⌘K) and run **Connect agent**. The top bar shows **Agent waiting**, then **Agent live** once the server runs. The choice is remembered; **Disconnect agent** forgets it.
2. **A URL.** Open Carson with `?agent` (default port) or `?agent=7420`.
3. **The agent's own window.** The agent calls `carson_open_editor`. It opens Chromium (headless unless `headless: false`) on Carson at `CARSON_URL` or `http://127.0.0.1:5173/`. When nothing answers there, it starts the repo's Vite dev server itself. This window has its own browser profile, so it does not see the designer's saved posters.

One editor window holds the bridge at a time. A newer window takes it; the older one shows **Agent in another window**, and clicking that chip takes it back.

## Tools

| Tool | What it does |
| --- | --- |
| `carson_status` | Connection, poster size, selection, Tension, status line, poster treatments, trail with op ids, saved posters. Call it first. |
| `carson_open_editor` | Open an editor window for an agent working alone. |
| `carson_start_poster` | Start Carson's wreck collage, a blank preset or custom size, or open a saved poster. Unsaved work asks the designer first. |
| `carson_list_layers` | Layers topmost first: ids, bounds, type settings, and each treatment stack (ids, seeds, params). Paginated. |
| `carson_select_layers` | Select layers, or clear the selection. |
| `carson_list_commands` | Every ⌘K action with its id, filtered by a query. Marks unavailable ones and ones that open UI for the designer. |
| `carson_run_command` | Run one ⌘K action, optionally on `layer_ids`. Reports new layers, new treatments, and the trail step. |
| `carson_add_text` | Add a text layer with font, size, color, position. |
| `carson_update_layer` | Change position, rotation, scale, opacity, blend mode, fill, text, type, name, visibility, lock. |
| `carson_treatment` | Re-roll, bypass, enable, remove, or `set-params` on one treatment chip (layer or poster). |
| `carson_set_tension` | Turn the Tension dial (0 composed … 100 wild). |
| `carson_history` | Undo, redo, or jump to a trail step. |
| `carson_view_poster` | The poster as an image the agent can see. |
| `carson_export_png` | Write a PNG at a scale to a path on this machine. |
| `carson_save_poster` | Save, or save a copy under a name, in the editor's storage. |
| `carson_place_image` | Place a local image file on the poster. |
| `carson_catalog` | Library fonts, poster presets, blend modes, instruments and their params. |

Resource `carson://method` serves [docs/CARSON-METHOD.md](../docs/CARSON-METHOD.md): how David Carson works and which tool does what.

A typical turn: `carson_status` → `carson_view_poster` → `carson_list_layers` → `carson_run_command` (`copy-machine` on an image) → `carson_view_poster` → `carson_treatment` (`reroll`, or `set-params` to move a slider) → `carson_history` (`undo`) if the take is wrong.

## Settings

| Variable | Default | Use |
| --- | --- | --- |
| `CARSON_AGENT_PORT` | `7417` | Bridge port. Open Carson with `?agent=<port>` to match. |
| `CARSON_URL` | `http://127.0.0.1:5173/` | Where `carson_open_editor` finds Carson. |
| `CARSON_AGENT_ORIGINS` | none | Extra page origins allowed to dial in, comma-separated (loopback and `file://` are always allowed). |
| `CARSON_CHROMIUM_PATH` | Playwright's | Chromium binary for `carson_open_editor`. |

## How it stays the designer's poster

- The agent drives through the editor's handlers, not around them. A command runs exactly as from ⌘K, and the bridge waits for it to land on history before it answers.
- The **Agent** chip in the top bar shows when an agent is connected. Clicking it disconnects.
- Every move is a trail step. The designer can undo it, re-roll it, or jump past it.
- Sites on the open web cannot dial the bridge: the server checks each page's Origin and listens on 127.0.0.1 only.

## Checks

```bash
npx vitest run src/lib/agentBridge.test.ts mcp/hub.test.ts   # transport, hub, origin checks
npm run mcp:smoke                                            # a full agent session against a headless editor
```

`npm run mcp:smoke` starts the server over stdio, opens a headless editor through it, and calls every tool. It saves renders in the system temp directory (or the directory passed as its argument). The UI path (Connect agent, the chip, the designer's undo) is the `agent-bridge` recipe in `.cursor/skills/verify-carson`.

## Files

| File | Role |
| --- | --- |
| `src/lib/agentProtocol.ts` | Wire types shared by the editor and the server |
| `src/lib/agentBridge.ts` | Editor side: dial, reconnect, answer requests one at a time |
| `src/hooks/useAgentBridge.ts` | Editor side: each request mapped to the editor's own handlers |
| `mcp/hub.ts` | Server side: the WebSocket the editor dials, Origin checks, request timeouts |
| `mcp/server.ts` | The MCP tools |
| `mcp/format.ts` | Markdown views of editor state |
| `mcp/launch.ts` | `carson_open_editor`: Chromium and, when needed, Vite |
