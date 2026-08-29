# Export PNG

Header Export downloads a PNG of the current poster.

## Sub-features

- `export-header` uses the banner Export button.
- `export-file` produces a download whose suggested name ends in `.png`.

## How to get to it (user POV)

- Choose `Export` in the top bar.
- Press `Cmd+E`.
- Choose the Inspect Export button that includes the pixel size in its name.

## Driving it with verify-carson

Preconditions:

- Doctor reports the expected URL and this run's pid.
- Format in Inspect is PNG. That is the default.

- **Export.** Choose banner button `Export`. Run `node .cursor/skills/verify-carson/scripts/drive.mjs --feature export-png`. Playwright receives a download.
- **Confirm file.** Suggested filename ends with `.png`. The file is saved under `artifacts/export-png/`.
- **Proof.** `download.txt` contains the filename. `after-export.png` shows the editor still open.

## Gotchas

- Inspect also has an Export control with dimensions in the name. The mapped header path is the banner button named `Export`.
- Default scale is 2x, so the file is larger than the CSS poster size. Assert the extension, not a pixel size.
- Do not treat `npm run build` as export proof.
