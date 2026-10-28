# Agent bridge

The designer connects an agent (any MCP host running `mcp/server.ts`) to the open poster. A top-bar chip shows whether an agent is waiting or live. The agent's moves run through the same commands as the designer's, land on the exploration trail, and undo with the designer's Undo.

## Sub-features

- `agent-connect` dials the agent from Commands and shows `Agent waiting` until the server answers.
- `agent-live` turns the chip to `Agent live` once the Carson MCP server is up.
- `agent-move` shows an agent's command as a trail step and a Treatments chip.
- `agent-undo` lets the designer undo the agent's move from the top bar; the agent's status sees it.
- `agent-disconnect` drops the bridge from Commands and hides the chip.

## How to get to it (user POV)

- Open Commands and run `Connect agent`; `Disconnect agent` while connected.
- Open Carson with `?agent` (or `?agent=<port>`) in the URL.
- Choose the `Agent …` chip: it disconnects while waiting or live, and takes the agent back while another window has it.

## Driving it with verify-carson

Preconditions:

- Doctor reports the expected URL and this run's pid.
- Seed poster is loaded.
- Nothing listens on port 7417 (no agent session running a Carson MCP server).

- **Connect.** Choose `Commands`. Search `Connect agent`. Choose it. Button `Agent waiting` appears in the banner.
- **Server up.** The driver starts `node mcp/server.ts` over stdio. Button `Agent live` appears.
- **Agent move.** The driver calls `carson_run_command` `scatter` on `Oversized headline`. Region `Exploration trail` gets a `Scattered selection` step. Tab `Treatments` shows a `Scatter·#` chip.
- **Designer undo.** Choose `Undo`. The `Scatter·#` chip leaves. `carson_status` reports `can redo`.
- **Disconnect.** Choose `Commands`. Search `Disconnect agent`. Choose it. The `Agent` chip leaves; `carson_status` reports no editor.
- **Proof.** `artifacts/agent-bridge/waiting.png`, `agent-move.png`, `designer-undo.png`, `disconnected.png` and their ARIA dumps.

## Gotchas

- `Connect agent` dials port 7417. A Carson MCP server from a real agent session on that port answers instead of the driver's; stop it first.
- The chip's accessible name is `Agent <state>`; body text splits it into `Agent` and the state.
- Another Carson window that connects takes the bridge; this one shows `Agent in another window` and does not redial until chosen.
- The agent's own `carson_open_editor` window uses its own browser profile. Its saved posters are not the designer's.
