# Carson — Agent Handoff

**Repo:** https://github.com/litterthanlit/carson  
**Branch:** `main` · latest: `5835549`  
**Read first:** [`docs/REIMAGINED.md`](./REIMAGINED.md) (vision + roadmap — source of truth)

---

## What Carson is

Local poster editor — React 19 + Fabric.js 7. Moat = seeded chaos tools with non-destructive treatment stacks. `editorModel.ts` is pure/deterministic; always pass `createSeededRandom(seed)` from App.

---

## Shipped (Horizon 1 + most of Horizon 2)

| Area | Status |
|------|--------|
| **Fundamentals** | Shortcuts, zoom/pan, IndexedDB autosave, snapping, layers (reorder/hide/lock/rename), scope badges, eyedropper, recent colors |
| **2.1 Treatments** | `xerox`, `decay`, `distress`, `scatter`, `slice`, `crop`, `tear`, `bad-crop`, `glyph-break` — non-destructive; chip UI + reorder (↑↓) |
| **2.1 History** | Op-log undo/redo via `historyLogRef` (snapshot ops — incremental ops not yet) |
| **2.2–2.4** | Google Fonts + upload, weight/width sliders, legibility readout, text-on-path, stroke dash, gradients, palette swatches, 16 blend modes |
| **2.3 Vectors (partial)** | Ellipse, line, star, **pen tool** (P) + stroke width/color in inspector |
| **2.5 Masking (partial)** | Clip-to-shape, brush mask (ellipse clip), **scrape as poster treatment** (`posterTreatments.ts`) |
| **2.6 Print (partial)** | CMYK soft-proof, bleed/trim guides, PDF+TIFF, registration marks, custom size to 10k px |
| **2.7–2.8** | Align/distribute, column + baseline grids, tension→scatter, asset library w/ drag-drop, save treatment stack as component |
| **2.9–2.12** | Tabbed inspector + Cmd+K, Instruments toggle, exploration trail, variants, multi-artboard + preset picker |
| **2.10** | Onboarding modal (“wreck this poster”) |
| **App split (partial)** | `TopBar`, `EditorCanvas`, `Slider`, `editorConstants.ts`, `canvasUtils.ts` — **`App.tsx` still ~3,780 lines** |

**51 tests** · `npm test && npm run build`

---

## Architecture

```
refreshTreatmentStack()              // App.tsx
  → renderTreatmentStackOnCanvas()   // treatments.ts
      → applySyncTreatmentStack()    // filters + scatter (tension-scaled)
      → render*Treatment()           // slice/crop/tear/badCrop/glyphBreak

refreshPosterTreatments()            // App.tsx
  → renderPosterTreatments()         // posterTreatments.ts → scrapeTreatment.ts
```

After `loadFromJSON`: **`reconcileArtifactTreatments()`** + **`refreshPosterTreatments()`**

**History:** `historyLogRef` + `historyLog.ts` — undo/redo walk snapshot ops (not granular treatment-level ops yet).

**Serialize keys:** `HISTORY_PROPS` in `editorConstants.ts`

---

## What's left from REIMAGINED.md

### Horizon 1 — polish remaining

| Item | Gap |
|------|-----|
| **1.6 Layers** | No layer thumbnails; no Shift/Cmd multi-select in panel |
| **1.7 A11y** | No Tab-to-cycle canvas objects; canvas keyboard operability incomplete |
| **1.8 Naming** | Legacy “dive” vocabulary (`addDiveRedType`, `addDiveTexture`, etc.) still in code |
| **1.10 Delight** | Font dropdown doesn’t render each face in its own typeface; no double-click layer → zoom-to-layer |

### Horizon 2 — professional gaps

| Item | Gap |
|------|-----|
| **2.1 Treatments** | Incremental op-log (not snapshot-only); some tools still destructive paths |
| **2.2 Typography** | OpenType features, per-character styling, paragraph/character styles, hyphenation/justification, full variable-font axes |
| **2.3 Vectors** | Bezier point editing on pen paths; boolean ops; vectors accepting full treatment stacks |
| **2.4 Color** | Live blend-mode hover preview |
| **2.5 Masking** | Scrape is additive white bands, not true eraser/`destination-out` mask; no painted alpha brush mask |
| **2.6 Print** | Tiled huge export; true CMYK/ICC export (preview only today); SVG export |
| **2.8 Components** | Group → reusable component with overrides; shared text/effect styles |
| **2.9 IA** | Finish split: `LeftRail`, `InspectorPanel`, `useTreatments`; six-tool minimal toolbar; contextual on-canvas controls |
| **Editorial layout** | Multi-column text, linked frames, baseline grid for type, master pages — **not started** |
| **Groups** | Layer grouping/nesting — **not started** |

### UX vision (§9) — not built

- Three-zone shell (slim toolbar + contextual canvas controls + tabbed inspector only)
- Treatment chips floating above selection (not just inspector list)
- Document-wide **Tension dial** in header (grid tension exists; not global)
- Scope **hover preview** (ghost effect before apply)
- Spatial exploration trail replacing status line (trail exists; status line still primary feedback)

### Horizon 3 — not started

Cloud docs + CRDT collab · Serendipity Engine (Instruments/Gestures/Tension) · Press Check · AI assistant · cross-device/stylus · WebGPU tiles · marketplace · native shell (.carson, menus, Quick Look)

### Known code debt (REIMAGINED appendix)

- `applyPosterStyle` still compounds drift on repeat clicks (no preview, relative mutation)
- Export path may still mutate live canvas background non-atomically
- `App.tsx` monolith — highest leverage refactor before more features

---

## Recommended next work (priority order)

1. **Finish `App.tsx` split** — `LeftRail.tsx`, `InspectorPanel.tsx`, `useEditorHistory` / `useTreatments`
2. **Incremental op-log** — treatment-level ops between periodic snapshots (`shouldSnapshot` in `historyLog.ts`)
3. **True scrape eraser mask** — `destination-out` or clip-based, still non-destructive in `posterTreatments`
4. **Vector bezier editing** — path anchor manipulation after pen draw
5. **Layer thumbnails + multi-select** — Layers panel v2
6. **Rename “dive” tools** — generalize to Texture/Treatment vocabulary per REIMAGINED §4.2-D

---

## Verification

```bash
cd "/Users/niki_g/Local Files/workflow/Projects/carson"
npm test && npm run build && npm run dev
```

**Regression template (any treatment):** apply → chip in Treatments → re-roll → bypass → remove → source editable → Cmd+Z → save/reload reconciles.

**Constraints:** Don't commit unless asked. Don't commit `.codex/`. REIMAGINED = source of truth. Features need a user-facing path to be "complete."

---

*Updated 2026-06-17 · main @ 5835549*
