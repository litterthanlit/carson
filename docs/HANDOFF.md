# Carson — Agent Handoff

**Repo:** https://github.com/litterthanlit/carson  
**Branch:** `main` · latest: `fbd2606`  
**Read first:** [`docs/REIMAGINED.md`](./REIMAGINED.md) (vision + roadmap — source of truth)  
**Horizon 2 work:** [`docs/HANDOFF-HORIZON-2.md`](./HANDOFF-HORIZON-2.md) ← **start here for next agent**

---

## What Carson is

Local poster editor — React 19 + Fabric.js 7. Moat = seeded, non-destructive chaos tools. `editorModel.ts` is pure/deterministic; always pass `createSeededRandom(seed)` from App.

---

## Shipped (current main)

| Area | Status |
|------|--------|
| **App split** | `LeftRail.tsx`, `InspectorPanel.tsx`, `useTreatments.ts`, `useEditorHistory.ts`, `useCanvasEvents.ts`, `types/editor.ts`, `ScopeBadge.tsx` — **`App.tsx` ~2,695 lines** (was ~3,780) |
| **Naming** | Dive vocabulary removed (`applyColdWashImage`, `addDiagonalTexture`, `addRedEchoType`) |
| **Filter Gallery** | `FilterGalleryModal` + `filterGallery.ts` / `filterPreview.ts` — live preview, wired from LeftRail + Cmd+K |
| **Fundamentals** | Shortcuts, zoom/pan, IndexedDB autosave, snapping, layers (reorder/hide/lock/rename), scope badges |
| **Treatments** | Non-destructive stacks: xerox, decay, distress, scatter, slice, crop, tear, bad-crop, glyph-break — chip UI + reorder/reroll/bypass |
| **History** | `useEditorHistory` — full-canvas snapshot undo + **incremental layer-treatment ops** between snapshots (`historyLog.ts`) |
| **Typography / color / vectors** | Google Fonts + upload, weight/width sliders, legibility readout, text-on-path, gradients, 16 blend modes, ellipse/line/star/pen |
| **Path editing (v1)** | Inspector **Edit points** on paths — drag anchors + bezier handles (`pathEditing.ts`) |
| **Masking** | Clip-to-shape, brush mask (ellipse clip), scrape poster treatment (`destination-out` eraser bands in `scrapeTreatment.ts`) |
| **Layers v2** | Thumbnails (`layerThumbnail.ts`) + Shift/Cmd/Ctrl multi-select in `LayersPanel.tsx` |
| **Print (partial)** | CMYK soft-proof, bleed/trim guides, PDF+TIFF, registration marks, custom size to 10k px |
| **IA** | Tabbed inspector, Instruments toggle, Cmd+K, variants, multi-artboard, onboarding modal |
| **Horizon 1** | **Complete** — Tab-cycle layers, FontPicker face, zoom-to-layer, a11y contrast + canvas focus, tooltips |

**64 tests** · `npm test && npm run build`

---

## What landed in latest session (Horizon 1 finish)

1. **`FontPicker`** — custom typeface menu; each font renders in its own face; dedicated Typography inspector card
2. **Tab-cycle selection** — when canvas workspace is focused, Tab / Shift+Tab cycles layers
3. **Zoom-to-layer** — double-click a layer row to fit and center it in view
4. **Accessibility** — darker muted text (≥4.5:1), canvas `tabIndex` + focus ring, layer tooltips

## Prior session (`db3643e`)

1. **`useEditorHistory`** — extracted from `App.tsx`; owns `historyLogRef`, `restoringRef`, `commitHistory`, `undoAsync`, `redo`, `resetHistory`
2. **Incremental treatment history** — layer treatment reroll/bypass/reorder/remove use `commitTreatmentHistory` (lightweight ops); full snapshots every 20 ops via `shouldSnapshot`
3. **True scrape eraser** — white overlay bands replaced with `globalCompositeOperation: 'destination-out'`
4. **Layer thumbnails + multi-select** — canvas sync via `selectedLayerIds` + `ActiveSelection`
5. **Path point editing** — overlay handles in `App.tsx` path-edit `useEffect`; math in `pathEditing.ts`

---

## Architecture

```
useEditorHistory()                     // hooks/useEditorHistory.ts
  commitHistory()        → snapshot op (full canvas JSON)
  commitTreatmentHistory → treatment op OR snapshot if shouldSnapshot
  undo/redo              → restoreActionForUndo/Redo → snapshot load OR treatment JSON restore

useTreatments()                        // hooks/useTreatments.ts
  refreshTreatmentStack()              → renderTreatmentStackOnCanvas() in treatments.ts
  refreshPosterTreatments()            → renderPosterTreatments() → scrapeTreatment.ts
  reconcileArtifactTreatments()        → re-render slice/crop/tear/bad-crop/glyph artifacts after load
```

**After `loadFromJSON`:** always call **`reconcileArtifactTreatments()`** + **`refreshPosterTreatments()`**

**Serialize keys:** `HISTORY_PROPS` in `editorConstants.ts` (includes `treatments`, `scrapeTreatmentId`, `scrapeFragment`, etc.)

### Ref pattern (important)

`App.tsx` wires hooks through refs to avoid circular deps:

- `commitHistoryRef` / `commitTreatmentHistoryRef` — set by `useEditorHistory`
- `refreshTreatmentStackRef` / `reconcileArtifactTreatmentsRef` / `refreshPosterTreatmentsRef` — set after `useTreatments`
- `onTreatmentRestore` in history hook: `writeTreatments(object, JSON)` + `refreshTreatmentStack(object)`

Function declarations (`syncSelected`, `scheduleAutosave`, etc.) are hoisted — `useEditorHistory` can reference them before their line numbers in the file.

---

## Key files (new / recently touched)

| File | Role |
|------|------|
| `src/hooks/useEditorHistory.ts` | History state, snapshot + treatment undo/redo |
| `src/hooks/useTreatments.ts` | Treatment stack refresh, poster treatments, `commitTreatmentHistory` for layer ops |
| `src/lib/historyLog.ts` | Op types, `shouldSnapshot`, `restoreActionForUndo/Redo` |
| `src/lib/pathEditing.ts` | Anchor/control extraction, `movePathPoint`, hit testing |
| `src/lib/layerThumbnail.ts` | Per-object `toDataURL` thumb for layers panel |
| `src/lib/scrapeTreatment.ts` | Poster-wide `destination-out` scrape bands |
| `src/components/LayersPanel.tsx` | Thumbs, multi-select, drag reorder, double-click zoom |
| `src/components/FontPicker.tsx` | Typeface picker with per-font preview |
| `src/hooks/useCanvasEvents.ts` | Fabric selection, snap, pen path, grid/print overlay listeners |
| `src/App.tsx` | Still monolith for chaos actions, export, variants, path-edit overlay |

---

## Known gaps & gotchas

### History
- **Poster treatments** (scrape on artboard / `documentMeta`) still use full `commitHistory` snapshots — not incremental yet
- Incremental ops only cover **layer** `treatments` JSON on Fabric objects (`useTreatments` handlers)
- `restoringRef` blocks history commits during `loadFromJSON` — used in `loadProject`, variant restore, merge, etc.

### Path editing (v1)
- Works on `path` type only (pen strokes); `line` shows stroke controls but not point editor
- No add/delete point, close path, or handle snapping yet
- Path-edit mode disables canvas selection (`pathEditMode` effect); turns off pen mode when enabled
- Coordinate math uses `path.pathOffset` + `util.invertTransform` — test with rotated/scaled paths before extending

### Scrape eraser
- `destination-out` punches through rendered pixels to canvas background — underlying objects are **not** deleted (non-destructive visually)
- Scrape fragments tagged `scrapeFragment` / `scrapeTreatmentId` — excluded from normal layer semantics; reconciled via `refreshPosterTreatments`

### Layers
- Thumbnails regenerate on every `syncLayers()` — fine for now; may need debounce/cache if perf issues on large docs
- Multi-select: Shift/Cmd/Ctrl in layers panel; canvas marquee selection also updates `selectedLayerIds`

### Code debt (unchanged)
- `applyPosterStyle` compounds on repeat
- Export may mutate live canvas background non-atomically
- ~40 chaos handlers still live in `App.tsx`

---

## Next session — Horizon 2

See **[`docs/HANDOFF-HORIZON-2.md`](./HANDOFF-HORIZON-2.md)** for full scorecard, phases, and first-PR scope.

**Quick start:** Poster treatment incremental history (`historyLog.ts` + `useTreatments.ts`).

---

## Still open from REIMAGINED.md (high level)

- **Horizon 2 gaps:** OpenType/styles, vector booleans, blend-mode hover preview, component overrides, tiled/CMYK/SVG export, editorial layout, layer groups
- **§9 UX vision:** six-tool toolbar, floating treatment chips, global Tension dial, scope hover preview, exploration trail replacing status line
- **Horizon 3:** cloud/CRDT, Serendipity Engine, Press Check, AI assistant, WebGPU, marketplace, native shell

REIMAGINED is **not done** — it's the 18-month vision. Carson is **Horizon 1 complete**, ~55–65% Horizon 2, 0% Horizon 3.

---

## Verification

```bash
cd "/Users/niki_g/Local Files/workflow/Projects/carson"
npm test && npm run build && npm run dev
```

### Regression templates

**Any layer treatment:** apply → chip in Treatments → re-roll → bypass → remove → source editable → Cmd+Z (fast undo between snapshots) → save/reload reconciles

**Scrape:** LeftRail → White scrapes → content erases to poster background → chip in poster treatments → re-roll/bypass → Cmd+Z

**Layers:** thumbnails visible → Shift+click multi-select → delete/align works on selection

**Path edit:** pen stroke → select → Inspector → Edit points → drag red/cyan handles → Cmd+Z

---

## Constraints

- Don't commit unless asked
- Don't commit `.codex/`
- Features need a **user-facing path** to be "complete" (backend-only doesn't count)
- Read `docs/REIMAGINED.md` before claiming a feature is done

---

*Updated 2026-06-27 · main @ Horizon 1 complete*
