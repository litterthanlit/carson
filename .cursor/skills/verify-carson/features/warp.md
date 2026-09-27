# Distort and Warp

Distort drags a layer's four corners for true perspective; Warp bends it with a 4×4 mesh. Both are non-destructive — text stays editable, masks and layer styles warp along — and export at full resolution.

## Sub-features

- `warp-distort` four-corner perspective with a live grid preview.
- `warp-mesh` 4×4 mesh bending; switching modes keeps the current shape.
- `warp-commit` Done (Enter) records one undo step; Cancel (Esc) reverts.
- `warp-remove` Remove warp returns the layer to its unwarped shape.
- `warp-export` warped layers appear in PNG/PDF export, including tiled exports.

## How to get to it (user POV)

- Inspect → Transform → `Distort` or `Warp`.
- Commands (⌘K) → `Distort / perspective` or `Warp`.

## Driving it with verify-carson

Preconditions:

- Doctor reports the expected URL and this run's pid.
- Seed poster is loaded with `Oversized headline` selected.

- **Distort.** Choose `Distort`. Toolbar `Warp options` is visible with handles `Top-left corner` … `Bottom-left corner`. Drag `Top-left corner`.
- **Commit.** Choose `Done`. Status reads `Distorted layer`; Inspect shows `Remove warp`.
- **Undo.** Choose `Undo`. Status reads `Undo: Distorted layer`; `Remove warp` is gone.

Command: `node .cursor/skills/verify-carson/scripts/drive.mjs --run-dir "$CARSON_VERIFY_RUN_DIR" --feature warp`

## Gotchas

- Enter/Escape apply or cancel the edit only while focus is outside text fields.
- Selection handles show the unwarped box outside edit mode.
- Exported PNGs of 300dpi posters (~70MP) may be too large for a browser tab to decode for visual checks; inspect pixels with a decoder instead.
