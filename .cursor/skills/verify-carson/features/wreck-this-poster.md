# Wreck this poster

First-run play teaches scatter, xerox, re-roll, and undo on the seeded headline instead of dismissing the intro.

## Sub-features

- `wreck-start` begins the walkthrough from `Let's wreck it` and keeps the canvas playable.
- `wreck-scatter` applies Scatter to `Oversized headline` from Instruments.
- `wreck-xerox` applies Copy selected on that same layer.
- `wreck-reroll` re-rolls the last accident from the stage bar.
- `wreck-undo` undoes from the header and ends the coach.

## How to get to it (user POV)

- Open the launched origin in a fresh browser profile so `Wreck this poster` appears.
- Choose `Let's wreck it`. Do not choose `Skip intro`.
- Follow the coach: Scatter, Copy selected, Re-roll, Undo.

## Driving it with verify-carson

Preconditions:

- Doctor reports the expected URL and this run's pid.
- Playwright profile is empty so onboarding can appear.
- This feature must not auto-dismiss the dialog. Drive it with `--keep-onboarding`.

- **Start play.** Choose `Let's wreck it`. Dialog `Wreck this poster` hides. Region `Wreck this poster` shows Play 1 / 4. Complementary region `Instruments` is visible.
- **Scatter.** Choose `Scatter`. The coach title becomes `Xerox it`. A `Re-roll` control appears in the stage toolbar.
- **Xerox.** Choose `Copy selected`. The coach title becomes `Re-roll the accident`.
- **Re-roll.** Choose the stage `Re-roll` control. The coach title becomes `Walk it back`.
- **Undo.** Choose `Undo` in the header. Region `Wreck this poster` is gone. Status mentions the whole game.
- **Proof.** `artifacts/wreck-this-poster/after-undo.aria.txt` and `after-undo.png` show heading `Carson` and no walkthrough region.

## Gotchas

- `Skip intro` is a different path. It is covered by editor-baseline, not this feature.
- `Copy selected` is disabled with no selection. `Let's wreck it` selects `Oversized headline` first.
- Re-roll is missing until Scatter (or another chaos move) has run. Use the stage control named `Re-roll last accident`, not a treatment chip dice.
- Opening Instruments from the rail is unnecessary after `Let's wreck it`. The walkthrough opens it.
