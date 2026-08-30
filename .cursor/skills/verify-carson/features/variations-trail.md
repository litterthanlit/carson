# Variations trail

The bottom trail is a thumbnail history filmstrip. Click a look to jump back. Fork names a persistent comp; the comps gallery compares and merges those looks.

## Sub-features

- `trail-frames` records a filmstrip chip after a canvas edit such as Scatter.
- `trail-jump` restores an earlier look from a trail chip without using the header Undo control.
- `trail-fork` keeps the current look as a named variant from the trail Fork control.
- `comps-gallery` opens the comps dialog from the trail and can compare a named look.

## How to get to it (user POV)

- Open the launched origin and skip the intro.
- Edit the poster (Scatter on `Oversized headline` from Instruments).
- Use the `Exploration trail` under the canvas: Fork, then Comps.

## Driving it with verify-carson

Preconditions:

- Doctor reports the expected URL and this run's pid.
- Onboarding is dismissed (`Skip intro`).
- Seed layers include `Oversized headline`.

- **Trail after edit.** Open Layers, select `Oversized headline`, open Instruments, choose `Scatter`. Switch to `Move tool` so the palette is not covering the trail. Region `Exploration trail` shows a control whose name includes `Scattered selection`.
- **Fork.** Choose `Fork`. Status mentions `Forked Variant`.
- **Jump back.** Choose the trail chip whose name includes `Started a new poster`. Status mentions that look.
- **Gallery.** Choose `Comps gallery`. Dialog `Comps` appears with `Variant 1`. Choose `Compare` on that card. Dialog `Compare variations` appears.
- **Proof.** `artifacts/variations-trail/after-compare.aria.txt` and `after-compare.png` show heading `Carson` and dialog `Compare variations`.

## Gotchas

- Nudge and layer reorder do not add trail chips. Scatter, xerox, fork, and other snapshot edits do.
- `Comps gallery` is the control label; the dialog name is `Comps`.
- Fork from the trail is `Fork`, not the Layout tab. Cmd+B is the same action.
- Jumping a trail chip is spatial undo. Header `Undo` is a different path and is not required for this feature.
- The Instruments palette overlays the left trail chips. Switch to `Move tool` before clicking an early history frame.
