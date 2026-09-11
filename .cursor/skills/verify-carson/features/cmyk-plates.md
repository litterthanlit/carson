# CMYK plates

Print → Export CMYK plates downloads a four-page PDF of grayscale C, M, Y, and K separations. Soft-proof stays a screen preview; plates are the press files.

## Sub-features

- `plates-print-tab` starts from the Print inspector.
- `plates-download` produces a PDF whose suggested name ends with `-plates.pdf`.
- `plates-commands` exposes the same export in the command palette.

## How to get to it (user POV)

- Inspector tab `Print` → `Export CMYK plates`.
- Commands → Export CMYK plates.

## Driving it with verify-carson

Preconditions:

- Doctor reports the expected URL and this run's pid.
- Onboarding is dismissed (`Skip intro`).

- **Open Print.** Choose tab `Print`. Button `Export CMYK plates` is visible.
- **Export.** Choose `Export CMYK plates`. Playwright receives a download whose suggested filename ends with `-plates.pdf`.
- **Commands path.** Open Commands, search `plates`, confirm `Export CMYK plates` is listed (do not download a second file).
- **Proof.** `download.txt` contains the filename. `after-plates.png` shows heading `Carson` and the Print tab.

## Gotchas

- Soft-proof is a live RGB preview, not the plate export.
- Default export scale is 2x, so the PDF pages are larger than the CSS poster. Assert the filename, not pixel size.
- jsPDF triggers a download; wait for the Playwright `download` event before asserting.
