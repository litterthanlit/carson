# Decay marks instrument

Age selected, Ink loss, and Fold marks apply through the Instrument registry onto the layer treatment stack. The source layer stays in the document. Chips expose re-roll, bypass, and remove.

## Sub-features

- `decay-select` targets `Oversized headline`.
- `decay-age` runs Age selected from Instruments.
- `decay-ink-loss` runs Ink loss from Instruments.
- `decay-fold` runs Fold marks from Instruments.
- `decay-inspect` shows those treatments in the Treatments tab.

## How to get to it (user POV)

- Choose Instruments, then `Age selected`, `Ink loss`, or `Fold marks`.
- Open Commands and run Age selected, Ink loss, or Fold marks.
- Press `I` to open Instruments, then choose one of those three.

## Driving it with verify-carson

Preconditions:

- Doctor reports the expected URL and this run's pid.
- A single content layer is selected. ActiveSelection is not valid for this control.

- **Select headline.** Choose tab `Layers`, then `Oversized headline`. Run `node .cursor/skills/verify-carson/scripts/drive.mjs --feature decay-marks`.
- **Open Instruments.** Choose `Instruments`. Complementary region `Instruments` is visible.
- **Age selected.** Choose `Age selected`.
- **Ink loss.** Choose `Ink loss`.
- **Fold marks.** Choose `Fold marks`.
- **Leave Instruments.** Choose `Move tool` so the inspector is unobstructed.
- **Inspect stack.** Choose tab `Treatments`. The empty copy `No layer treatments yet` is absent. Chips include Age/Decay, Ink loss, and Fold.
- **Chip ops.** Choose `Re-roll seed`, then `Bypass`, on the Inspector stack.
- **Proof.** `artifacts/decay-marks/treatments.aria.txt` and `treatments.png` show the Treatments tab with those chips.

## Gotchas

- `Age selected`, `Ink loss`, and `Fold marks` are disabled with no selection.
- Ink loss and Fold marks used to add extra shape layers. They now live on the selected layer's treatment stack.
- Opening Instruments replaces the left rail. Switch back to Treatments after applying.
