# Carson — Agent Handoff

**Repo:** https://github.com/litterthanlit/carson  
**Branch:** `main` · latest: `00c5adb`  
**Read first:** [`docs/REIMAGINED.md`](./REIMAGINED.md) (vision + roadmap — source of truth)

---

## What Carson is

Local poster editor — React 19 + Fabric.js 7. Moat = seeded, non-destructive chaos tools. `editorModel.ts` is pure/deterministic; always pass `createSeededRandom(seed)` from App.

---

## Shipped since last major handoff

| Area | Status |
|------|--------|
| **App split** | `LeftRail.tsx`, `InspectorPanel.tsx`, `useTreatments.ts`, `types/editor.ts`, `ScopeBadge.tsx` — `App.tsx` ~2,688 lines (was ~3,780) |
| **Naming** | Dive vocabulary removed (`applyColdWashImage`, `addDiagonalTexture`, `addRedEchoType`) |
| **Filter Gallery** | `FilterGalleryModal` + `filterGallery.ts` / `filterPreview.ts` — live preview, wired from LeftRail + Cmd+K |
| **Fundamentals** | Shortcuts, zoom/pan, IndexedDB autosave, snapping, layers (reorder/hide/lock/rename), scope badges |
| **Treatments** | Non-destructive stacks: xerox, decay, distress, scatter, slice, crop, tear, bad-crop, glyph-break — chip UI + reorder/reroll/bypass |
| **History** | `useEditorHistory` hook — op-log undo/redo; incremental treatment ops between snapshots |
| **Typography / color / vectors** | Google Fonts + upload, weight/width sliders, legibility readout, text-on-path, gradients, 16 blend modes, ellipse/line/star/pen + **path point editing** |
| **Masking (partial)** | Clip-to-shape, brush mask, scrape poster treatment (`destination-out` eraser bands) |
| **Layers** | Thumbnails + Shift/Cmd multi-select in Layers panel |
| **Print (partial)** | CMYK soft-proof, bleed/trim guides, PDF+TIFF, registration marks, custom size to 10k px |
| **IA** | Tabbed inspector, Instruments toggle, Cmd+K, variants, multi-artboard, onboarding modal |

**64 tests** · `npm test && npm run build`

---

## Architecture

```
useEditorHistory()                   // commitHistory, undo/redo, treatment ops
refreshTreatmentStack()              // useTreatments → App.tsx
  → renderTreatmentStackOnCanvas()   // treatments.ts
      → applySyncTreatmentStack()
      → render*Treatment()

refreshPosterTreatments()            // useTreatments
  → renderPosterTreatments()         // posterTreatments.ts → scrapeTreatment.ts
```

After `loadFromJSON`: **`reconcileArtifactTreatments()`** + **`refreshPosterTreatments()`**

**Serialize keys:** `HISTORY_PROPS` in `editorConstants.ts`

---

## Next session — recommended order

1. **Further App split** — extract canvas event registration and chaos handlers from `App.tsx`
2. **Horizon 1 polish** — canvas Tab-cycling, font dropdown in own face, double-click layer → zoom-to-layer
3. **Poster treatment incremental history** — lightweight undo for scrape reroll/bypass (documentMeta ops)
4. **Vector booleans** — union/subtract/intersect (Horizon 2)
5. **Pen tool polish** — add/delete points, close path, snap handles

---

## Still open from REIMAGINED.md (high level)

- **Horizon 1 polish:** canvas Tab-cycling, font dropdown in own face, double-click layer → zoom-to-layer
- **Horizon 2 gaps:** OpenType/styles, vector booleans, blend-mode hover preview, component overrides, tiled/CMYK/SVG export, editorial layout, layer groups
- **§9 UX vision:** six-tool toolbar, floating treatment chips, global Tension dial, scope hover preview, exploration trail replacing status line
- **Horizon 3:** cloud/CRDT, Serendipity Engine, Press Check, AI assistant, WebGPU, marketplace, native shell
- **Code debt:** `applyPosterStyle` compounds on repeat; export may mutate live canvas background non-atomically

REIMAGINED is **not done** — it's the 18-month vision. Carson is ~85% Horizon 1, ~50–60% Horizon 2, 0% Horizon 3.

---

## Verification

```bash
cd "/Users/niki_g/Local Files/workflow/Projects/carson"
npm test && npm run build && npm run dev
```

**Regression template (any treatment):** apply → chip in Treatments → re-roll → bypass → remove → source editable → Cmd+Z → save/reload reconciles.

**Constraints:** Don't commit unless asked. Don't commit `.codex/`. Features need a user-facing path to be "complete."

---

*Updated 2026-06-26*
