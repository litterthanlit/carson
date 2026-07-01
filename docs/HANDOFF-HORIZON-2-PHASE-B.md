# Carson — Horizon 2 Phase B Handoff (Vectors & Pen)

**Repo:** https://github.com/litterthanlit/carson  
**Branch:** `main` · latest: `a090949`  
**Prerequisite:** Phase A / **2.1 complete** (see [`HANDOFF-HORIZON-2.md`](./HANDOFF-HORIZON-2.md))  
**Vision source:** [`REIMAGINED.md`](./REIMAGINED.md) §8 item **2.3**  
**Parent handoff:** [`HANDOFF-HORIZON-2.md`](./HANDOFF-HORIZON-2.md) · [`HANDOFF.md`](./HANDOFF.md)

---

## Mission

Make Carson’s vector layer credible for client revisions: designers can draw, edit bezier paths, combine shapes, and run the same treatment stacks on vectors as on text and images — without baking to PNG.

**Phase B = Horizon 2 item 2.3 only.** Do not start typography depth (2.2), booleans-dependent IA (2.9), or Horizon 3.

**Rough completion:** **2.3 ~50%** · overall Horizon 2 ~62–70%

---

## What exists today (audit @ `a090949`)

| Capability | Status | Where |
|------------|--------|--------|
| Ellipse, line, star | ✅ Shipped | `App.tsx` `addEllipse` / `addLine` / `addStarShape` · LeftRail buttons |
| Freehand pen | ✅ Shipped | `PencilBrush` in `App.tsx` · `path:created` in `useCanvasEvents.ts` |
| Stroke dash presets | ✅ Shipped | `applyStrokeDash` · Inspector when shape selected |
| Path edit v1 | ✅ Partial | Inspector **Edit points** · drag anchors + cubic/quadratic handles |
| Path math (pure) | ✅ Shipped | `src/lib/pathEditing.ts` + tests |
| Polygon tool | ❌ Missing | Star uses `Polygon`; no arbitrary polygon / sides UI |
| Click-to-place bezier pen | ❌ Missing | Current pen is freehand only (REIMAGINED “pen with bezier editing” = edit + draw) |
| Add / delete anchor | ❌ Missing | |
| Close path | ❌ Missing | |
| Handle snapping | ❌ Missing | Object snap exists (`snapping.ts`); path points don’t use it |
| Boolean union / subtract / intersect | ❌ Missing | No spike yet |
| Path-edit overlay location | ⚠️ Debt | ~90 lines in `App.tsx` `useEffect` (~398–486) |
| Path edit undo | ⚠️ Debt | `commitHistory('Edited path points')` — full snapshot |
| Treatment stacks on vectors | ✅ Architecture | Paths tagged `shape`; `addTreatment` works if type is path — verify in QA |

**69 tests** · run `npm test && npm run build` before handoff.

---

## Architecture you inherit

```
LeftRail                    // Pen toggle, shape buttons
  penMode → PencilBrush     // App.tsx useEffect ~377
  onAddEllipse/Line/Star

useCanvasEvents             // path:created → tag + commitHistory
  object:modified → commitHistory (canvas drag — still snapshot)

InspectorPanel              // selectedIsPath → Edit points, stroke color/width
  pathEditMode toggle

pathEditing.ts (pure)       // getPathAnchorPoints, movePathPoint, pathPointNear,
                            // applyPathData, pathAnchorWorldPosition

App.tsx path-edit overlay   // contextTop handles, pointerToPathLocal,
                            // util.invertTransform + path.pathOffset  ← fragile
```

### Ref pattern (unchanged)

`App.tsx` still wires history through refs. Path editing should receive:

- `canvasRef`, `displayScaleRef`, `activeObjectRef`
- `commitHistoryRef` or **`commitObjectPatchHistoryRef`** (preferred for path JSON patches)
- `syncSelected`, `setPathEditMode`

Function declarations (`activeObject`, `syncSelected`, etc.) are hoisted — hooks may reference them.

### Treatment stack rule (2.3)

Vectors must stay in the treatment pipeline. **Do not** add `toDataURL` → delete → `FabricImage` paths for slice/crop/boolean results. Prefer:

1. Keep source path(s) hidden + artifact fragments (slice/tear pattern), or  
2. Replace path `path` data in place + preserve `treatments` JSON on the object.

---

## Recommended execution order

Prioritized by **dependency**, **risk reduction**, and **user-visible path**.

### B0. Baseline QA (30 min)

Confirm current path + treatment behavior before editing:

| Flow | Steps |
|------|--------|
| Pen draw | LeftRail Pen → draw stroke → select → Edit points → drag anchor → Cmd+Z |
| Shapes | Add ellipse/line/star → apply scatter or slice treatment → source still editable |
| Stroke | Select path → Inspector dash + stroke width → save/reload |

File bugs if treatment stack breaks on `type === 'path'`.

---

### B1. Extract path-edit overlay ← **start here**

**Problem:** Path edit UI + listeners live inside `App.tsx` (~398–486). Blocks pen polish and testability.

**Target structure (pick one, prefer hook):**

```
src/hooks/usePathEditing.ts     // registers canvas listeners, owns pathEditDragRef
  OR
src/components/PathEditOverlay.tsx  // thin wrapper if you need React tree
```

**Move out of App.tsx:**

- `drawPathHandles` (contextTop anchor/control dots)
- `pointerToPathLocal` (`util.invertTransform` + `pathOffset`)
- `onMouseDown` / `onMouseMove` / `onMouseUp` drag loop
- `pathEditDragRef`

**Keep in App.tsx:**

- `pathEditMode` state
- `togglePathEditMode()` (disables pen when entering edit)
- Wire hook: `usePathEditing({ canvasRef, pathEditMode, displayScaleRef, ... })`

**Acceptance:**

- [ ] Edit points behavior unchanged on rotated/scaled paths
- [ ] `App.tsx` loses path-edit `useEffect` block
- [ ] No new linter suppressions

**Files:** `App.tsx`, new `usePathEditing.ts`, optional `pathEditing.ts` helpers if overlay logic grows

---

### B2. Path edit v2 — add / delete / close / snap

Extend **`pathEditing.ts`** (pure functions + unit tests first).

| Feature | Sketch |
|---------|--------|
| **Add point** | Click on segment (L or C) → split command → insert anchor |
| **Delete point** | Select anchor → Delete/Backspace (when `pathEditMode` && not typing) → remove command, merge neighbors |
| **Close path** | If first ≠ last, append `Z` or `L` to first anchor; Inspector button **Close path** |
| **Snap** | In `pointerToPathLocal` or move handler: reuse `computeSnap` from `snapping.ts` for anchor drag; optional snap to other objects’ bounds |

**UI (Inspector, `selectedIsPath`):**

- **Add point** — click segment on canvas (mode flag) or **+ Point** after selecting segment
- **Delete point** — keyboard when anchor selected (track `selectedAnchorRef`)
- **Close path** — button, disabled when already closed

**History:** Store path data as incremental op:

```typescript
// Extend objectPatch OR add pathData op:
{ type: 'objectPatch', objectId, before, after }
// before/after includes serialized path command array + left/top/angle if needed
```

Use `commitObjectPatchHistoryRef` — capture full patch via `captureObjectPatch` + path JSON field, or add `capturePathState(path)` helper.

**Acceptance:**

- [ ] Add/delete/close work on rotated path
- [ ] Cmd+Z restores path geometry without full canvas reload
- [ ] `pathEditing.test.ts` covers add/delete/close helpers
- [ ] User path: draw pen stroke → Edit points → add point → close → undo

---

### B3. Pen tool polish

**Current:** `PencilBrush` freehand — good for Carson chaos, not precision logos.

**Minimum (Phase B):**

1. **Keyboard:** `P` toggles pen (mirror LeftRail) — add to `keyActionsRef` in `App.tsx`
2. **Exit pen on path select:** leaving pen mode when entering path edit (already partially there)
3. **Simplify stroke (optional):** Douglas-Peucker on `path:created` to reduce point noise — pure fn in `pathEditing.ts`, seeded off for determinism or use fixed tolerance

**Stretch (defer if B2 runs long):**

- Click-to-place bezier pen (Illustrator-style): separate `bezierPenMode` with state machine (`placing` / `dragging handles`) — large PR; split from B3 if attempted

**Acceptance:**

- [ ] `P` toggles pen from canvas focus
- [ ] Pen stroke still gets treatment stack + Edit points

---

### B4. Vector booleans

**Problem:** No union/subtract/intersect. REIMAGINED requires vectors that accept treatment stacks.

**Research first (½ day):**

1. Fabric 7 `Path` + `path` SVG command arrays — no built-in boolean API
2. Evaluate:
   - **paper.js** `Path.unite()` / `subtract()` / `intersect()` → export SVG path back to Fabric
   - **clipper-lib** / **martinez-polygon-clipping** for polygon-only booleans
   - Fabric `clipPath` as non-destructive *mask* (intersect preview only — not true boolean output)

**Recommended MVP:**

- Command: **Combine** (union) on 2+ selected paths → single `Path`, preserve top object’s `treatments`, delete sources
- Inspector or Cmd+K: **Subtract** (second selected punches first), **Intersect**
- Implementation in `src/lib/pathBoolean.ts` (pure) + `combinePaths()` in App or `useVectorTools` hook
- History: snapshot or dedicated op — booleans change object count (acceptable snapshot)

**Non-goals for B4:**

- Live boolean stack (Illustrator appearance panel)
- Round-trip SVG export of boolean result (Phase E)

**Acceptance:**

- [ ] Select two ellipses → Union → one path → apply Xerox treatment → undo
- [ ] `pathBoolean.test.ts` with fixture paths
- [ ] User-facing path in Inspector or Cmd+K palette

---

## Key files map

| File | Phase B role |
|------|----------------|
| `src/lib/pathEditing.ts` | Pure path command math — extend here |
| `src/lib/pathEditing.test.ts` | Unit tests for new command ops |
| `src/lib/snapping.ts` | Reuse for anchor snap |
| `src/hooks/useCanvasEvents.ts` | `path:created`, pen stroke tagging |
| `src/App.tsx` | Shape factories, path-edit debt, keyboard `P` |
| `src/components/InspectorPanel.tsx` | Path edit UI, close/add/delete buttons |
| `src/components/LeftRail.tsx` | Pen + shape entry points |
| `src/lib/historyObject.ts` | Incremental undo for path edits |
| `src/hooks/useEditorHistory.ts` | `commitObjectPatchHistory` restore path |
| `src/lib/treatments.ts` | Ensure path types render in stack |

---

## Gotchas

### `path.pathOffset` + transforms

Path edit already uses `util.invertTransform(path.calcTransformMatrix())` and adds `pathOffset` when converting pointer → local. **Any new hit-testing or add-point-on-segment logic must use the same transform** or anchors will drift on scaled paths.

### `applyPathData`

Uses `path._setPath(pathData, true)` — Fabric internal API. If Fabric 7.3+ exposes public setter, prefer it; otherwise keep centralized in `applyPathData`.

### Pen vs path edit mode

Both disable selection (`skipTargetFind`, `selection: false`). Only one active at a time. `togglePathEditMode` sets `penMode` false — preserve that invariant.

### Path edit history

`commitHistory('Edited path points')` on mouseup forces full snapshot. **Migrate to `commitObjectPatchHistory`** when touching B2 (session: capture path on mousedown, commit on mouseup).

### Boolean + treatments

When merging paths, **merge `treatments` arrays** from the primary object or warn if secondary had treatments. Document choice in PR.

### Selection scope

Booleans require exactly 2 paths (or 2 shapes convertible to path). Show `ScopeBadge` / status if wrong selection — same pattern as chaos tools.

---

## Verification

```bash
cd "/Users/niki_g/Local Files/workflow/Projects/carson"
npm test && npm run build && npm run dev
```

### Regression templates (always run)

| Flow | Steps |
|------|--------|
| Pen | Pen → draw → select → Edit points → drag handle → Cmd+Z |
| Shapes | Ellipse → slice treatment → re-roll → source editable |
| Path v2 | Add point → delete point → close path → undo/redo |
| Boolean | Two ellipses → union → apply decay → save/reload |
| Stroke | Path → dashed stroke → reload persists |

### Definition of done (2.3 item)

Per project rules: **not complete without a user-facing path.** Each sub-feature needs UI in Inspector, LeftRail, or Cmd+K — not lib-only.

**Phase B complete when:**

- [ ] Path edit extracted from `App.tsx`
- [ ] Add / delete / close path shipped with incremental undo
- [ ] Boolean union + subtract (intersect stretch) with treatment compatibility
- [ ] `pathEditing` + `pathBoolean` tests green
- [ ] Scorecard 2.3 ≥ **~85%**

---

## Suggested PR sequence (copy-paste)

| PR | Title | Scope |
|----|-------|--------|
| 1 | Extract usePathEditing hook | B1 only — no behavior change |
| 2 | Path edit add/delete/close + snap | B2 + incremental history |
| 3 | Pen keyboard + polish | B3 |
| 4 | Path boolean union/subtract | B4 spike + MVP |

---

## Constraints

- Don't commit unless asked
- Don't commit `.codex/`
- Minimize scope — one PR per row above when possible
- Match patterns: pure `lib/*` + tests, hooks for canvas listeners, refs for circular deps
- Features need user-facing path to count as complete

---

## What success looks like (end of Phase B)

A designer can:

1. Draw with pen, refine beziers (add/delete/close), snap anchors to layout
2. Combine shapes with booleans without rasterizing
3. Run Xerox / slice / scatter on vector results — same stack as photos and type
4. Undo path and boolean edits without full-document hitch

**Next after Phase B:** Phase C (2.2 typography) or Phase D (2.4 blend-mode hover preview) — see [`HANDOFF-HORIZON-2.md`](./HANDOFF-HORIZON-2.md).

---

*Written 2026-06-29 · main @ `a090949` · Phase A (2.1) complete*
