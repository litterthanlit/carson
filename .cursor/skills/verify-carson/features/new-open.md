# New and Open

New starts a blank poster at a chosen size. Open is a first-class action. Carson asks before replacing unsaved work.

## Sub-features

- `new-size` opens New poster, picks a size, and creates a blank file instead of mutating the open canvas or seeding RAY GUN.
- `open-action` opens saved posters from Open poster / Cmd+O, not only Inspect rows.
- `open-empty` shows `No saved posters yet` when Open has nothing to load.
- `unsaved-open` asks before Open replaces a dirty file, and Cancel keeps the current poster.
- `unsaved-new` asks before New replaces a dirty file.

## How to get to it (user POV)

- Open the launched origin in a fresh browser profile.
- Choose `Skip intro` on `Wreck this poster`.
- Home empty: `New poster`, or `Open poster` via Cmd+O.
- In the editor: `New poster`, `Open poster`, Commands, or Cmd+N / Cmd+O.

## Driving it with verify-carson

Preconditions:

- Doctor reports the expected URL and this run's pid.
- Playwright profile is empty so onboarding can appear and IndexedDB has no posters.
- Drive with `--feature new-open`. The driver must not auto-enter the editor after Skip intro.

- **Empty Open.** Choose `Skip intro`. Press Ctrl+O. Dialog `Open poster` shows `No saved posters yet`. Cancel.
- **New blank.** Choose `New poster`, `Instagram portrait`, `Create poster`. Region `Poster canvas` is visible. Layers do not include `Oversized headline`.
- **Save then New.** Name the poster `Night bus`, Save. Choose `New poster`, `Square`, `Create poster`. Add a `Block` from Shape tools so the file is dirty.
- **Open warns.** Choose `Open poster`, then `Open Night bus`. Dialog `Unsaved changes` appears. Cancel keeps the square file. Repeat Open, choose `Don't save`, status `Loaded Night bus`.
- **New warns.** Add a `Block`. Choose `New poster`, `Create poster`. Dialog `Unsaved changes` appears. `Don't save` starts a blank poster with no seed layers.
- **Proof.** Artifacts `open-empty`, `blank-new`, `unsaved-open`, `opened-poster`, and `unsaved-new` include ARIA dumps and screenshots of those named states.

## Gotchas

- `Start from wreck` is the seeded RAY GUN path. New must not use it.
- Editor recipes auto-click `Start from wreck` after Skip intro. This feature must not.
- Project name edits do not mark the file dirty. Add a layer (Shape → Block) before testing the warning.
- `Save` on the unsaved dialog is a third choice; this recipe covers Cancel and Don't save.
