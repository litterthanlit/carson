# Misprint and type strips

Misprint offset and Type strip apply through the Instrument registry onto the layer treatment stack. The source layer stays in the document. Chips expose re-roll, bypass, and remove.

## Sub-features

- `stack-select` targets `Oversized headline`.
- `stack-misprint` runs Misprint offset from Instruments.
- `stack-type-strip` runs Type strip from Instruments.
- `stack-inspect` shows those treatments in the Treatments tab.

## How to get to it (user POV)

- Choose Instruments, then `Misprint offset` or `Type strip`.
- Open Commands and run Misprint offset or Type strip.
- Press `I` to open Instruments, then choose one of those two.

## Driving it with verify-carson

Preconditions:

- Doctor reports the expected URL and this run's pid.
- A single content layer is selected. ActiveSelection is not valid for this control.
- Type strip requires a text layer. `Oversized headline` is valid for both.

- **Select headline.** Choose tab `Layers`, then `Oversized headline`. Run `node .cursor/skills/verify-carson/scripts/drive.mjs --feature misprint-type-strips`.
- **Open Instruments.** Choose `Instruments`. Complementary region `Instruments` is visible.
- **Misprint offset.** Choose `Misprint offset`.
- **Type strip.** Choose `Type strip`.
- **Leave Instruments.** Choose `Move tool` so the inspector is unobstructed.
- **Inspect stack.** Choose tab `Treatments`. The empty copy `No layer treatments yet` is absent. Chips include Misprint and Type strip.
- **Chip ops.** Choose `Re-roll seed`, then `Bypass`, on the Inspector stack.
- **Proof.** `artifacts/misprint-type-strips/treatments.aria.txt` and `treatments.png` show the Treatments tab with those chips.

## Gotchas

- `Misprint offset` is disabled with no selection. `Type strip` is disabled unless the selection is type.
- Both used to add extra layers. They now live on the selected layer's treatment stack.
- Opening Instruments replaces the left rail. Switch back to Treatments after applying.
