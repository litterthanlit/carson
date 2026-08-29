# Component instances

Save selection stores a reusable mark in Assets. Insert places a linked instance. Detach unlinks it into a regular layer.

## Sub-features

- `component-save` writes the current selection as an object component named `Mark`.
- `component-insert` places a linked instance from the Assets thumbnail.
- `component-detach` removes Reset, Detach, and Update from Inspect.

## How to get to it (user POV)

- Choose tab `Assets`, then `Save selection as component`, and type a name in the prompt.
- Choose the component thumbnail in Assets, or drag it onto the canvas.
- Open Commands and run Save selection as component or Detach component instance.
- On Inspect, choose Detach while an instance is selected.

## Driving it with verify-carson

Preconditions:

- Doctor reports the expected URL and this run's pid.
- Two seed layers can be grouped.
- The driver accepts `window.prompt` with `Mark`.

- **Group then save.** Group `Oversized headline` and `Red interruption`. Choose tab `Assets`, then `Save selection as component`. Run `node .cursor/skills/verify-carson/scripts/drive.mjs --feature component-instances`. An Assets control named `Mark` appears. Status contains `Saved component`.
- **Insert instance.** Choose `Mark`. Status contains `Instance of`. Inspect shows Detach, Reset, and Update.
- **Detach.** Choose Detach. Status contains `Detached`. Detach is gone from Inspect.
- **Proof.** `artifacts/component-instances/instance.aria.txt` includes `Component instance`. `detached.aria.txt` does not include a Detach button.

## Gotchas

- A native prompt that returns empty aborts save. The driver must accept the dialog.
- Clicking Assets can miss if treatment chips overlap the tab. The driver clicks the tab role, not coordinates.
- The source selection becomes the first instance on save. Insert creates a second copy. Proof of insert is status `Instance of` plus the Inspect instance card, not merely that a group exists.
- Stack-kind components are chips, not the thumbnail grid. This recipe is object kind only.
