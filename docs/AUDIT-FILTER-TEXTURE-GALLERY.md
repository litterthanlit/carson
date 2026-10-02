# Carson — Filter & Texture Gallery Audit

*Source read of `main` @ `9df12e4`, plus a Playwright drive of both galleries in Chromium (1440×960) on a fresh clone, using the wreck poster with `Oversized headline` selected. Scope: `FilterGalleryModal.tsx`, `TextureGalleryModal.tsx`, `lib/filterGallery.ts`, `lib/filterPreview.ts`, `lib/textureGallery.ts`, `textureCatalog.generated.ts`, `scripts/import-textures.py`, the App wiring (`App.tsx:3898–3939`, `5258–5273`) and the `.filter-gallery-*` CSS. C1–C3, H1–H7, A1–A7, I1–I3, L5 and L6 are fixed in follow-up commits on `claude/filter-texture-gallery-audit-p0scb6` (see §1a, §2a and §3a). Everything else is still open.*

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

### 1a. Shipped

| # | Fix | Verification |
|---|---|---|
| C1 | Both gallery dialogs carry `aria-modal="true"` and stop key events from propagating (`components/galleryKeys.ts`). The editor's window `keydown` handler returns early while any `[aria-modal="true"]` element is mounted. | Drive: Backspace, → and T with the Filter Gallery open leave the layer count at 22 → 22 and the selection unchanged. |
| C2 | Escape is handled by the dialog's own `onKeyDown`. The window listener and its per-render re-subscription are gone. | Drive: Escape closes both galleries, and `Oversized headline` stays selected. |
| C3 | `onPlace` now returns a promise. The modal waits for it, shows "Placing…", and stays open with an alert if loading fails. `placeTextureFromGallery` sets a status message and rethrows. When the full-size preview fails to load, the texture is marked missing: Place is disabled and the preview explains how to run `npm run import-textures`. | Drive on a fresh clone: the missing-file notice is shown, Place is disabled, and there are no uncaught page errors. |

Tests: `components/GalleryModals.test.tsx` has 5 tests. 4 of them fail against the old components. The 5th covers the success path, which already worked. Full suite 414/414 ✓, `tsc -b` ✓, `npm run build` ✓, lint clean apart from the existing `usePathEditing.ts` warning.

The importer-side `available` flag suggested in C3 wasn't needed: detecting missing files at runtime handles a clone, a deploy and a partial import the same way.

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

### 2a. Shipped

| # | Fix | Verification |
|---|---|---|
| H1 | Each main-preview request gets an id from `previewRequestRef`. Only the newest request may set the preview URL or clear the loading state. The debounce can be cancelled and is cancelled on unmount. | Component test: an older Gaussian render that resolves *after* Heavy gaussian doesn't replace it, and "Updating preview…" clears. |
| H2 | `previewMultiplier()` sizes the raster to the layer's bounds: 640 px on the long side for the preview, 144 px for thumbnails (sharp on 2× screens), clamped to 0.02–2×. The layer is rasterized **once per size** and shared by every preset. | Drive: `Oversized headline` previews at 640×343. The old path produced 1×420 for a thin rule. |
| H3 | `previewPixelRatio()` compares preview pixels with the pixels the filter really runs on: the 2× snapshot for type and shapes, or the image's own element for image layers. `scalePreviewParams()` scales the pixel-measured params (`distance` for motion blur, `blocksize` for pixelate and newsprint) by that ratio. | Unit tests. In the drive, the Motion blur preview and the applied result show the same smear relative to the letterforms. |
| H4 | Thumbnails render at 144 px from the shared raster, appear one by one, and yield to the main thread between presets (`scheduler.yield` when available). | Drive: all 6 Blur thumbnails rendered in about 240 ms. Component test: a thumbnail appears as soon as its render resolves. |
| H5 | Previews are PNG, so transparent areas stay transparent over the paper-toned preview pane. Print, Decay and Cold wash previews use `mix-blend-mode: multiply`, as on the canvas. Thumbnails show the whole layer (`object-fit: contain`) on a paper backing. | Drive screenshots: no white box around type, and the Print thumbnails match the applied Xerox result. |
| H6 | Scatter previews render into a frame padded for the travel distance, with an 18% ghost at the original position. | Drive screenshot: Explode visibly moves, rotates and scales against its ghost. |

H7 (overlapping texture grid) is left for the shared dialog in step 4.

Remaining limitation: 3×3 convolution kernels (Sharpen, Unsharp, Emboss, Find edges) act on single pixels, so their strength still depends on resolution. At 640 px they preview a little stronger than on a large snapshot. A faithful fix means running the preview at applied resolution and downscaling the result, which fits the worker-based renderer in §5.

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

### 3a. Shipped

Both galleries now render inside one `GalleryDialog` component (`components/GalleryDialog.tsx`), and grid keyboard handling lives in `components/gridNavigation.ts`.

| # | Fix | Verification |
|---|---|---|
| A1 | `GalleryDialog` is a native `<dialog>` opened with `showModal()`. It sits in the top layer, and the editor behind it is inert, so neither pointer nor Tab can reach the canvas. Escape (via `cancel` and `keydown`) and a backdrop click call `onClose`. On unmount, focus returns to the element that opened it. It keeps `aria-modal="true"`, so the editor's shortcut guard from C1 still applies. | Drive: `:modal` matches. 30 Tab presses stayed inside the dialog except one stop on `BODY`, which is the browser's own stop before its address bar (native `showModal` behavior); the next Tab comes back in. A backdrop click closes the dialog and focus lands back on the Instruments button. Component test: focus returns to the control that opened it. |
| A2 | Tiles use a roving tabindex: only the selected tile is a Tab stop. Arrow keys, Home and End move focus and selection together, and the column count is read from the rendered grid, so the 3-column mobile layout also works. | Unit tests for `nextGridIndex`. Component test: → ↓ End Home in the texture grid. Drive: → then ↓ lands on tile index 3 and selects it. |
| A3 | The listbox label uses the visible category name ("Adjust filters", "Print textures"). | Component test. |
| A4 | Category buttons carry `aria-pressed`. | Component test. |
| A5 | Image-only filters use `aria-disabled` plus `aria-describedby` instead of `disabled`. They stay focusable and selectable, the params panel explains "Needs an image layer…", and Apply stays disabled. | Component test and drive: Cold wash is selectable on a text layer, and Apply is disabled. |
| A6 | Covered in the previous commit: the preview's `alt` names the preset. | — |
| A7 | The selected tile has a 2 px accent ring (`#1473e6` on the light panel, above 3:1). Keyboard focus shows a separate 2 px outline with a 2 px offset. The open animation respects `prefers-reduced-motion`. | Drive screenshot. |
| H7 | Tiles are flex columns with a square `.gallery-thumb-media` box that doesn't shrink, and the grid uses `grid-auto-rows: max-content`. Root cause: an overflowing grid only gives `auto` rows their *minimum* size, and the image box's minimum had collapsed. | Drive: no tile rectangles overlap, and texture tiles are square with visible names. |
| L6 | Texture thumbnails use `loading="lazy"` and `decoding="async"`. | — |

The native dialog lets Tab reach the browser's own controls after the last element, instead of trapping focus completely. That is the HTML spec's intended behavior, and it lets keyboard users reach the address bar.

`.command-backdrop` is still used by the Command palette, Comps and the other dialogs. Moving them onto `GalleryDialog` is a mechanical follow-up.

| # | Fix | Verification |
|---|---|---|
| I1 | `lib/galleryMemory.ts` stores each gallery's last state in `localStorage` (`carson.filterGallery.v1`, `carson.textureGallery.v1`). If storage is blocked, it keeps a copy for the session instead. The Filter Gallery reopens on the last category, filter and slider values. The Texture Gallery reopens on the last texture with the blend, opacity and fit chosen for it. Every field is validated on read. Params are clamped to their slider range. A filter that no longer fits the layer, such as Cold wash on type, falls back to the first fitting filter in its category. A removed texture falls back to its category's first texture. Choosing a *different* texture still applies that texture's own defaults. Textures whose full-size file failed to load are remembered for the session. The "pick the first filter or texture" logic moved from a mount effect into the category click, so it no longer overwrites the restored choice. | Unit tests for validation, fallbacks, round-trip, blocked storage and corrupt JSON. Component tests for reopening both galleries. Drive: Motion blur with Distance 41 (default 36), and Paper Texture 191 with Overlay and "Place as layer", both survive close and reopen *and* a full page reload. |
| I2 | The Texture Gallery preview is a live composite (`components/TexturePreview.tsx`, `lib/texturePreview.ts`). When the gallery opens, App snapshots the poster (900 px on the long side). The preview draws the texture over it using the blend as a canvas composite operation, the opacity as global alpha, and the placement from `texturePlacementTransform()`. `placeTextureFromGallery` now uses that same function, so the preview and the canvas can't drift apart. The thumbnail shows at once and the full-size file replaces it when it loads. If the full file is missing, the composite still renders from the thumbnail, with a notice over it instead of a blank pane. New **Monochrome** switch, on by default and remembered: placing applies a live `Grayscale({ mode: 'luminosity' })` filter. It isn't baked into the pixels, so the layer keeps its short URL source and can be undone. The preview desaturates with the same weights, and grid thumbnails turn grey while the switch is on. | Drive with temporary full-size files: preview pixels vs. the placed poster differ by **1.8/255** mean \|ΔRGB\|, while placing the texture changed the poster by 82/255. With the full file removed, the composite renders from the thumbnail and Place is disabled. Unit tests for the placement transform and luminosity weights. Component tests for the Monochrome default, persistence and the preview's accessible description. |
| I3 | **Before/after:** an **Original** pill sits in the top-right corner of the Filter Gallery preview. Pressing and holding it with a mouse, pen or finger shows the layer without the filter, and letting go brings the filtered preview back. It captures the pointer and sets `touch-action: none`, so a drag off the pill or a long press on touch doesn't leave it stuck or open the callout menu. It is a real `<button>` with `aria-pressed`: Space, Enter or a screen reader's activate toggles it (a click with `detail` 0), repeated Enter keydowns are ignored, and moving focus away turns it off. A white "Original" badge shows in the top-left while it is on, and the preview's `alt` changes to "Original layer, without the filter". The image comes from the new `renderOriginalPreview(source, maxSize)` in `lib/filterPreview.ts`, which returns the same `sourceRaster()` PNG that every preview at that size is built from. No second rasterization, and before and after line up exactly. It is fetched when the gallery opens so the swap is instant. **Slider reset:** `Slider` already reset to `defaultValue` on double-click, and the gallery already passed each preset's default, so nothing changed there. It is now tested. | Component tests: holding the pill shows the original image and badge, and releasing (including the click that follows) restores the filtered preview; Enter and Space toggle `aria-pressed`, and Tab away turns it off; double-clicking the Radius bar after dragging it to 64 resets it to 18. Unit test: `renderOriginalPreview` returns the shared raster and calls `toDataURL` once for two requests. Drive: holding Original over Heavy gaussian showed the sharp headline with the badge, and releasing brought the blur back; Enter and Space toggled it; Radius 60 went back to 48 on double-click. |
| L5 | **Taxonomy:** Grain moved from Adjust to Look, and Newsprint (`halftone`) moved from Stylize to Print. Newsprint is listed after the photocopy generations, so Print still opens on Light copy; Grain comes last in Look, so Look still opens on Sepia. Remembered state keeps working because `resolveFilterGalleryState` takes the category from the preset. **Layout:** the two-column grid of 10 category buttons (five rows) is now a single row of 24 px pill chips in a shared `components/CategoryChips.tsx`, used by both galleries. It scrolls sideways with a hidden scrollbar and `scroll-snap`, and it fades an edge only while more chips sit beyond it. On open it jumps to the active chip, since a remembered category can be off-screen. On later changes it glides there, unless `prefers-reduced-motion` is set. The scroll runs in a passive effect, after `showModal()` has given the bar a layout. Chips are plain buttons in Tab order, with visible labels and `aria-pressed`. | Unit tests: Grain and Newsprint are in their new categories; state saved under the old categories reopens in the new ones. Component tests: the chip order, `aria-pressed` on Look, the "Look filters" and "Print filters" listboxes, Print opening on Light copy, and reopening on Grain with Amount 75. Drive at 1440, 820 and 390 px wide: chips sit on one row (bar 28 px, chips 24 px) in both galleries. Reopening on Wash scrolls the bar to it (scrollLeft 362 at 1440 px, 298 at 390 px), with a left fade and Wash fully visible. |

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

---

## 7. Filter expansion

Six print-process filters, plus a Level param on Threshold. Each is a Fabric filter in `lib/printFilters.ts` with a Canvas2D path and a GLSL shader, registered with the class registry so applied treatments rebuild after reload. Pixel-measured params are listed in `PIXEL_PARAMS` (`lib/filterPreview.ts`) so previews scale them. Discrete params, such as an ink pair, are palette indices; `FilterParamDef.labels` names them in the gallery slider, the Inspector and the treatment chip.

| Filter | Category | Params | Presets |
|---|---|---|---|
| Halftone dots | Print | Cell size (px), Screen angle (°), Contrast (%) | Halftone dots (28 px, 45°), Coarse screen (64 px, 15°) |
| Riso | Print | Inks (Fluoro Pink + Blue, Black + Red, Teal + Orange, Black + Yellow, Purple + Fluoro Orange), Misregister (px), Grain (%) | Riso, Riso black + red |
| Bayer dither | Print | Scale (px), Threshold (%) | Bayer dither (8 px), Chunky dither (18 px) |
| Duotone | Look | Palette (Black / Paper, Navy / Cream, Red / Paper, Blue / Pink, Green / Lemon), Contrast (%) | Navy duotone, Red duotone |
| RGB split | Distress | Distance (px), Angle (°) | RGB split (16 px), Channel drift (40 px, 60°) |
| Scan lines | Distress | Spacing (px), Darkness (%), Jitter (%) | Scan lines (24 px), Torn scan (40 px, heavy jitter) |
| Threshold | Adjust | Level (%) | Threshold (50) |

How they behave:

- **Ink over paper.** Ink is composed over white, then un-composited. Transparent areas stay clear, and ink that lands past a shape (a riso fringe, an RGB fringe, a dot at a glyph edge) is ink-coloured and opaque only where it covers. White paper appears only under a layer's solid areas, so anti-aliased edges never get a pale rim.
- **Determinism.** Grain and row jitter hash coordinates; there is no `Math.random()`. Grain cells are relative to the layer, so the 640 px preview and the full-size result share the same pattern.
- **Small patterns.** Once dots or scan lines are smaller than a couple of pixels, they fade to their mean tone instead of aliasing. Dither fades only below 1.5 px; see the Δ note below.
- **Threshold compatibility.** Saved Threshold treatments have no level. They, and the new default of 50, build the original `BlackWhite` + `Contrast(0.2)` stack, so saved posters render exactly as before. Any other level moves the same ramp with a `ColorMatrix`.

**Fixed along the way: fx on big layers came back cropped.** Type and shapes were snapshotted at 2×, and Fabric's WebGL backend draws its last pass into a single 4096 px tile. On the wreck poster, `Oversized headline` snapshots to 7720 px, and every fx (Grayscale too) lost everything past x = 4096. `snapshotMultiplier()` (`lib/rasterizeLayer.ts`) now keeps 2× where it fits and otherwise picks the largest multiplier inside `config.textureSize`, and `previewPixelRatio()` uses the same value. Grayscale on the headline went from mean Δ 9.0 to 1.3.

### Verification

Drive: Chromium (SwiftShader WebGL) at 1440×960, wreck poster, `Oversized headline` selected. Each preset was applied from the gallery. The layer was isolated on white and framed so its bounds cover exactly the preview's 640×343 lower-canvas pixels, then compared with the preview. The poster was then reloaded, reopened from Home ("Recover Untitled poster"), and measured again.

| Filter (preset) | Mean \|ΔRGB\| preview vs canvas | After reload |
|---|---|---|
| Duotone (Navy duotone) | 1.14 | 1.14, filter `Duotone` rebuilt |
| Riso | 1.69 | 1.69, `Risograph` |
| RGB split | 1.71 | 1.71, `RgbSplit` |
| Threshold (level 50) | 1.38 | — |
| Chunky dither | 3.88 | 3.88, `BayerDither` |
| Halftone dots | 2.83 | 2.83, `HalftoneDots` |
| Scan lines | 2.95 | 2.95, `ScanLines` |
| Bayer dither | 6.94 | 6.94 |

Bayer dither is the one result over 4/255. Its 8 px cells are 1.26 px in the preview, and the canvas aliases rather than averages when it downsamples the applied raster, so both show the same 1-bit texture, but a pixel out of phase. Fading the preview to its mean tone instead pushed Δ to 16 and looked less like the canvas.

Timing: preview `applyFilters()` on the 640×343 raster in Chromium (WebGL) takes a median of 3–4 ms for every new filter, at most 23 ms (the first render, which includes compiling the shader). With the 120 ms debounce, a slider step shows its new preview about 220–290 ms after the key press. The Canvas2D fallback on a 640×343 buffer (Node, jsdom), median / max: halftone 20 / 34 ms, riso 28 / 32 ms, RGB split 18 / 22 ms, dither 10 / 13 ms, scan lines 6 / 12 ms, duotone 2 ms.

Undo/redo: applying Halftone dots then RGB split, then Ctrl+Z ×2 and Ctrl+Shift+Z, steps the filter stack `[HalftoneDots, RgbSplit]` → `[HalftoneDots]` → `[]` → `[HalftoneDots]`. No page errors in any run.

Tests: `lib/printFilters.test.ts` (27) covers each CPU path on tiny buffers: known output, alpha, determinism, edge values, and serialization round-trips. `filterGallery`, `filterPreview` and `pixelFilters` tests cover registry coverage, `PIXEL_PARAMS`, palette labels, the Threshold compatibility, and the snapshot cap. Full suite 494/494 ✓, `tsc -b` ✓, `npm run build` ✓, lint clean apart from the existing `usePathEditing.ts` warning.

Thumbnails (144 px) render pixel params at about 1/30 of the applied size, so the pattern filters show as plain tone in the tile grid. That matches how the result looks at that size, and it is the same for Mosaic and Newsprint.
