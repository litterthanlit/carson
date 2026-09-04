# Press Check

Press Check is a live poster look: ink spread, plate misregistration, and paper tooth. The designer turns it on as a mode, keeps it, and export includes it.

## Sub-features

- `press-check-toggle` turns the mode on from Instruments.
- `press-check-chip` shows a poster treatment chip on Treatments.
- `press-check-params` exposes Ink spread, Misregistration, and Paper tooth sliders.
- `press-check-reroll` re-seeds the look from the chip dice.
- `press-check-bypass` hides the look without removing the mode.
- `press-check-trail` records the turn-on on the exploration trail and undoes it.
- `press-check-commands` turns the same mode on from Commands.

## How to get to it (user POV)

- Choose Instruments, then `Press Check`.
- Open Commands and run `Press Check`.
- Press `I` to open Instruments, then Press Check.

## Driving it with verify-carson

Preconditions:

- Doctor reports the expected URL and this run's pid.
- Seed poster is loaded. No Press Check chip yet.

- **Open Instruments.** Choose `Instruments`. Complementary region `Instruments` is visible.
- **Turn on.** Choose `Press Check`. The control is pressed (`Turn off Press Check`).
- **Treatments.** Choose `Move tool`. Choose tab `Treatments`. Poster treatments include `Press Check`. Sliders `Ink spread`, `Misregistration`, and `Paper tooth` are visible. Region `Exploration trail` includes `Turned on Press Check`.
- **Undo.** Choose `Undo`. Press Check leaves the stack.
- **Commands.** Choose `Commands`. Search `Press Check`. Choose `Press Check`. Treatments list Press Check again.
- **Re-roll and bypass.** Choose `Re-roll seed` on the Press Check row. Choose `Bypass`. The row is bypassed.
- **Proof.** `artifacts/press-check/treatments.aria.txt` shows the mode on. `commands.png` shows it restored from Commands then bypassed.

## Gotchas

- Press Check is a poster treatment, not a layer stack item. It appears under Poster treatments even with no layer selected.
- The Instruments control is named `Press Check` and becomes `Turn off Press Check` while the mode is on.
- Commands labels match that toggle: `Press Check` off, `Turn off Press Check` on.
- Bypass keeps the chip and turns the look off. Remove or Turn off deletes the mode.
- Export includes the overlay because it is a canvas companion, not a CSS preview. Do not treat Vitest as export proof.
