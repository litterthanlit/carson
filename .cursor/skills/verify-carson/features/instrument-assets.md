# Instrument and Gesture assets

Save a tuned Instrument or a Gesture as a named asset on this document, then play it on another layer from Assets, Instruments, or Commands.

## Sub-features

- `instrument-save` stores the selected treatment as a named document Instrument.
- `instrument-assets` lists that Instrument on the Assets tab.
- `instrument-replay` plays it on another layer from Instruments.
- `instrument-commands` plays the same asset from Commands.
- `instrument-trail` records the play on the exploration trail and undoes it.

## How to get to it (user POV)

- On Treatments, choose `Save as instrument` on a layer treatment chip.
- Choose the saved name under Instruments on the Assets tab.
- Choose Instruments, then the saved name under Saved instruments.
- Open Commands and run `Play instrument` plus the name.

## Driving it with verify-carson

Preconditions:

- Doctor reports the expected URL and this run's pid.
- Seed poster is loaded. Headline is selected before Copy selected.

- **Xerox the headline.** Choose tab `Layers`, then `Oversized headline`. Choose `Instruments`, then `Copy selected`.
- **Save.** Choose `Move tool`. Choose tab `Treatments`. Choose `Save as instrument`. The prompt is accepted as `Mark`.
- **Assets.** Tab `Assets` is active. Heading `Instruments` is visible. Button `Play instrument Mark` is present. Capture `assets`.
- **Replay.** Choose tab `Layers`, then `Red interruption`. Choose `Instruments`. Choose `Play instrument Mark`. Choose `Move tool`. Choose tab `Treatments`. The empty copy `No layer treatments yet` is absent. Region `Exploration trail` includes `Played Mark`. Capture `replay`.
- **Undo.** Choose `Undo`. Treatments on this layer return to empty.
- **Commands.** Choose `Commands`. Search `Mark`. Choose `Play instrument Mark`. Treatments again list Xerox. Capture `commands`.

## Gotchas

- `Save as instrument` lives on the layer treatment row, not the poster Press Check chip.
- The driver accepts `window.prompt` as `Mark`, so the saved name is `Mark`.
- Accessible name is `Play instrument Mark`. Gesture play buttons stay `Play {name}` / visible `Mark`.
- Opening Instruments replaces the left rail. Switch back to Treatments after replay.
- Save stack as gesture is a chain. This feature saves one tuned operator.
