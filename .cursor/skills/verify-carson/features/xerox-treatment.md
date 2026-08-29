# Xerox treatment

Copy selected runs a xerox treatment on the current layer. The Treatments tab then lists that stack instead of the empty hint.

## Sub-features

- `xerox-select` targets `Oversized headline`.
- `xerox-apply` runs Copy selected from Instruments.
- `xerox-inspect` shows a non-empty Treatments tab.

## How to get to it (user POV)

- Choose Instruments, then `Copy selected`.
- Open Commands and run Xerox copy.
- Press `I` to open Instruments, then choose `Copy selected`.

## Driving it with verify-carson

Preconditions:

- Doctor reports the expected URL and this run's pid.
- A single content layer is selected. ActiveSelection is not valid for this control.

- **Select headline.** Choose tab `Layers`, then `Oversized headline`. Run `node .cursor/skills/verify-carson/scripts/drive.mjs --feature xerox-treatment`.
- **Open Instruments.** Choose `Instruments`. Complementary region `Instruments` is visible.
- **Copy selected.** Choose `Copy selected`. Choose tab `Treatments`. The empty copy `No layer treatments yet` is absent.
- **Proof.** `artifacts/xerox-treatment/treatments.aria.txt` and `treatments.png` show the Treatments tab without that empty hint.

## Gotchas

- `Copy selected` is disabled with no selection.
- The visible label is `Copy selected`, not Xerox. Commands still list Xerox copy.
- Opening Instruments replaces the inspector rail. Switch back to Treatments after applying.
