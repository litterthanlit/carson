# Carson verification map

This directory is the maintained source for verifying Carson user-facing behavior. Read this index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch Carson with `.cursor/skills/verify-carson/scripts/launch.sh`.
- Origin is `http://127.0.0.1:4173/` unless `CARSON_VERIFY_PORT` was set.
- Run `.cursor/skills/verify-carson/scripts/doctor.sh` and require the recorded pid to own that port.
- Use a fresh Playwright profile (the driver puts it in the run directory). Do not reuse the operator's browser.
- Dismiss `Wreck this poster` with `Skip intro` when it appears.
- Seed layers include `Oversized headline` and `Red interruption`.
- Never drive an instance that this run did not start.

## Driving conventions

- Start every recipe from the baseline state unless its preconditions say otherwise.
- Prefer ARIA roles and accessible names over CSS selectors or coordinates.
- Treat every command as literal.
- Run browser actions through `node .cursor/skills/verify-carson/scripts/drive.mjs --feature <id>`.
- Restore nothing on the operator's `localhost:5173` session. Isolation is the origin plus the Playwright profile.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes an ARIA text dump and a screenshot with the Carson heading visible.
- Mutation proof includes a second user-facing view (Inspect, Layers, or Assets).
- Record the feature ID in `artifacts/<feature>/meta.json`.
- Report an unreachable path with the command and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with verify-carson` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Editor baseline](./editor-baseline.md) covers first load, onboarding skip, seed layers, and Inspect on the headline.
- [Wreck this poster](./wreck-this-poster.md) covers the interactive first-run walkthrough: scatter, xerox, re-roll, undo.
- [Layer groups](./layer-groups.md) covers grouping two seed layers and ungrouping them.
- [Component instances](./component-instances.md) covers save, insert, and detach of a linked mark.
- [Xerox treatment](./xerox-treatment.md) covers Copy selected from Instruments and the Treatments tab.
- [Decay marks](./decay-marks.md) covers Age selected, Ink loss, and Fold marks as stack instruments.
- [Misprint and type strips](./misprint-type-strips.md) covers Misprint offset and Type strip as stack instruments.
- [Gesture performances](./gesture-performance.md) covers recording instrument plays, saving the chain, and replaying from Instruments and Commands.
- [Press Check](./press-check.md) covers the live print look as a keepable poster treatment.
- [Export PNG](./export-png.md) covers the header Export control and a downloaded PNG.
- [Variations trail](./variations-trail.md) covers the history filmstrip, fork, comps gallery, and compare.
