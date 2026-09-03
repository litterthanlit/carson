# Carson — Horizon 3 Agent Handoff

**Repo:** https://github.com/litterthanlit/carson  
**Branch:** `main` · latest: `72dfc01`  
**Prerequisite:** Horizon 1 complete · Horizon 2 **program closed** (12/12 items have user-facing paths; leftovers below)  
**Vision source:** [`REIMAGINED.md`](./REIMAGINED.md) §3 principles · §8 Horizon 3 items (3.1–3.7) · §9–§10  
**Parent:** [`HANDOFF.md`](./HANDOFF.md) · historical H2: [`HANDOFF-HORIZON-2.md`](./HANDOFF-HORIZON-2.md)

---

## Mission

Turn Carson from a **local professional instrument** into the **category**: a studio where precision and play are the same gesture, where accidents are shareable architecture, and where a team can go from feeling → comps → press without leaving the app.

**Horizon 2 done as a numbered program.** You are working **Horizon 3 only** unless fixing a regression or a leftover that blocks 3.2.

**Rough completion:** ~90% Horizon 2 · **~25% Horizon 3** (Instrument registry, decay marks + misprint + type strips on the stack, Gestures as performances, Tension dial, Copy Machine, WKWebView shell — 3.2 still needs Press Check; none of 3.1 / 3.3–3.7 are complete)

Do not claim an item complete without a **user-facing path**. Backend-only or test-only does not count. Read `REIMAGINED.md` before marking an item done.

---

## What Carson is (unchanged)

React 19 + Fabric.js 7 local poster editor. Moat = **seeded, non-destructive chaos** via treatment stacks on layers + poster-wide treatments on artboards.

- **Model layer:** `src/lib/editorModel.ts` — pure, deterministic; always inject `createSeededRandom(seed)` from callers.
- **Treatment stacks:** `src/lib/treatments.ts` + per-type `*Treatment.ts`; serialized on Fabric objects as `treatments` JSON.
- **Poster treatments:** `src/lib/posterTreatments.ts` → `scrapeTreatment.ts`; stored on `Artboard.posterTreatments`.
- **History:** `src/lib/historyLog.ts` + `useEditorHistory` — op log with periodic snapshots (`SNAPSHOT_EVERY = 20`). Trail frames in `src/lib/explorationTrail.ts`.
- **Persistence:** IndexedDB `carson-poster` via `src/lib/storage.ts`. No cloud. No Convex.
- **Native:** bare WKWebView in `macos/Sources/Carson/main.swift` — window + load `web/index.html`. No menus, no `.carson` files, no native save/open.

**273 tests** · always run `npm test && npm run build` before handoff. UI proof: [`.cursor/skills/verify-carson/SKILL.md`](../.cursor/skills/verify-carson/SKILL.md).

---

## Horizon 2 leftovers (optional — only if they block 3.2)

These are **not** Horizon 3. Do them when they are in the way of Instruments, Press Check, or CRDT.

| Leftover | Why it blocks H3 | Where |
|----------|------------------|--------|
| Canvas drag (`object:modified`) still full-snapshots | CRDT / infinite undo / 3.5 hitching | `useCanvasEvents.ts` |
| Pen is freehand `PencilBrush`, not click-to-place bezier | Not an H3 blocker | `App.tsx` pen mode |
| Soft-proof CMYK, not true plates | Press Check export fidelity | `cmykPreview.ts` / `print.ts` |
| Status line still sits above the trail | Cosmetic vs §9.5 | `EditorCanvas` `.stage-status` |

---

## Horizon 3 scorecard (REIMAGINED §8)

| ID | Item | Status | What exists | Missing |
|----|------|--------|-------------|---------|
| **3.1** | Cloud docs + realtime collab | **0%** | Local IndexedDB autosave; op log; variants + comps gallery | Accounts, share links, CRDT/multiplayer, pinned comments, named milestones, client-only comps view |
| **3.2** | Serendipity Engine (flagship) | **~65%** | `src/lib/instruments.ts` registry; Age / Ink loss / Fold / Wear / Misprint / Type strip on the layer stack; Tension scales registry intensity keys (including decay, decay-marks, misprint offset, type-strip jitter); Copy Machine; Gestures as recorded performances (Instruments + Cmd+K); Instruments palette | Shareable Instrument/Gesture assets; **Press Check** as a live document treatment with print-faithful export |
| **3.3** | AI studio assistant | **0%** | Cmd+K maps labels → handlers; scramble rearranges existing layers | Subject mask (editable, not cutout); Riff (6 layout variations of *this* composition); NL → visible slider moves; taste mirror from the user's own history. Hard lines below. |
| **3.4** | Cross-device | **0%** | Desktop browser + thin macOS WKWebView | Tablet stylus treatment painting; phone review/comments; same cloud doc |
| **3.5** | Performance re-platform | **~5%** | Copy Machine displacement is a **pure** `(imageData, seed, params) => imageData` designed to port to a shader; tiled raster export; 10k px cap | WebGPU tiled renderer at 60fps; workers for filter stacks; kill snapshot hitching on image-heavy docs and canvas drag |
| **3.6** | Community / marketplace | **0%** | Gestures and components live on `documentMeta` only | Share Instruments, Gestures, stacks, **Postures** (parameterized starting energies, never identical twice — P5) |
| **3.7** | Native shell maturity | **~10%** | WKWebView loads bundled `web/` | Menu bar, `.carson` file association, native save/open, Quick Look, offline-first cloud sync |

---

## Architecture you inherit

```
useEditorHistory()                  // hooks/useEditorHistory.ts
  commitHistory()            → snapshot op (full canvas JSON)
  commitTreatmentHistory     → layer treatment op OR snapshot
  commitPosterTreatmentHistory
  commitObjectPatchHistory
  commitLayerOrderHistory
  jumpToOpId()               → spatial undo for the trail

useTreatments()                     // hooks/useTreatments.ts
  Layer ops  → commitTreatmentHistory
  Poster ops → commitPosterTreatmentHistory
  tensionScale() ← gridTensionScale(gridOverlay.tension)

Copy Machine                        // lib/copyMachine.ts (pure warp)
  → copyMachineTreatment.ts         // companions + render
  Tension multiplies spatial params
  Designed to swap the warp for WebGPU later without changing the treatment model

Gestures                             // lib/gestures.ts
  gestureFromTreatments(stack)      // snapshot of enabled steps (still available)
  recordPlay() / gestureFromPerformance()
  COPY_SCATTER_COPY_GESTURE         // built-in macro
  Stored on DocumentMeta.gestures

Exploration trail                   // lib/explorationTrail.ts + ExplorationTrail.tsx
  Thumbnail filmstrip + jump
  Fork (Cmd+B) → named variant
  Comps gallery compare / merge

documentMeta                        // lib/document.ts
  artboards[].posterTreatments
  variants[], components[], gestures[]
  palette, dpi, bleedMm
```

### Ref pattern (do not break)

`App.tsx` (~4,400 lines) still owns most chaos handlers. Hooks talk through refs:

- `commitHistoryRef` / `commitTreatmentHistoryRef` / `commitPosterTreatmentHistoryRef`
- `refreshTreatmentStackRef` / `reconcileArtifactTreatmentsRef` / `refreshPosterTreatmentsRef`
- `tagObjectRef` / `activeObjectRef`

Function declarations (`syncSelected`, `selectLayer`, etc.) are **hoisted**.

### After every `loadFromJSON`

Always call **`reconcileArtifactTreatments()`** + **`refreshPosterTreatments()`**.

Serialize keys: `HISTORY_PROPS` in `editorConstants.ts`.

### Seeded chaos contract (do not break)

Every stochastic path takes `createSeededRandom(seed)` from the caller. Grep `editorModel` / `copyMachine` / `scramble` for calls that drop `random`. Re-roll must be the same algorithm + new seed, never hidden `Math.random()`.

---

## Hard lines (Horizon 3)

From `REIMAGINED.md` §8.3.3 and the product vision:

1. **AI never creates the poster.** No prompt-to-poster, no AI comps presented as finished work. AI executes and proposes; the designer decides. Every AI action is undoable and inspectable on the trail.
2. **Riff rearranges the user's elements.** Never generates new imagery.
3. **Masks stay editable.** Background removal outputs a layer mask, not a flattened cutout.
4. **NL command palette moves visible parameters.** The user watches sliders move and can grab them. No invisible magic.
5. **Postures are not templates.** Parameterized compositional attitudes that render differently per user per seed (P5).
6. **Do not start 3.4 / 3.6 before 3.2 has a user-facing Instrument + Gesture + Tension + Press Check path.**
7. **Do not add a backend until Phase D (3.1).** This repo has **no Convex**. If/when cloud starts, prefer Convex for documents, auth, comments, and realtime — CRDT multiplayer is a separate library choice on top of the op log, not "turn on Convex and get Figma."

---

## Recommended execution order

Prioritized by **dependency**, **differentiation**, and **existing partial work**. One Horizon 3 item (or one named slice of 3.2) per session when possible.

### Phase A — Serendipity Engine (3.2) ← start here

This *is* the Horizon 3 bet. Copy Machine, Gestures v1, and Tension are embryos of it — they are not the Engine yet.

**A1. Instrument registry — landed**  
`src/lib/instruments.ts`: typed Instrument (name, params, scope, tension keys). Age / Ink loss / Fold / Wear play through `playLayerInstrument`. Tension commit refreshes every treatment type with intensity keys.

**A2. Leftover one-shots onto the registry — landed**  
Decay marks, misprint offset, and type strips play through the registry onto the layer stack. Chip: re-roll, bypass, remove. Tension scales offset / jitter.

**A3. Gestures as performances — landed**  
Record a chain of instrument plays (`slice → scatter 30% → xerox 3`), not only `gestureFromTreatments` of the current stack. Replay from Instruments + Cmd+K. Persist on `documentMeta.gestures`.

**A4. Press Check**  
Document-scoped, non-destructive treatment: ink spread, misregistration, paper tooth. Toggle as a *mode* the designer can keep as the look. Export is print-faithful (the treatment is in the file, not a preview overlay). Reuse poster-treatment + Copy Machine spatial DNA. This is the feature nobody else has.

**Do not** build a marketplace (3.6) in this phase — make Instruments/Gestures *saveable in the doc* first.

---

### Phase B — Performance spike (3.5)

Start in parallel with A once A1 exists; do not wait for Press Check.

- Move Copy Machine warp behind a worker (pure function already).
- Replace `object:modified` snapshots with `objectPatch` (H2 leftover that is now a 3.5 blocker).
- Spike WebGPU tiled blit for 10k×10k; keep canvas2d fallback. Do not rip Fabric out in the spike.

Success: image-heavy xerox + copy-machine stays interactive; export does not hitch the UI thread.

---

### Phase C — Native shell (3.7)

Independent of cloud. Can run beside A/B.

- Real macOS menu bar mapped to existing commands (Save, Export, Undo, Fork).
- `.carson` document (JSON of canvas + `documentMeta` + seeds).
- Native open/save panels; Quick Look thumbnail from the existing trail/export raster path.

The WKWebView stays. Do not rewrite the editor in Swift.

---

### Phase D — Cloud documents (3.1)

**Prerequisite:** op log is the source of truth for edits you care to sync (A2 + Phase B drag patches). Snapshot-only collab will not work.

- Auth + hosted document.
- Share link.
- Comments pinned to layer ids (not pixels).
- Named milestones (trail frames that persist on the server).
- Role: **client sees comps gallery, not the editor** (variants + compare already exist locally).

Realtime: Convex (or equivalent) for presence/comments/document. True simultaneous canvas = CRDT *or* exclusive edit + follow. Pick explicitly; do not pretend presence is multiplayer.

---

### Phase E — AI as studio assistant (3.3)

**Prerequisite:** Phase A so NL can target named Instruments and move real sliders.

Ship in this order:

1. Editable subject mask / background removal.
2. Riff — 6 seeded layout rearrangements of current objects (scramble is the local ancestor).
3. Cmd+K natural language → instrument params, with sliders animating.
4. Taste mirror — draft styles from the user's own trail/gesture history, on request.

Every action commits history and appears on the trail.

---

### Phase F — Cross-device (3.4)

**Prerequisite:** Phase D (same cloud doc). Tablet = stylus-first *treatment painting* (paint decay where you want it with pressure). Phone = review + comments only.

---

### Phase G — Marketplace (3.6)

**Prerequisite:** Phase A4 + shareable Instrument/Gesture assets. Postures, not templates.

---

## Key files map

| File | Horizon 3 role |
|------|----------------|
| `src/lib/instruments.ts` | Typed Instrument registry — palette Age / Ink loss / Fold / Wear / Misprint / Type strip play through this |
| `src/lib/decayMarksTreatment.ts` | Ink-loss / fold / wear overlay as stack artifacts |
| `src/lib/misprintTreatment.ts` | Misregistered echo as a stack companion |
| `src/lib/typeStripsTreatment.ts` | Repeated type bars as stack companions |
| `src/lib/treatments.ts` | Layer treatment types — Instrument registry wraps this |
| `src/lib/copyMachine.ts` | First Instrument; WebGPU port target |
| `src/lib/copyMachineTreatment.ts` | Companions, non-destructive render |
| `src/lib/gestures.ts` | Gesture performances — record plays, save, replay |
| `src/lib/grid.ts` `gridTensionScale` | Tension multiplier — must apply to every Instrument |
| `src/components/TensionDial.tsx` | Signature control — keep; deepen what it drives |
| `src/components/InstrumentsPalette.tsx` | Chaos UI — should call registry, not App handlers |
| `src/lib/posterTreatments.ts` | Pattern for Press Check (document/artboard stack) |
| `src/lib/historyLog.ts` | Op log — CRDT / cloud prerequisite |
| `src/lib/explorationTrail.ts` | Spatial undo; AI actions must land here |
| `src/lib/scramble.ts` | Local ancestor of Riff |
| `src/lib/storage.ts` | IndexedDB — stays as offline cache when 3.1 lands |
| `src/lib/layerMask.ts` | AI subject-mask must write this, not flatten |
| `src/lib/commands.ts` | Cmd+K — NL in 3.3 maps to these |
| `src/App.tsx` | Still ~4,400 lines of chaos/export — shrink by extracting Instruments |
| `macos/Sources/Carson/main.swift` | 3.7 starting point |
| `docs/PLAN-COPY-MACHINE.md` | Instrument template + why warp is pure |
| `.cursor/skills/verify-carson/` | Required proof for any user-facing slice |

---

## Known gotchas (carry forward)

### History
- `restoringRef` blocks commits during `loadFromJSON`.
- Incremental ops: layer treatments, poster treatments, object patches, layer order. **Canvas drag is still a snapshot.**
- Snapshot undo is O(canvas JSON) — hitch on image-heavy docs. 3.5 exists because of this.

### Copy Machine
- Spatial bake is canvas2d `getImageData`. Fine for now; do not add a GL context only for export.
- Ghost companion is a tagged layer — exclude from layer semantics like scrape fragments.
- Tension already scales scatter/copy-machine spatial amplitude **and** registry intensity keys (Age, xerox, distress, decay-marks, misprint offset, type-strip jitter). New instruments must use `scaleTreatmentParams` / `gridTensionScale`, not a second global.

### Gestures
- Record captures ordered instrument plays while armed. Save stack as gesture is still a snapshot of the current enabled stack.
- Built-in Copy→Scatter→Copy is a constant in `gestures.ts`, also wired in Instruments + Cmd+K.
- Saved performances replay from Instruments, Inspector, and Cmd+K.

### Decay marks / misprint / type strips
- Companions are omitted from save JSON and stripped on reconcile, then re-rendered from seed. Source stays visible (unlike slice/glyph).

### Scrape / masks
- Poster scrape is `destination-out` to background; sources remain.
- Layer masks (`layerMask.ts`) are the contract for 3.3 subject cutout.

### App.tsx
- Do not grow it. New Instruments go in `lib/` + palette. Press Check is a poster/document treatment, not 200 more lines of handlers.

---

## Verification

```bash
cd "/Users/niki_g/Local Files/workflow/Projects/carson"
npm test && npm run build
```

UI slices: launch with `.cursor/skills/verify-carson/scripts/launch.sh`, doctor, drive, cleanup. Add a feature file when you ship a new user path. Never attach to the operator's `:5173`.

### Regression templates (always run)

| Flow | Steps |
|------|-------|
| Layer treatment | Apply → chip → re-roll → bypass → remove → source still editable → Cmd+Z → save/reload |
| Copy Machine | Instruments → Copy selected → chip → Tension moves intensity → Cmd+Z |
| Gesture | Record → play instruments → Save → replay from Instruments / Cmd+K → trail chips → undo |
| Trail / comps | Scatter → Fork → jump to earlier chip → Comps → Compare |
| Scrape | White scrapes → poster chip → re-roll/bypass → Cmd+Z |
| Print | Print guides on → export PDF → guides not in artwork |
| Onboarding | Fresh profile → Let's wreck it → scatter / xerox / re-roll / undo |

### Definition of done (Horizon 3 item)

A designer can reach it in the running app without a console. `REIMAGINED.md` is the bar, not a similar-looking control.

---

## Suggested next PR (copy-paste scope)

**Landed:** Gestures as performances. Playing Instruments while Record is armed captures ordered steps (not a stack snapshot). Replay from Instruments + Cmd+K. Persist on `documentMeta.gestures`. Proof: verify-carson `gesture-performance`.

**Title:** Press Check

**Why this next:** A3 is done. A4 is the unique 3.2 piece: a document-scoped, non-destructive print look the designer can keep and export. Do not start cloud / AI / marketplace / tablet.

**Acceptance criteria:**
- [ ] Press Check is a live document/artboard treatment (ink spread, misregistration, paper tooth), not a preview overlay
- [ ] Toggle as a mode the designer can keep as the look
- [ ] Export is print-faithful
- [ ] Trail chips + Cmd+Z
- [ ] Unit tests + verify-carson user path
- [ ] No cloud, no AI, no marketplace in this PR

---

## Constraints

- Don't commit unless asked
- Don't commit `.codex/` or verify-carson `artifacts/`
- No Convex / no `npx convex deploy` until Phase D. Local work does not need agent mode.
- Minimize scope — one named slice per session
- Match existing patterns: hooks + refs, pure `lib/*`, tests next to the lib, verify-carson for UI
- Do not start Horizon 3.4 or 3.6 early to "look complete"

---

## What success looks like (end of Horizon 3)

A designer can:

1. Play named Instruments on anything, record a Gesture, share it, and drive the whole poster with Tension — **Press Check is a look they can keep and print**
2. Invite a client to a comps gallery link; teammates comment on layers; the file at press is the file they played in
3. Ask the assistant to mask a subject, riff six layouts of *their* poster, or "make it more 1994" — and watch real parameters move, then undo on the trail
4. Paint decay with a stylus on tablet; review on phone
5. Work a 10k canvas without snapshot hitching
6. Open a `.carson` file from Finder with a real menu bar

The deepest win is cultural: "made in Carson" is a recognizable quality — texture, attitude, a human hand — at professional speed. That is 3.2 plus the rest as distribution, not the other way around.

---

*Updated 2026-09-03 · Gestures as performances landed · Horizon 3 ~25%*
