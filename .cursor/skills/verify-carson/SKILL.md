---
name: verify-carson
description: Drive the Carson poster editor in an isolated local browser and capture proof of user-facing behavior. Use when verifying Carson UI, grouping, components, treatments, export, or any editor change that needs a real user path rather than unit tests.
---

# Verify Carson

Carson is a Vite + React + Fabric.js poster editor. The user surface is the browser UI at a local origin. There is no CLI product path. IndexedDB (`carson-poster`) and `localStorage` (`carson.onboarding.v1`) are origin-scoped.

Never attach to the operator's `npm run dev` on port 5173. Launch the instance this skill starts, then drive only that origin.

Read [features/README.md](features/README.md) before a run. Drive the feature file that matches the change. A proof that hits one convenient entry and ignores other listed entry points is incomplete.

## Launch

From the repo root:

```bash
chmod +x .cursor/skills/verify-carson/scripts/*.sh
.cursor/skills/verify-carson/scripts/launch.sh
```

Defaults: `http://127.0.0.1:4173/` with `--strictPort`. Override with `CARSON_VERIFY_HOST` and `CARSON_VERIFY_PORT`. Ready when `curl` returns HTML containing `<title>Carson</title>`. The script prints `CARSON_VERIFY_RUN_DIR`, `URL`, and `PID`, and points `.cursor/skills/verify-carson/.run/current` at that run directory.

If Chromium is missing for Playwright:

```bash
npx playwright install chromium
```

Teardown is [Cleanup](#cleanup). Do not leave the verify Vite process running after the proof.

## Doctor

```bash
.cursor/skills/verify-carson/scripts/doctor.sh
```

Pass only when the recorded Vite pid is alive, that pid owns the recorded port, and `GET $URL` returns the Carson document. If doctor fails, stop. Do not drive a foreign process on the same port.

## Drive

```bash
node .cursor/skills/verify-carson/scripts/drive.mjs --run-dir "$CARSON_VERIFY_RUN_DIR" --feature editor-baseline
```

`drive.mjs` opens Playwright Chromium with a user-data-dir inside the run directory, so IndexedDB and onboarding state stay off the operator's browser. It dismisses `Skip intro` when the `Wreck this poster` dialog is present. Feature recipes live in that file and in `features/*.md`. Prefer ARIA roles and accessible names. Do not click by coordinates.

Stable handles:

- Dialog `Wreck this poster`, buttons `Let's wreck it` and `Skip intro`
- Region `Wreck this poster` (coach, after Let's wreck it)
- Region `Poster canvas`, heading `Carson`
- Tabs `Inspect`, `Treatments`, `Layers`, `Assets`, `Layout`, `Print`
- Layer rows: the control titled `Select layer · double-click to zoom to layer`
- Seed layer names `Oversized headline`, `Red interruption`
- Buttons `Group`, `Ungroup`, `Save selection as component`, `Detach`, `Scramble layout`, banner `Export`
- Instruments tool, then `Copy selected`
- Instruments tool, then `Age selected` / `Ink loss` / `Fold marks`
- Instruments tool, then `Misprint offset` / `Type strip`
- Instruments tool, then `Record gesture` / `Save performance`
- Status region `.stage-status` (`role=status`)
- Region `Exploration trail`, buttons `Fork` and `Comps gallery`
- Dialog `Comps`, dialog `Compare variations`

`window.prompt` during Save selection is accepted as `Mark` by the driver.

## Evidence

Write under `.cursor/skills/verify-carson/artifacts/<feature>/`. Keep that tree through cleanup.

Proof standard:

- Exercise the real control a user clicks. Do not call Fabric or React internals.
- Capture the action and the resulting state. An ARIA dump plus a screenshot of the named end state. For export, keep the downloaded PNG and `download.txt`.
- Status text alone is not enough when a second view exists (Inspect after insert, Layers after group).
- Vitest passing is not a substitute for this skill.

## Cleanup

```bash
.cursor/skills/verify-carson/scripts/cleanup.sh
```

Kills only the pid recorded in `run.json`. Removes the Playwright profile under the run dir. Leaves `artifacts/` in place. Does not delete `/tmp/carson-verify-*` logs by default so a failed launch can still be read. Those dirs are scratch, not proof.

## Helpers

| Command | What it does |
| --- | --- |
| `scripts/launch.sh` | Runs `start-vite.mjs`. Detached Vite survives the launching shell. |
| `scripts/doctor.sh` | Confirms this run owns the URL |
| `scripts/drive.mjs --feature <id>` | Plays one mapped feature |
| `scripts/cleanup.sh` | Stops this run's Vite pid |

Feature ids: `editor-baseline`, `wreck-this-poster`, `layer-groups`, `component-instances`, `xerox-treatment`, `decay-marks`, `misprint-type-strips`, `gesture-performance`, `export-png`, `variations-trail`.
