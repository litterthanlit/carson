# Carson — Agent Handoff

**Repo:** https://github.com/litterthanlit/carson  
**Branch:** `main` · latest: `6d23df7`  
**Read first:** [`docs/REIMAGINED.md`](./REIMAGINED.md) (vision + roadmap)

---

## What Carson is

Local poster editor — React 19 + Fabric.js 7. Moat = seeded chaos tools with non-destructive treatment stacks. `editorModel.ts` is pure/deterministic; always pass `createSeededRandom(seed)` from App.

---

## Shipped (Horizon 1 + 2)

| Area | Status |
|------|--------|
| **Fundamentals** | Shortcuts, zoom/pan, IndexedDB autosave, snapping, layers (reorder/hide/lock/rename), scope badges, eyedropper |
| **2.1 Treatments** | `xerox`, `decay`, `distress`, `scatter`, `slice`, `crop`, `tear`, `bad-crop`, `glyph-break` — all chaos ops non-destructive; source survives; chip UI in Treatments tab |
| **2.2–2.4** | Google Fonts + upload, weight/width sliders, legibility readout, text-on-path, stroke dash, linear/radial gradient, editable palette swatches, 16 blend modes |
| **2.5–2.6** | Clip-to-shape, brush mask (ellipse clip), CMYK soft-proof toggle, bleed/trim guides, PDF+TIFF, registration marks in PDF, custom size to 10k px |
| **2.7–2.8** | Align/distribute, column + baseline grids, tension→scatter, asset library w/ drag-drop, save treatment stack as component |
| **2.9–2.12** | Tabbed inspector + Cmd+K, Instruments toggle (collapsed left rail), Layers tab, exploration trail filmstrip, fork/restore/compare/merge/rename variants, multi-artboard + export all |
| **2.10** | Onboarding modal (“wreck this poster”) |

**48 tests** · `npm test && npm run build`

---

## Architecture

```
refreshTreatmentStack()           // App.tsx
  → renderTreatmentStackOnCanvas() // treatments.ts
      → applySyncTreatmentStack()  // filters + scatter (tension-scaled)
      → render*Treatment()         // slice/crop/tear/badCrop/glyphBreak modules
```

After `loadFromJSON` (undo, load, variant, artboard switch): **`reconcileArtifactTreatments()`**

**Artifact modules:** `sliceTreatment.ts`, `cropTreatment.ts`, `tearTreatment.ts`, `badCropTreatment.ts`, `glyphBreakTreatment.ts`

**History:** Still 40 JSON snapshots in `historyRef` + `historyLog.ts` op log (snapshots only — op-log undo not wired). Prereq for Horizon 3.1 collab.

**`App.tsx` ~3,700 lines** — not split yet. New UI: `ExplorationTrail.tsx`, `LayersPanel.tsx`.

**Serialize keys:** `HISTORY_PROPS` in App — includes all `*SourceId` / `*TreatmentId` artifact keys.

---

## Horizon 2 gaps (honest)

| Gap | Notes |
|-----|-------|
| Op-log undo | `historyLog.ts` exists; undo/redo still use snapshots only |
| Treatment reorder UI | `reorderTreatment()` in lib, no UI |
| 2.3 Vectors | No pen, booleans |
| 2.5 Scrape | Still additive white rects; scrape not a mask treatment |
| 2.6 Print | No tiled huge export; CMYK preview only (RGB export) |
| 2.9 IA | Split App into `EditorCanvas`, `LeftRail`, `InspectorPanel`, `useTreatments` |
| 2.12 Artboards | Add-artboard hardcoded IG; no per-board preset picker in UI |

---

## Horizon 3 (not started)

Cloud docs + CRDT collab, Serendipity Engine (Instruments/Gestures/Tension dial), AI assistant, cross-device, WebGPU tiles, marketplace.

---

## Recommended next work

1. **Split `App.tsx`** — highest leverage before more features
2. **Wire op-log undo** — replace or augment `historyRef` snapshots
3. **Pen tool + stroke editing** — 2.3 remainder
4. **Scrape as mask treatment** — 2.5 remainder
5. **Per-artboard preset picker** — 2.12 polish

---

## Verification

```bash
cd "/Users/niki_g/Local Files/workflow/Projects/carson"
npm test && npm run build && npm run dev
```

**Regression template (any artifact treatment):** apply → chip in Treatments → re-roll → bypass → remove → source editable → Cmd+Z → save/reload reconciles.

**Constraints:** Don't commit unless asked. Don't commit `.codex/`. REIMAGINED = source of truth.

---

*Updated 2026-06-15 · main @ 6d23df7*
