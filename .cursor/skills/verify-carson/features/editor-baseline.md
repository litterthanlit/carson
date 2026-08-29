# Editor baseline

First load shows the seeded poster after the intro dialog, with `Oversized headline` selectable in Layers and editable in Inspect.

## Sub-features

- `baseline-onboarding` dismisses `Wreck this poster` without running the walkthrough.
- `baseline-canvas` shows the poster canvas and the Carson heading.
- `baseline-layers` lists seed layers including `Oversized headline` and `Red interruption`.
- `baseline-inspect` shows headline name `Oversized headline` and text containing `RAY GUN`.

## How to get to it (user POV)

- Open the launched origin in a fresh browser profile.
- Choose `Skip intro` on `Wreck this poster`.
- Choose the `Layers` tab, then a layer row, then the `Inspect` tab.

## Driving it with verify-carson

Preconditions:

- Doctor reports the expected URL and this run's pid.
- Playwright profile is empty so onboarding can appear.
- No prior grouping of the seed layers.

- **Skip intro.** Choose `Skip intro`. The driver does this before every feature. The dialog closes and region `Poster canvas` is visible.
- **Open layers.** Choose tab `Layers`. Run `node .cursor/skills/verify-carson/scripts/drive.mjs --feature editor-baseline`. Buttons matching `Oversized headline` and `Red interruption` are present.
- **Select headline.** Choose the `Oversized headline` layer, then tab `Inspect`. The Name textbox value is `Oversized headline`. The Text control value contains `RAY GUN`.
- **Proof.** Artifacts `inspect-headline.proof.json` (name and text), `inspect-headline.aria.txt`, and `inspect-headline.png` show heading `Carson`, Inspect selected, and headline name `Oversized headline`.

## Gotchas

- Driving `localhost:5173` can load the operator's autosave instead of the seed poster. Use the launched `127.0.0.1` origin.
- A restored autosave with decay specks is not baseline. Use a fresh Playwright profile.
- Dialog `Wreck this poster` can lazy-load. Wait for the dialog, then `Skip intro`, then wait until it is hidden. Do not click inspector tabs while `.command-backdrop` is up.
- Hide/Lock/Rename also include the layer name. Click the control titled `Select layer · double-click to zoom to layer`.
- Inspector has two Name fields. Use the Inspector complementary region's first Name textbox, not the project name.
