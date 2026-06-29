# Carson — Horizon 2 Agent Handoff

**Repo:** https://github.com/litterthanlit/carson  
**Branch:** `main` · latest: `fbd2606`  
**Prerequisite:** Horizon 1 is **complete** (see [`HANDOFF.md`](./HANDOFF.md))  
**Vision source:** [`REIMAGINED.md`](./REIMAGINED.md) §6 feature gap table + §8 Horizon 2 items (2.1–2.12)

---

## Mission

Turn Carson from a **trustworthy local poster editor** into a **professional instrument**: non-destructive workflows that scale, typography and vectors that hold up to client revisions, print fidelity, and IA that can absorb 10× more features without clutter.

**Horizon 1 done.** You are working **Horizon 2 only** unless fixing a regression.

**Rough completion:** ~55–65% of Horizon 2 · 0% Horizon 3

---

## What Carson is (unchanged)

React 19 + Fabric.js 7 local poster editor. Moat = **seeded, non-destructive chaos** via treatment stacks on layers + poster-wide treatments on artboards.

- **Model layer:** `src/lib/editorModel.ts` — pure, deterministic; always inject `createSeededRandom(seed)` from callers.
- **Treatment stacks:** `src/lib/treatments.ts` + per-type `*Treatment.ts` files; serialized on Fabric objects as `treatments` JSON.
- **Poster treatments:** `src/lib/posterTreatments.ts` → `scrapeTreatment.ts`; stored on `Artboard.posterTreatments` in `documentMeta`.
- **History:** `src/lib/historyLog.ts` + `useEditorHistory` — op log with periodic snapshots (`SNAPSHOT_EVERY = 20`).

**64 tests** · always run `npm test && npm run build` before handoff.

---

## Horizon 2 scorecard (REIMAGINED §8)

| ID | Item | Status | Notes |
|----|------|--------|-------|
| **2.1** | Non-destructive core | **~75%** | Layer treatment stacks + incremental layer-treatment undo. Still: full JSON snapshots for most edits; poster treatments not incremental; some LeftRail actions may still bake/rasterize outside stack |
| **2.2** | Real typography | **~45%** | `FontPicker`, Google Fonts + upload, weight/width sliders, text-on-path, legibility readout. Missing: OpenType features, character/paragraph styles, per-character styling |
| **2.3** | Vector vocabulary | **~50%** | Ellipse, line, star, pen, stroke dash, path edit v1 (`pathEditing.ts`). Missing: add/delete points, close path, boolean ops; path-edit overlay still in `App.tsx` |
| **2.4** | Color system | **~60%** | Document palette, recent swatches, eyedropper, gradients, 16 blend modes, CMYK soft-proof readout. Missing: **blend-mode hover preview** on canvas |
| **2.5** | Masking | **~50%** | Clip-to-shape, brush mask (ellipse clip), scrape as `destination-out` bands. Missing: true alpha mask instrument, non-destructive eraser mask (scrape is visual punch-through, not layer mask) |
| **2.6** | Print pipeline v1 | **~55%** | DPI on presets, bleed/trim/safe overlays, PDF+TIFF export, registration marks, 10k canvas cap, CMYK preview toggle. Missing: **tiled export** for huge docs, **SVG export**, true CMYK output, gamut warnings wired to UI |
| **2.7** | Grid & layout | **~50%** | Column + baseline overlays, align/distribute (`grid.ts`), tension in `GridOverlay` affects scatter. Missing: margin UI, snap-to-grid mode, broken-grid as first-class UX |
| **2.8** | Components & assets | **~30%** | Asset thumbnails + drag-to-canvas; save selection / treatment stack as component (JSON snapshot in `documentMeta.components`). Missing: **overrides**, visual component library, treatment stacks as shareable assets |
| **2.9** | IA redesign | **~40%** | Tabbed inspector, Cmd+K, Filter Gallery, Instruments toggle. Missing: **six-tool toolbar**, contextual on-canvas controls, floating treatment chips (§9) |
| **2.10** | Onboarding as play | **~60%** | `OnboardingModal` exists. Missing: interactive “wreck this poster” walkthrough |
| **2.11** | Variations / branching | **~50%** | Cmd+B fork, variant list, compare modal, merge, `ExplorationTrail` strip. Missing: thumbnail filmstrip history, spatial undo, full comps gallery |
| **2.12** | Multi-artboard | **~70%** | Multiple artboards, switch, per-board preset, export-all hook. Missing: per-artboard export presets in UI polish |

---

## Architecture you inherit

```
useEditorHistory()                     // hooks/useEditorHistory.ts
  commitHistory()        → snapshot op (full canvas JSON)
  commitTreatmentHistory → layer treatment op OR snapshot if shouldSnapshot()
  undo/redo              → restoreActionForUndo/Redo

useTreatments()                        // hooks/useTreatments.ts
  Layer ops    → commitTreatmentHistory (incremental)
  Poster ops   → commitHistory (FULL SNAPSHOT) ← first fix

useCanvasEvents()                      // hooks/useCanvasEvents.ts
  selection, snap, pen, grid/print overlays

documentMeta (DocumentMeta)            // lib/document.ts
  artboards[].posterTreatments
  variants[], components[], palette, dpi, bleedMm
```

### Ref pattern (do not break)

`App.tsx` wires hooks through refs to avoid circular deps:

- `commitHistoryRef` / `commitTreatmentHistoryRef`
- `refreshTreatmentStackRef` / `reconcileArtifactTreatmentsRef` / `refreshPosterTreatmentsRef`
- `tagObjectRef` / `activeObjectRef`

Function declarations (`syncSelected`, `selectLayer`, etc.) are **hoisted** — hooks can reference them before their line numbers.

### After every `loadFromJSON`

Always call **`reconcileArtifactTreatments()`** + **`refreshPosterTreatments()`**.

Serialize keys: `HISTORY_PROPS` in `editorConstants.ts`.

---

## Recommended execution order

Prioritized by **dependency**, **user-visible impact**, and **existing partial work**.

### Phase A — Finish non-destructive foundation (2.1)

**A1. Poster treatment incremental history** ← **start here**

- **Problem:** `useTreatments.ts` poster handlers (`rerollPosterTreatment`, `togglePosterTreatment`, `removePosterTreatmentAction`, `reorderPosterTreatmentAction`) call `commitHistory()` → full canvas snapshot every scrape reroll/bypass.
- **Pattern to mirror:** layer `commitTreatmentHistory` in `historyLog.ts`.
- **Implementation sketch:**
  1. Extend `HistoryOp` with `{ type: 'posterTreatment'; artboardId; label; before; after }` where `before`/`after` are JSON strings of `Treatment[]` (or full artboard slice).
  2. Add `commitPosterTreatmentHistory(artboardId, label, before, after)` in `useEditorHistory`.
  3. Extend `restoreActionForUndo/Redo` to apply poster JSON → `setDocumentMeta` + `refreshPosterTreatments()`.
  4. Replace `commitHistory` in poster handlers in `useTreatments.ts`.
- **Files:** `historyLog.ts`, `historyLog.test.ts`, `useEditorHistory.ts`, `useTreatments.ts`
- **User path:** Scrape → Treatments tab → re-roll/bypass/remove → **fast Cmd+Z** without full canvas reload.
- **Tests:** Add cases in `historyLog.test.ts` for poster op undo/redo.

**A2. Migrate more edits off full snapshots**

- Nudge, opacity, rename, layer reorder — consider lightweight ops or batch debounce before snapshot.
- **Do not** rewrite entire history in one PR; extend op types incrementally.

**A3. Kill remaining destructive paths**

- Audit LeftRail chaos actions in `App.tsx` (~line 1000+) for `toDataURL` → delete → PNG insert patterns not going through treatment stack.
- REIMAGINED appendix: `applyImageEffect` replaces filter array (stacking bug); `applyPosterStyle` compounds on repeat.

---

### Phase B — Vectors & pen (2.3)

**B1. Pen tool polish**

- Add/delete anchor, close path, handle snapping.
- **Move path-edit overlay** out of `App.tsx` (`useEffect` ~line 374) → `hooks/usePathEditing.ts` or `components/PathEditOverlay.tsx`.
- **Gotcha:** `path.pathOffset` + `util.invertTransform`; test rotated/scaled paths.

**B2. Vector booleans**

- Research Fabric 7 path boolean APIs (union/subtract/intersect).
- Likely new treatment or command — vectors must keep treatment stack compatibility per 2.3.

---

### Phase C — Typography depth (2.2)

- OpenType feature toggles (liga, kern, smcp) where font supports.
- Character / paragraph **styles** as `documentMeta` assets (reuse component pattern).
- Per-character styling is high effort — defer until styles exist.

---

### Phase D — Color & preview (2.4 + §9)

- **Blend-mode hover preview:** ghost 40% opacity on canvas before apply (REIMAGINED §9.6).
- Scope preview for chaos tools (deterministic + seeded) — pairs with Instruments work.

---

### Phase E — Print & export (2.6)

- **Tiled rendering** for export > viewport (remove practical size anxiety).
- SVG export path for vectors/text.
- Wire `cmykPreview.ts` gamut hint to inspector UI (instrument, not warning — P4).
- Fix: export mutates live canvas background non-atomically (`exportPoster` in `App.tsx`).

---

### Phase F — Layout & components (2.7, 2.8)

- Layer **groups** (Fabric `Group` + layers panel nesting) — not started.
- Component **overrides** (insert component, detach, override text/color).
- Visual asset grid already partial — unify with components.

---

### Phase G — IA & exploration (2.9, 2.11, §9)

- Six-tool left toolbar (Move, Text, Shape, Image, Mask, Instruments).
- Floating treatment chips above inspector.
- **Tension dial** in header — scales `gridOverlay.tension` + all instrument intensities document-wide.
- Exploration trail: evolve `ExplorationTrail.tsx` from variant chips → thumbnail filmstrip with fork.

**Do not start Horizon 3** (cloud, Serendipity Engine, AI, WebGPU) in this phase.

---

## Key files map

| File | Horizon 2 role |
|------|----------------|
| `src/lib/historyLog.ts` | Op types — extend for poster + future ops |
| `src/hooks/useEditorHistory.ts` | Undo/redo restore paths |
| `src/hooks/useTreatments.ts` | Layer + poster treatment mutations |
| `src/lib/posterTreatments.ts` | Artboard-scoped scrape stack |
| `src/lib/treatments.ts` | Layer treatment types + render pipeline |
| `src/lib/document.ts` | Artboards, variants, components schema |
| `src/lib/print.ts` | Guides, PDF/TIFF |
| `src/lib/grid.ts` | Align, distribute, column grid |
| `src/lib/pathEditing.ts` | Pen/path math |
| `src/lib/cmykPreview.ts` | Soft proof + gamut check |
| `src/components/InspectorPanel.tsx` | Treatments tab, typography, print |
| `src/components/LeftRail.tsx` | Chaos instruments (candidates for scope preview) |
| `src/components/ExplorationTrail.tsx` | Variation UX seed |
| `src/App.tsx` | **~2,765 lines** — chaos handlers, export, path-edit overlay, variants |

---

## Known gotchas (carry forward)

### History
- `restoringRef` blocks commits during `loadFromJSON` — set in `useEditorHistory`, used in load/variant/merge.
- Incremental ops only cover **layer** `treatments` today.
- Snapshot undo still O(canvas JSON size) — hitch on image-heavy docs.

### Scrape
- `destination-out` erases **rendered pixels** to background; source objects not deleted.
- Fragments tagged `scrapeFragment` / `scrapeTreatmentId` — excluded from layer semantics.

### Layers
- Thumbnails regenerate every `syncLayers()` — debounce if perf issues.
- No groups yet.

### Code debt (REIMAGINED appendix)
1. `applyImageEffect` replaces filter array — stacked effects vanish  
2. Double history commit on mount (check `seedPoster` + poster resize effect)  
3. `applyPosterStyle` compounds drift on repeat  
4. Export background mutation  
5. Model `random` must be passed from all chaos callers (grep for `editorModel` calls without `random`)

---

## Verification

```bash
cd "/Users/niki_g/Local Files/workflow/Projects/carson"
npm test && npm run build && npm run dev
```

### Regression templates (always run)

| Flow | Steps |
|------|-------|
| Layer treatment | Apply → chip → re-roll → bypass → remove → source editable → Cmd+Z → save/reload |
| Scrape | LeftRail → White scrapes → poster treatments chip → re-roll/bypass → Cmd+Z |
| Layers | Thumbnails → Shift+multi-select → delete/align |
| Path edit | Pen stroke → Edit points → drag handles → Cmd+Z |
| Typography | FontPicker → change face → reload persists |
| Print | Enable print guides → export PDF → guides not in artwork |

### Definition of done (Horizon 2 item)

Per project rules: feature is **not complete** without a **user-facing path**. Backend-only or test-only does not count. Read `REIMAGINED.md` before marking an item done.

---

## Suggested first PR (copy-paste scope)

**Title:** Poster treatment incremental history

**Acceptance criteria:**
- [ ] Scrape reroll/bypass/reorder/remove uses op log, not full snapshot (unless `shouldSnapshot()`)
- [ ] Cmd+Z restores prior `posterTreatments` JSON and re-renders scrape fragments
- [ ] Save/reload/autosave preserves behavior
- [ ] `historyLog.test.ts` covers poster op undo/redo
- [ ] No change to layer treatment history behavior

---

## Constraints

- Don't commit unless asked
- Don't commit `.codex/`
- Use `npx convex dev` only if Convex is added (currently **no Convex** in this repo)
- Minimize scope — one Horizon 2 item per session when possible
- Match existing patterns: hooks + refs, pure lib functions, unit tests for `lib/*`

---

## What success looks like (end of Horizon 2)

A designer can:

1. Apply xerox/decay/scatter/scrape, revise headline text, re-roll seeds, undo freely — **nothing unexpectedly rasterized**
2. Set type with real fonts + styles, draw with pen + booleans, mask without destroying source
3. Export A3 @ 300dpi PDF with bleed/trim, CMYK-aware preview
4. Fork variants, compare comps, reuse components with overrides
5. Work in a calmer IA (six tools + Cmd+K + floating chips) without losing Carson’s chaos moat

---

*Written 2026-06-27 · main @ `fbd2606` · Horizon 1 complete*
