# Copy machine

Copy machine runs the photocopy warp on the current layer. The Treatments tab then lists that stack instead of the empty hint.

## Sub-features

- `copy-machine-select` targets `Oversized headline`.
- `copy-machine-apply` runs Copy machine from Instruments.
- `copy-machine-inspect` shows a Copy chip on Treatments.

## How to get to it (user POV)

- Choose Instruments, then `Copy machine`.
- Open Commands and run Copy machine.
- Press `I` to open Instruments, then choose `Copy machine`.

## Driving it with verify-carson

Preconditions:

- Doctor reports the expected URL and this run's pid.
- A single content layer is selected. ActiveSelection is not valid for this control.

- **Select headline.** Choose tab `Layers`, then `Oversized headline`. Run `node .cursor/skills/verify-carson/scripts/drive.mjs --feature copy-machine`.
- **Open Instruments.** Choose `Instruments`. Complementary region `Instruments` is visible.
- **Copy machine.** Choose `Copy machine`. Choose tab `Treatments`. The empty copy `No layer treatments yet` is absent, and a `Copy·` chip is present.
- **Proof.** `artifacts/copy-machine/treatments.aria.txt` and `treatments.png` show the Treatments tab without that empty hint.

## Gotchas

- `Copy machine` is disabled with no selection.
- The visible label is `Copy machine`, not Copy selected. Copy selected is the xerox filter.
- Opening Instruments replaces the inspector rail. Switch back to Treatments after applying.
