# Ink bleed

Ink bleed runs the current layer through the Copy Machine with the drum inked unevenly: some lines flood into fused blobs, some starve to broken fragments, and wet ink slurs along the feed. The Treatments tab then shows the Copy chip with `Ink bleed`, `Ink starve` and `Slur` sliders.

## Sub-features

- `ink-bleed-select` targets `Oversized headline`.
- `ink-bleed-apply` runs Ink bleed from Instruments.
- `ink-bleed-inspect` shows a Copy chip on Treatments with the three ink sliders.

## How to get to it (user POV)

- Choose Instruments, then `Ink bleed`.
- Open Commands and run Ink bleed.
- Add Copy machine, then raise `Ink bleed`, `Ink starve` or `Slur` on its Treatments card.

## Driving it with verify-carson

Preconditions:

- Doctor reports the expected URL and this run's pid.
- A single content layer is selected. ActiveSelection is not valid for this control.

- **Select headline.** Choose tab `Layers`, then `Oversized headline`. Run `node .cursor/skills/verify-carson/scripts/drive.mjs --feature ink-bleed`.
- **Ink bleed.** Choose `Instruments`, then `Ink bleed`. Choose tab `Treatments`. A `Copy·` chip is present with `Ink bleed`, `Ink starve` and `Slur` sliders.
- **Proof.** `artifacts/ink-bleed/treatments.aria.txt`, `treatments.png` and `canvas.png` show the chip, the sliders and the baked headline.

## Gotchas

- `Ink bleed` is disabled with no selection.
- The bake runs in a worker and takes seconds on a print-size headline. Wait for `Applied Ink bleed` in the trail before taking the canvas proof.
- Ink trains and slur follow `Scan angle`. The instrument sets it to 0° (a horizontal feed).
