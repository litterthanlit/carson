# Carson — Horizon 2 Phase B0 Baseline QA

**Date:** 2026-07-01  
**Branch:** `main` @ post-handoff  
**Scope:** Confirm path + treatment behavior before B1 (extract `usePathEditing`)

---

## Automated gate

```bash
npm test && npm run build
```

| Check | Result |
|-------|--------|
| Unit tests | **73 passed** (includes new `pathBaseline.test.ts`) |
| Production build | **Pass** |

---

## Regression flows

| Flow | Steps | Result | Notes |
|------|-------|--------|-------|
| **Pen draw** | LeftRail Pen → draw stroke → select → Inspector shows path props | **Pass** | Browser QA: stroke creates **Pen stroke** layer (`kind: shape`). |
| **Edit points** | Select path → **Edit points** | **Pass** | Button present; path-edit overlay active in `App.tsx`. Anchor drag math covered by `pathEditing.test.ts` + rotated-path case in `pathBaseline.test.ts`. |
| **Path undo** | Drag anchor → Cmd+Z | **Pass (debt noted)** | Undo restores via full canvas snapshot (`commitHistory('Edited path points')`). Works; incremental patch deferred to B2. |
| **Shapes + scatter** | Path/Ellipse → scatter treatment | **Pass** | `pathBaseline.test.ts`: scatter stack stored + transform applied without throw. |
| **Shapes + slice** | Path → slice treatment in stack | **Pass** | Treatment stored on path; artifact render uses `toDataURL` fragments (source hidden, not deleted) per 2.1 pattern. |
| **Stroke** | Path → dashed stroke + width → serialize | **Pass** | `strokeDashArray` / `strokeWidth` round-trip via `HISTORY_PROPS` in `pathBaseline.test.ts`. Save/autosave uses same props. |

---

## Treatment stack on `type === 'path'`

| Treatment | Stack storage | Visual apply | Source survives |
|-----------|---------------|--------------|-----------------|
| scatter | ✅ | ✅ transform | ✅ |
| slice | ✅ | ✅ fragments | ✅ hidden, editable |
| xerox / decay filters | ✅ | ⚠️ partial | ✅ |
| cold-wash | ✅ | ✅ opacity/blend | ✅ |

**Note:** Fabric `Path` has no `applyFilters`; filter-based treatments (grayscale/contrast stack) are skipped silently. Opacity / blend modes from xerox-decay still apply. Not a B0 blocker — document for B4/B2 polish if vector filter parity is required.

---

## Bugs filed

None blocking Phase B start. Known debt already in handoff:

1. Path-edit overlay in `App.tsx` (~398–486) → **B1**
2. Path edit history uses full snapshot → **B2** (`commitObjectPatchHistory`)
3. Filter treatments incomplete on raw paths → backlog (not regressions from 2.1)

---

## Sign-off

**B0 complete.** Safe to start **B1 — extract `usePathEditing`**.
