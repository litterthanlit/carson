# Carson — Horizon 2 Phase B3 Handoff (Pen Polish)

**Repo:** https://github.com/litterthanlit/carson  
**Branch:** `main` · latest: `e7fd879`  
**Parent:** [`HANDOFF-HORIZON-2-PHASE-B.md`](./HANDOFF-HORIZON-2-PHASE-B.md)  
**Prerequisite:** B0–B2 complete (path edit v2 shipped)

---

## Mission

Small polish pass on the freehand pen — no new tool modes. Keep pen strokes in the treatment pipeline and compatible with **Edit points** (B2).

**Do not start:** click-to-place bezier pen (stretch), vector booleans (B4), or Horizon 3.

---

## What exists today

| Item | Status | Where |
|------|--------|--------|
| Freehand pen | ✅ | `PencilBrush` · `App.tsx` `useEffect` ~397 |
| LeftRail Pen toggle | ✅ | `LeftRail.tsx` · `onTogglePenMode` |
| Stroke color/width | ✅ | Inspector when path selected · refs in `useCanvasEvents` |
| `path:created` tagging | ✅ | `useCanvasEvents.ts` → `kind: shape`, `Pen stroke` |
| Pen off when path edit | ✅ | `togglePathEditMode()` sets `penMode` false |
| `P` keyboard | ⚠️ Partial | `App.tsx` keydown toggles pen globally — **no** `isTypingContext` / canvas-focus guard |
| Stroke simplify | ❌ | — |
| Shortcuts list mentions `P` | ❌ | Inspector shortcuts panel |

**79 tests** · `npm test && npm run build` before handoff.

---

## B3 scope (in order)

### 1. Harden `P` shortcut (~30 min)

**Problem:** `P` fires even when typing in Inspector inputs.

**Fix in `App.tsx` keydown** (mirror `Delete` / `Tab` patterns):

- Guard with `isTypingContext(event.target)` — skip when focus is in `input`, `textarea`, `select`, or text edit mode.
- Optional: only toggle when canvas area focused (`.canvas-scroll` contains `document.activeElement`) — matches Tab layer-cycle behavior.

Move handler into `keyActionsRef` as `togglePen: () => setPenMode(v => !v)` for consistency.

**Acceptance:** `P` toggles pen from canvas; `P` does nothing while renaming a layer or editing text.

---

### 2. Pen ↔ path edit invariant (verify, ~15 min)

Already implemented — regression only:

- Enter **Edit points** → pen turns off (`togglePathEditMode`)
- Draw stroke → select → **Edit points** → add/delete/close still works (B2 QA template)

No code unless regression fails.

---

### 3. Simplify stroke (optional, ~1–2 hr)

Reduce noisy pen point count after draw.

1. Add `simplifyPathData(pathData, tolerance)` in `pathEditing.ts` (Douglas-Peucker on polyline anchors).
2. Call from `path:created` in `useCanvasEvents.ts` **before** `commitHistory`, or in a small post-process helper.
3. Unit tests in `pathEditing.test.ts` with a zigzag fixture.
4. Keep deterministic: fixed tolerance (e.g. `2` canvas units), no random seed.

**Non-goal:** changing stroke appearance noticeably on short strokes — tune tolerance conservatively.

**History:** simplifying mutates path before history commit is fine (single “Drew pen stroke” op with simplified geometry).

---

## Stretch — defer

**Click-to-place bezier pen** (Illustrator-style) is a separate PR (`bezierPenMode` state machine). Do not bundle into B3.

---

## Key files

| File | B3 role |
|------|---------|
| `src/App.tsx` | `penMode` state, `PencilBrush` effect, keyboard `P` |
| `src/hooks/useCanvasEvents.ts` | `path:created` · optional simplify hook |
| `src/lib/pathEditing.ts` | `simplifyPathData` if attempted |
| `src/components/LeftRail.tsx` | Pen button (reference UX) |
| `src/components/InspectorPanel.tsx` | Add `P` to shortcuts list when done |

---

## Verification

```bash
cd "/Users/niki_g/Local Files/workflow/Projects/carson"
npm test && npm run build
```

| Flow | Steps |
|------|--------|
| Pen toggle | Canvas focused → `P` on/off → draw stroke |
| No typo trap | Inspector name field focused → `P` inserts nothing / doesn't toggle |
| Path edit | Pen stroke → Edit points → drag anchor → Cmd+Z (incremental undo) |
| Treatments | Pen stroke → Scatter or slice → source still editable |

---

## Definition of done

- [ ] `P` shortcut guarded (typing + ideally canvas focus)
- [ ] Shortcuts panel documents `P`
- [ ] Pen + path edit + treatment regressions pass
- [ ] (Optional) simplify shipped with tests

**Next after B3:** B4 vector booleans — see parent handoff.

---

*Written 2026-07-04 · main @ `e7fd879`*
