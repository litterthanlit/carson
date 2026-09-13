# File identity

Save as and Duplicate copy the open poster as a new file. Dirty sessions return as a Recovered Home card. Opening a poster without saving promotes it on Home.

## Sub-features

- `duplicate-copy` copies the open poster to a new file and keeps the original; Home then shows both.
- `save-as-copy` names a new file without overwrite-by-confirm; the original stays on Home.
- `save-as-collision` refuses an existing name in the Save as dialog.
- `last-opened` promotes a poster that was opened without saving above a newer save.
- `recovered-card` shows unsaved work on Home as Recover, not `window.confirm`.

## How to get to it (user POV)

- Open the launched origin in a fresh browser profile.
- Choose `Skip intro` on `Wreck this poster`.
- Create and Save posters from Home `New poster`.
- In the editor: `Duplicate poster`, `Save as`, then `Home`.
- Leave a dirty poster with `Home` to get a Recovered card.

## Driving it with verify-carson

Preconditions:

- Doctor reports the expected URL and this run's pid.
- Playwright profile is empty so onboarding can appear and IndexedDB has no posters.
- Drive with `--feature file-identity`. The driver must not auto-enter the editor after Skip intro.

- **Empty Home.** Choose `Skip intro`. Region `Home` shows `No saved posters yet`.
- **Two files.** `New poster` → Create → name `Night bus` → Save → Home. Repeat with `Day plaza`. Card `Open Day plaza` is first among Open cards.
- **Duplicate.** Choose `Open Night bus`. Choose `Duplicate poster`. Status mentions `Duplicated as “Night bus copy”`. Choose `Home`. Buttons `Open Night bus` and `Open Night bus copy` are both present.
- **Last opened.** Choose `Open Day plaza` without editing. Choose `Home`. The first `Open …` card is `Open Day plaza`.
- **Save as.** Choose `Open Night bus`. Choose `Save as`. Dialog `Save as` is visible. Replace the name with `Night bus evening`. Choose `Save copy`. Status mentions `Saved as`. Choose `Home`. Buttons `Open Night bus` and `Open Night bus evening` are both present.
- **Collision.** Choose `Open Night bus evening`. Choose `Save as`. Name it `Night bus`. Role `alert` explains the name exists. `Save copy` stays disabled.
- **Recovered.** Cancel Save as. Choose `New poster` → Create. Add a `Block`. Choose `Home`. Button `Recover Untitled poster` is present. No restore `window.confirm`.
- **Proof.** Artifacts `empty-home`, `duplicated-grid`, `last-opened`, `saved-as-grid`, `save-as-collision`, and `recovered-card` include ARIA dumps and screenshots of those named states.

## Gotchas

- `Duplicate poster` is a file copy. Cmd+D still duplicates a selected layer.
- Save as never overwrites; regular Save still can confirm a name collision.
- Recovered is `Recover <name>`, not `Open <name>`. Last-opened checks use Open cards only.
- Editor recipes auto-click `Start from wreck` after Skip intro. This feature must not.
