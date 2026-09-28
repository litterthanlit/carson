# Carson — Filter & Texture Gallery Audit

*Source read of `main` @ `9df12e4`, plus a Playwright drive of both galleries in Chromium (1440×960) on a fresh clone, using the wreck poster with `Oversized headline` selected. Scope: `FilterGalleryModal.tsx`, `TextureGalleryModal.tsx`, `lib/filterGallery.ts`, `lib/filterPreview.ts`, `lib/textureGallery.ts`, `textureCatalog.generated.ts`, `scripts/import-textures.py`, the App wiring (`App.tsx:3898–3939`, `5258–5273`) and the `.filter-gallery-*` CSS. This pass only reports issues. Nothing is fixed yet.*

---

## 0. Headline

Both galleries have good bones. The preset catalog is sensible, previews are cached, the modals load lazily, and texture thumbnails are committed to the repo. The problems sit around the modals, not inside them:

1. **The editor's global shortcuts still run while a gallery is open.** Backspace deletes the layer you are previewing, and Escape deselects it instead of closing the dialog.
2. **The Texture Gallery can't place anything on a fresh checkout or a deployed build.** Full-size rasters are gitignored, but the committed catalog still points at them, and the failure is silent.

Both problems were reproduced in the browser. Everything else is a correctness, preview-fidelity or accessibility issue of lower severity.

---

## 1. Critical: reproduced live

| # | Finding | Evidence | Fix |
|---|---|---|---|
| C1 | **Global shortcuts leak through the modals.** The editor's `keydown` handler (`App.tsx:1016`) has no "modal open" guard. `isTypingContext` only exempts inputs and `[role=listbox]`. The dialog itself gets focus on open (`dialogRef.current?.focus()`), and so do the category buttons, fit buttons and Apply. From any of those, Delete/Backspace deletes the layer, arrow keys nudge it, and `T`, `R`, `G`, `V`, Cmd+Z and Cmd+D all act on the poster behind the dialog. | With the Filter Gallery open on `Oversized headline`, pressing **Backspace** took the layer count **from 22 to 21**. The status bar read "Deleted layer", and the gallery switched to "Select a layer first." | Add one `modalOpenRef` (or a `data-modal-open` check on `document.body`) and return early from the editor handler when it is set. Better long term: a shared `<Dialog>` primitive that stops key events from propagating. See §5. |
| C2 | **Escape doesn't close the Filter Gallery. It empties it instead.** The editor handler runs first and calls `actions.deselect()`, so `source` becomes `null`. The modal's own window listener never closes the dialog, which is left showing "Select a layer first." with only the ✕ button. It is also probably removed during dispatch: `onClose` is a new arrow on every App render, so the effect re-subscribes. | Drive: `Escape closes: false`, and the dialog text became "…Select a layer first." | Handle Escape in the dialog's own `onKeyDown` with `stopPropagation()`, and pass a stable `onClose` (`useCallback`). C1's guard also covers this. |
| C3 | **Placing a texture fails on any clone or deploy, with no feedback.** `.gitignore` excludes `public/textures/full/`, but the committed `textureCatalog.generated.ts` lists all 89 entries with `src: "textures/full/…"`. `placeTextureFromGallery` has no `try/catch`. It is invoked as `void placeTextureFromGallery(...)`, and the modal closes before the load settles. | Drive: the large preview is a broken image (alt "Print 1"). Clicking **Place texture** closed the modal, left the layer count unchanged (21 → 21), and threw an uncaught `fabric: Error loading …/textures/full/print-1.jpg`. No status message appeared. | Short term: catch the error, keep the modal open, and show "Full-resolution file not installed — run `npm run import-textures`". Mark entries whose full file is missing (a HEAD probe on open, or an `available` flag written by the importer). Long term: see §5. |

---

## 2. High: correctness and fidelity

| # | Finding | Impact | Fix |
|---|---|---|---|
| H1 | **Stale previews can win the race.** `refreshPreview` is debounced, but the async `renderFilterPreview` has no request token. If a slow preset (for example Heavy Gaussian) resolves after a fast one, it overwrites the newer preview. `previewLoading` is a single boolean, so the first `finally` hides "Updating preview…" while a later render is still running. | The preview can show a different preset from the one selected. | Keep a `requestIdRef` and ignore results whose id isn't the latest. Derive loading from `latestId !== settledId`. Cancel the debounce timer on unmount. |
| H2 | **The preview renders at a fixed 0.35× and never upscales.** `source.toDataURL({ multiplier: 0.35 })`, then `createThumbnail(…, 420)` only shrinks (`Math.min(1, …)`). A 600 px text layer therefore previews at about 210 px, stretched to fill the pane. A thin rule previewed at **1×420 px** in the drive. | Soft or degenerate previews for small layers. The main preview isn't really "420". | Pick the multiplier from the layer's bounds: `multiplier = clamp(targetPx / max(w, h), 0.05, 1)`. Render once per open and reuse that raster. |
| H3 | **Motion blur previews about 3× stronger than it applies.** `distance` is absolute pixels (`pixelFilters.ts:506`), but it runs on the 0.35× raster. Gaussian, radial and zoom blur are resolution-relative, so they preview correctly. | The Motion blur and Diagonal motion thumbnails and preview don't match the result. | Scale absolute-pixel params (`distance`, `blocksize`) by the preview multiplier inside `renderFilterPreview`. |
| H4 | **Every thumbnail re-rasterizes the source.** The loop calls `renderFilterPreview` per preset, and each call runs `source.toDataURL(...)` plus a synchronous `applyFilters()` on the main thread. Thumbnails only appear after **all** presets in the category finish (`setThumbUrls(next)` runs once). | A jank burst each time you switch category on large image layers, followed by a blank grid that fills in all at once. | Rasterize the source once. Update state as each thumbnail lands. Yield between presets (`await scheduler.yield?.()` or `requestIdleCallback`), or run the CPU filters in the existing Copy Machine worker. |
| H5 | **Transparency is flattened to white in previews.** JPEG encoding turns a text layer's transparent bounds into a white box (the corner pixel sampled `255,255,255,255`). The canvas result is still transparent, and the poster shows through it. | Previews of type and shapes, and of multiply-mode treatments (Xerox, Decay, Cold wash), don't match how they composite on the poster. | Encode previews as PNG or WebP with alpha. Show them on the checker pattern the Texture Gallery already has (`.checker`), or better, on the poster crop behind the layer. |
| H6 | **Scatter presets preview as rotate-and-scale only.** `applyScatterTransform` moves `left/top`, but `image.toDataURL()` renders the object in its own bounds, so the Distance parameter has no visible effect. | The Transform category's thumbnails for Drift, Scatter and Explode look almost the same. | Render the scatter preview into a padded frame that includes the translation, or draw a ghost of the original position. |
| H7 | **The texture thumbnail grid overlaps.** Tiles in `.filter-gallery-thumbs` overlap in the drive screenshot. Rows are shorter than the square `aspect-ratio: 1` images, so names are hidden and the last tile stretches. The Filter Gallery's grid, which uses the same classes, renders correctly. | Texture names are unreadable, and it is hard to tell which tile is selected. | Give `.filter-gallery-thumb` an explicit `height: auto; align-content: start` and set `grid-auto-rows: max-content` on the grid. Check against global `button` sizing rules. |

---

## 3. Medium: accessibility and interaction

| # | Finding | Fix |
|---|---|---|
| A1 | The dialogs lack `aria-modal="true"`, a focus trap, and focus return to the element that opened them. Tab walks into the editor behind the dialog. | Use a shared Dialog primitive (native `<dialog>` with `showModal()` gives all three, plus Escape handling, for free). |
| A2 | The `role="listbox"` wraps `<button role="option">` elements with no arrow-key navigation, no `aria-activedescendant` and no roving tabindex. Every tile is a Tab stop, which is 30+ stops in some categories. | Use a roving tabindex with ←/→/↑/↓, Home and End. Alternatively, make it a plain group of `aria-pressed` buttons and drop the listbox role. |
| A3 | The accessible name of the listbox uses internal ids (`"color filters"`, `"film filters"`), while the visible tabs say **Adjust** and **Look**. | Use `item.label`. |
| A4 | Category buttons show their active state only visually. | Add `aria-pressed` to the category buttons, or make them `role="tab"` with `aria-selected` and a matching `tabpanel`. |
| A5 | Disabled presets (Cold wash on a non-image layer) use `disabled`, so keyboard and screen-reader users never reach the explanation in `title`. `title` isn't announced reliably either. | Use `aria-disabled="true"` so the tile stays focusable, and show the reason in the params panel, which already has copy for it. |
| A6 | Preview images use `alt="Filter preview"` and blank `alt` on thumbnails. | Use `alt={`${preset.name} preview of ${layerName}`}`. Thumbnail `alt=""` is fine because the name is in the label. |
| A7 | There is no reduced-motion or high-contrast check on the active-tile ring, which is an accent-colored 1 px ring on a light tile. | Use a 2 px `outline` with an offset and verify ≥3:1 non-text contrast. |
| I1 | State resets on every open. The components are only mounted while open (`{filterGalleryOpen ? <… open /> : null}`), so category, selection and blend choice are lost, and every `if (!open)` branch is dead code. | Either keep them mounted and honor `open`, or lift "last category / last preset" into App or `localStorage`. |
| I2 | The Texture Gallery preview shows the raw texture. Blend and opacity changes aren't previewed at all. | Composite the texture over a poster snapshot with the chosen `globalCompositeOperation` and opacity (a cheap 2D canvas draw). |
| I3 | Filter params can't be reset per slider, and there is no before/after toggle. | Add a press-and-hold "Original" button over the preview (a Photoshop pattern), and use Slider's `defaultValue` for double-click reset. |

---

## 4. Low: content and catalog

| # | Finding | Fix |
|---|---|---|
| L1 | **79 of the 89 texture names are generic** ("Print 1", "Found 01"). One more is truncated to 39 characters with "…" by `import-textures.py:96`. | Keep the full name in `title` and the `aria-label`, and truncate only with CSS (`text-overflow: ellipsis`). Let the importer read an optional `names.json` sidecar for human names. |
| L2 | The categories are uneven: Ink 31, Print 25, Found 16, Paper 8, Grunge 5, Lens 2, Photocopy 1, Surface 1. | Merge Photocopy into Print, and Surface into Grunge, or hide categories with fewer than 3 textures. |
| L3 | The blend list has 6 modes (no Darken, Color burn, Hard light, Difference or Luminosity), and "Normal" is last. | Use Normal first, grouped like Photoshop: Darken / Lighten / Contrast / Inversion / Component. |
| L4 | Texture opacity has a hidden `min={8}`, with no explanation. | Use a minimum of 0, or add a hint. |
| L5 | The filter taxonomy is mixed. Grain sits under **Adjust**, Newsprint and Wash paint under **Stylize** alongside the separate **Print** category, and 10 category buttons take five rows of the sidebar before any thumbnail shows. | Use a horizontal segmented control or a `<select>` for categories. Move Grain to Look and Newsprint to Print. |
| L6 | Texture thumbnails have no `loading="lazy"` or `decoding="async"`. | Add both. This is cheap and helps the Ink tab (31 images). |
| T1 | **Test gaps.** No component tests exist for either modal. Nothing asserts that catalog `src` files exist, that Escape closes the dialog, or that editor shortcuts are inert while it is open. | Add RTL tests for Escape and Backspace inertness, and a test for the `onPlace` failure path. Add a vitest check that every `thumb` exists on disk. Add a `filter-texture-gallery` recipe to `verify-carson`. |

---

## 5. Recommended order

1. **C1 + C2 (about 1 hour).** Add a modal guard in the editor key handler, make `onClose` stable, and handle Escape locally. This removes the data-loss path.
2. **C3 (about 1 hour).** Add error handling and a "not installed" state. Have the importer write `available: false` when a full file is missing, and have the gallery disable Place for those entries.
3. **H1–H5 (half a day).** Rasterize the source once per open at a size-aware multiplier, add a request token for previews, render thumbnails progressively, scale absolute-pixel params, and use alpha-preserving previews.
4. **A1–A5 + H7 (half a day).** Extract one `<GalleryDialog>` primitive (native `<dialog>`, focus trap, roving grid) and use it for both galleries, plus Comps and the Command palette.

**Best long-term solution.** Treat the galleries as one *Asset Browser* component backed by a manifest, not two near-duplicate modals:

- **One dialog primitive** owns focus, Escape, inert background and keyboard grid navigation. Every modal in Carson inherits correct behavior, and the global key handler only needs to ask "is a modal open?".
- **Textures are served from a content-addressed asset store**, not `public/`. That means an R2/S3 bucket or the IndexedDB asset store the main audit already recommends (P1), with a manifest that records availability and license. The committed catalog then can't point at files that aren't shipped. Licensed packs download on demand; missing ones show a clear "install" state.
- **Previews run in a worker on one downscaled `ImageBitmap`** (the Copy Machine already does this), with parameters normalized to layer size. Preview and apply then use the same code path at different resolutions, so they can't drift apart the way motion blur does today.

---

## 6. In plain terms

- **The dangerous bug:** while a gallery window is open, keyboard shortcuts still reach the poster behind it. Pressing Backspace to "go back" deletes your layer, and Escape doesn't close the window. It unselects the layer, leaving the window blank.
- **The broken bug:** the texture picker shows pictures, but the full-size files behind them were never uploaded, so on anyone else's machine or on the web, "Place texture" silently does nothing.
- **The misleading bits:** filter previews are made from a small, low-res copy of your layer. Some effects (motion blur) look much stronger in the preview than on the poster, see-through areas show as white, and switching quickly can briefly show the wrong filter.
- **The polish:** screen-reader and keyboard users can't get around the grid well, most textures are called "Print 1"-style names, and the texture grid tiles overlap.
- **The durable fix:** build one well-behaved "picker window" that every dialog uses, store textures somewhere the app can always reach, and generate previews the same way the real filter runs, just smaller.
