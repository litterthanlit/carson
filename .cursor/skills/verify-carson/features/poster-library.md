# Poster library

Launch shows the Posters dashboard. New poster opens the editor; All posters returns to the library where saved posters can be opened, renamed, duplicated, or deleted.

## Sub-features

- `library-launch` shows main `Posters` with `New poster` before the editor.
- `library-save` saves the current poster and lists it on the dashboard.
- `library-open` opens a different saved poster from the dashboard.
- `library-file` duplicates, renames, and deletes a poster without leaving the dashboard.

## How to get to it (user POV)

- Open the launched origin. The Posters dashboard is first.
- Choose `New poster`, then `Skip intro` if `Wreck this poster` appears.
- Name the poster, choose `Save`, then `All posters`.
- Choose another poster’s `Load` control to reopen it.

## Driving it with verify-carson

Preconditions:

- Doctor reports the expected URL and this run's pid.
- Playwright profile is empty so the dashboard and onboarding can appear.
- `dismissOnboarding` already chose `New poster` then `Skip intro`.

- **Save first poster.** Set Project name to `Alpha`. Choose `Save`. Status mentions `Saved “Alpha”`.
- **Open library.** Choose `All posters`. Main `Posters` shows `Load “Alpha”`.
- **Second poster.** Choose `New poster`. Name it `Beta`, choose `Save`, then `All posters`.
- **Load the other poster.** Choose `Load “Alpha”`. Status mentions `Loaded Alpha`. Project name is `Alpha`.
- **File it.** Choose `All posters`, `Duplicate Alpha`, `Rename Alpha copy` (prompt accepts `Mark`), then `Delete saved poster Mark`. `Load “Alpha”` and `Load “Beta”` remain; `Load “Mark”` is gone.
- **Proof.** Artifacts `after-first-save`, `after-load-alpha`, and `library` include screenshots plus ARIA dumps of the dashboard and the loaded Alpha editor.

## Gotchas

- First paint is the dashboard, not the seeded canvas. `New poster` is required before `Skip intro`.
- The wreck dialog only appears on the first `New poster` in a fresh profile. Later `New poster` goes straight to the editor.
- `All posters` is the brand mark in the editor header. It is not in Inspect.
- Rename uses `window.prompt`. The driver accepts prompts as `Mark`.
- Delete uses `window.confirm`. The driver accepts confirms.
