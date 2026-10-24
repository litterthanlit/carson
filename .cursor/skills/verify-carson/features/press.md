# Press

Every poster prints on one press run. Copier ink, misprint echoes, type strips and Press Check share its ink map, paper and plate slip, so a wet train that floods the headline also darkens the caption beside it. The Print tab's Press card shows the run, re-inks it, turns the feed and switches it off.

## Sub-features

- `press-default` shows a new poster starting on a press.
- `press-ink-map` shows the wet and dry trains over the poster.
- `press-reink` rolls a new run, and undo returns the previous one.
- `press-off` takes the poster off the press, and switching back returns to the same run.

## How to get to it (user POV)

- Choose tab `Print`, then the `Press` card.
- Open Commands and run `Re-ink the press`, `Show ink map` or `Take the poster off the press`.
- Drag a layer that has Ink bleed: its copy rides along and re-inks where it settles.

## Driving it with verify-carson

Preconditions:

- Doctor reports the expected URL and this run's pid.
- The editor is open on `Start from wreck`.

- **Press card.** Choose tab `Print`. Switch `One press for the whole poster` is on, and the `Re-ink` button shows the run's seed. Run `node .cursor/skills/verify-carson/scripts/drive.mjs --feature press`.
- **Ink map.** Choose `Show ink map`. Blue wet trains and amber dry ones cover the poster, with a feed arrow at its corner.
- **Re-ink.** Choose `Re-ink`. The seed changes and the status reads `Re-inked the press`. Press Cmd/Ctrl+Z and the previous seed returns.
- **Off and on.** Turn the switch off, then on. The same seed comes back.
- **Proof.** `artifacts/press/ink-map.png`, `press.aria.txt` and `press.png`.

## Gotchas

- Posters saved before the press open with the switch off and keep their look until it is turned on.
- On the press, Ink bleed follows the press's feed angle, not the Copy Machine's `Scan angle`.
- A big layer at print resolution takes seconds to re-ink after a move or a re-ink. Wait for the bake before judging the canvas.
