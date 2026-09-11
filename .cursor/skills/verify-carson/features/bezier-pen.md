# Bezier pen

The Shape Pen tool is click-to-place bezier: click anchors, drag for handles, Enter to finish. The stroke stays a path layer that Edit points can refine.

## Sub-features

- `pen-entry` turns on bezier pen from the Shape flyout.
- `pen-place` creates a Pen stroke layer from three clicks plus Enter.
- `pen-status` reports the live pen instruction in the exploration trail.

## How to get to it (user POV)

- Shape tool → Pen.
- Press `P` with the canvas workspace focused.
- Commands → Pen tool.

## Driving it with verify-carson

Preconditions:

- Doctor reports the expected URL and this run's pid.
- Onboarding is dismissed (`Skip intro`).

- **Open pen.** Choose `Shape tool`, then menuitem `Pen`. Status mentions `click to place`.
- **Place a path.** Click three points on the poster canvas workspace, then press Enter. Status mentions `bezier path`.
- **Confirm layer.** Open Layers. A row named `Pen stroke` is present.
- **Proof.** `artifacts/bezier-pen/after-path.aria.txt` and `after-path.png` show heading `Carson` and `Pen stroke`.

## Gotchas

- Pen is click-to-place bezier. Pencil in the same flyout is freehand and is a different tool.
- `P` only toggles when the canvas workspace is focused.
- Enter finishes an open path. Clicking the first point closes it instead.
- Edit points on the new stroke is a follow-on path, not required for this feature.
