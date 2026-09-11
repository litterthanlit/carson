# Home recents

Opening Carson shows every saved poster as a picture grid, not the seeded RAY GUN editor. Home stays reachable from the editor.

## Sub-features

- `home-launch` is the first screen after `Skip intro`: region `Home`, not region `Poster canvas`.
- `home-empty` shows `No saved posters yet` and `New poster` when this browser has no saves.
- `home-start` opens a blank editor from that empty control after choosing a size.
- `home-thumbs` shows saved posters as cards with a thumbnail, name, and date.
- `home-open` opens a saved poster from a card.
- `home-back` returns to Home from the editor Home control (and the brand mark).

## How to get to it (user POV)

- Open the launched origin in a fresh browser profile.
- Choose `Skip intro` on `Wreck this poster`.
- Empty studio: choose `New poster`, create, Save, then `Home`.
- With saves: choose a poster card, then `Home` to return.

## Driving it with verify-carson

Preconditions:

- Doctor reports the expected URL and this run's pid.
- Playwright profile is empty so onboarding can appear and IndexedDB has no posters.
- Drive with `--feature home-recents`. The driver must not auto-enter the editor after Skip intro.

- **Land on Home.** Choose `Skip intro`. Region `Home` is visible. Region `Poster canvas` is absent. Copy includes `No saved posters yet`. Button `New poster` is present.
- **Start from empty.** Choose `New poster`, then `Create poster`. Region `Poster canvas` is visible. Heading `Carson` is present.
- **Save a poster.** Set project name to `Home recents proof`, choose `Save`. Status mentions Saved.
- **Return Home.** Choose button `Home`. Region `Home` is visible. Button `Open Home recents proof` is present. The card contains an `img` thumbnail.
- **Reopen.** Choose `Open Home recents proof`. Region `Poster canvas` is visible. Choose `Carson home` (brand). Region `Home` is visible again.
- **Proof.** Artifacts `empty-home`, `saved-grid`, and `reopened` include ARIA dumps and screenshots of those named states.

## Gotchas

- Editor recipes auto-click `Start from wreck` after Skip intro. This feature must not.
- `Let's wreck it` is a different path: it enters the seeded editor for the walkthrough, covered by wreck-this-poster.
- Autosave restore is a recovered card on Home, not `window.confirm`. This recipe starts from an empty profile so that card is absent.
- Two Home controls exist in the editor: button `Home` and `Carson home` on the brand mark.
