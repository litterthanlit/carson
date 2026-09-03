# Gesture performances

Record a chain of instrument plays, save it as a named gesture, and replay that performance from Instruments and Commands. The saved chain is the order of plays, not a snapshot of the current treatment stack.

## Sub-features

- `gesture-record` arms Record on Instruments.
- `gesture-play-chain` captures Strips, then Scatter, then Copy selected.
- `gesture-save` persists the performance on the document.
- `gesture-replay` plays the saved gesture on another layer from Instruments.
- `gesture-commands` replays the same gesture from Commands.
- `gesture-trail` shows a trail chip and undoes the replay in one step.

## How to get to it (user POV)

- Choose Instruments, then `Record`, play instruments, then `Save`.
- Choose the saved gesture button in Instruments.
- Open Commands and run `Play` plus the gesture name.
- Press `I` to open Instruments, then Record.

## Driving it with verify-carson

Preconditions:

- Doctor reports the expected URL and this run's pid.
- A single content layer is selected before Record. ActiveSelection is not valid for these controls.

- **Select headline.** Choose tab `Layers`, then `Oversized headline`. Run `node .cursor/skills/verify-carson/scripts/drive.mjs --feature gesture-performance`.
- **Open Instruments.** Choose `Instruments`. Complementary region `Instruments` is visible.
- **Record.** Choose `Record gesture`. Status `Recorded plays` still says `Play an instrument`.
- **Play chain.** Choose `Strips`, then `Scatter`, then `Copy selected`. Status `Recorded plays` includes `Strips → Scatter` and `Xerox`.
- **Save.** Choose `Save performance`. The prompt is accepted as `Mark`. Instruments shows a button named `Mark`.
- **Replay.** Choose tab `Layers`, then `Red interruption`. Choose `Mark` in Instruments. Choose `Move tool`. Choose tab `Treatments`. The empty copy `No layer treatments yet` is absent. Chips include Slice, Scatter, and Xerox.
- **Trail.** Region `Exploration trail` includes a chip for `Played Mark`. Choose `Undo`. Treatments on this layer return to empty.
- **Commands.** Choose `Commands`. Search `Mark`. Choose `Play Mark`. Treatments again list Slice, Scatter, and Xerox.
- **Proof.** `artifacts/gesture-performance/replay.aria.txt` and `replay.png` show the Treatments tab after Command replay.

## Gotchas

- `Record gesture` becomes `Stop recording gesture` while armed. Save stays available after Stop if plays were captured.
- `Save stack as gesture` on Treatments is the old snapshot path. This feature records plays, including steps later bypassed or removed from the stack.
- The driver accepts `window.prompt` as `Mark`, so the saved gesture name is `Mark`.
- Opening Instruments replaces the left rail. Switch back to Treatments after replay.
- `Copy selected` is the xerox control. Do not click `Copy machine` or `Copy → Scatter → Copy` for this recipe.
