# Carson — Copy Machine: Master Plan

**Codename:** Copy Machine
**Goal:** A first-class, non-destructive **Photocopy treatment** that reproduces the physical "move the original while the scan bar is running" look — wobble, misregistration, drag streaks, toner voids, edge tearing, grain.
**Vision source:** [`REIMAGINED.md`](./REIMAGINED.md) §3 (P2 form-is-feeling, P3 accident-as-material), §8 items 2.1 (treatment core) & 3.2 (Serendipity Engine). Copy Machine is the flagship **Instrument**.
**Parent handoffs:** [`HANDOFF.md`](./HANDOFF.md) · [`HANDOFF-HORIZON-2.md`](./HANDOFF-HORIZON-2.md)

---

## 1. What the reference actually is

Break the target image into physical causes, because each cause is a separate render pass:

| # | Visual cue in reference | Physical cause | Render technique |
|---|--------------------------|----------------|-------------------|
| 1 | Heavy black, no midtones | High-contrast copier toner | Threshold-ish contrast curve + multiply |
| 2 | Edge tearing / waviness on glyph contours | Drum + paper slip at scan speed | Seeded **displacement map** (per-pixel xy offset) |
| 3 | Repeating light/void bands across the artwork | Scan-bar exposure bands / toner starvation | Horizontal band attenuation, seeded |
| 4 | Streaked / dragged regions ("STOP WAR" smear) | Original moved *during* the scan | Directional **drag/smear** pass along one axis |
| 5 | Speckle grain everywhere | Toner particle noise | Fine monochromatic noise, seeded |
| 6 | Slight double-image ghost on letters | Misregistered second pass | Offset duplicate at low opacity (already have: `addMisprintDuplicate`) |
| 7 | Occasional full white voids | Toner dropout / paper crease | Void blobs painted as erase |

**Key insight:** cues 2–4 are *spatial* (they move pixels), cues 1, 5–7 are *tonal* (they change pixel values). Carson's current Fabric-filter approach can only do tonal. The spatial cues are the soul of the look, so they drive the architecture decision below.

---

## 2. Architecture decision

### The problem with today's stack

`buildTreatmentFilters()` chains Fabric `BaseFilter`s (Grayscale → Contrast → Noise → Blur). Fabric filters are per-object, pixel-value-only, and applied to a baked raster of the object. They **cannot displace pixels spatially**, so they cannot produce wobble, tearing, or drag — the three cues that make the reference read as "copier" rather than "grungy filter."

### Decision: two render paths, one treatment

```
Copy Machine treatment
├── Spatial pass (new)     — displacement map, applied via WebGL/canvas shader
│                            or pre-baked into an offscreen render
└── Tonal pass (existing)  — Grayscale → Contrast → Noise → Blur → Multiply
```

**Recommendation: offscreen 2D-canvas displacement bake, not a live WebGL shader (yet).**

- Fabric 7's filter pipeline supports custom `WebglFilter`, but a shader adds a hard dependency on a GL context everywhere (export path, thumbnails, headless tests). The codebase currently runs canvas2d throughout.
- A cheaper, deterministic approach: render the source object to an offscreen canvas, run a **seeded displacement-map warp** in plain canvas2d (`getImageData` + per-pixel sample offset), then feed the result through the existing tonal filters. This is testable headless, works at any DPI, and keeps the seeded determinism the moat depends on.
- WebGL displacement is the Horizon-3 performance re-platform (3.5). Design the displacement stage as a **pure function** `(imageData, seed, params) => imageData` so it can be ported to a shader later without touching the treatment model.

This preserves the non-destructive contract: the **source object is untouched**; the Copy Machine output is a rendered artifact whose parameters live in the treatment stack and can be re-rolled, reordered, bypassed, removed.

### Where it slots in

Copy Machine is a **filter-class treatment** (like xerox/decay), **not** an artifact treatment (like slice/tear). It renders into the object's filter/displacement result rather than spawning fragment layers — with one exception: the optional misregistration ghost is a *companion layer* (see §4, param `ghost`).

---

## 3. The Instrument model (fits Serendipity Engine 3.2)

Define Copy Machine as the first **Instrument**: a named chaos operator with typed params, a seed, and a re-roll affordance. This is the template for unifying Accident/Xerox/Decay later.

```ts
// src/lib/copyMachine.ts (new, pure, deterministic)
export type CopyMachineParams = {
  // tonal
  contrast: number      // 0..100  — toner crush
  grain: number         // 0..100  — toner speckle density
  voids: number         // 0..100  — dropout blob count/size
  // spatial (the soul)
  wobble: number        // 0..100  — displacement amplitude (px at canvas scale)
  wobbleFreq: number    // 0..100  — displacement frequency (torn-edge tightness)
  drag: number          // 0..100  — scan-direction smear length
  dragAngle: number     // 0..359  — smear direction (deg, default ~90 vertical scan)
  bands: number         // 0..100  — scan-bar banding strength
  // companion
  ghost: number         // 0..100  — misregistration echo opacity; 0 = off
  ghostOffset: number   // px      — echo displacement
}

export const COPY_MACHINE_DEFAULTS: CopyMachineParams = { /* tasteful mid values */ }

// Pure, injectable random — matches editorModel contract
export function renderCopyMachine(
  source: CanvasImageSource, width: number, height: number,
  params: CopyMachineParams, random: () => number,
): HTMLCanvasElement
```

Extend the treatment union:

```ts
// treatments.ts
export type TreatmentType = ... | 'copy-machine'
```

- `treatmentLabel` → `` `Copy·#${seed}` `` (seed-forward labeling, like Scatter — the seed *is* the identity, per P3).
- Registered in `buildTreatmentFilters` for the tonal half; the spatial half runs before filters in `renderTreatmentStackOnCanvas`.
- **Not** added to `ONE_PER_LAYER` — stacking Copy Machine gen-on-gen (a copy of a copy) is a legitimate Carson move. Two Copy treatments = generational degradation.

---

## 4. Phased scope

### Phase CM-0 — Spike: displacement bake (½ day, derisk first)
Prove the spatial warp in isolation before any UI.

- `src/lib/copyMachine.ts`: `buildDisplacementField(width, height, params, random)` → `Float32Array` of xy offsets (seeded value-noise; `wobble` = amplitude, `wobbleFreq` = cell density).
- `applyDisplacement(imageData, field)` — inverse-map sampling, bilinear.
- `applyDrag(imageData, params, random)` — axis-aligned smear along `dragAngle`.
- Unit test with a fixture: a 64×64 checkerboard, fixed seed → assert specific pixels moved and output is **byte-identical across two runs** (determinism guard, the moat's contract).
- **Acceptance:** render the reference's cue #2 (edge wobble) and #4 (drag) on a test glyph, side-by-side with the photo.

### Phase CM-1 — Tonal core + params (user-facing v1)
- Wire `copy-machine` into `treatments.ts` (tonal filters) + a render hook that runs the spatial bake first.
- Params surfaced in the Inspector treatment editor: sliders for contrast, grain, wobble, drag, bands, voids.
- Add to **LeftRail → Treatments** and **Cmd+K** ("Copy machine", "Photocopy", "Xerox warp").
- Chip gets a **re-roll dice** (new seed, live preview) — reuse existing treatment re-roll.
- **Acceptance:** select text → apply Copy Machine → edge wobble + grain visible → drag slider changes it live → re-roll → bypass → remove → source text still editable → Cmd+Z.

### Phase CM-2 — Misregistration ghost (companion layer)
- [x] `ghost > 0` spawns a low-opacity, offset clone behind the source — generalize the existing `addMisprintDuplicate` (`App.tsx`) from a one-shot action into a **parameterized, treatment-owned companion** that re-renders on param change and cleans up on treatment remove.
- [x] Ghost inherits the tonal pass, not the spatial pass (the ghost is the *other* pass of the drum).
- **Acceptance:** ghost on → drag `ghostOffset` → echo moves → remove treatment → ghost layer removed → undo restores both.

### Phase CM-3 — Poster-scope "Run through the copier"
- [x] A canvas-scoped variant (ScopeBadge ALL) that flattens nothing but applies the treatment to every visible layer with **per-layer seed offsets** derived from the master seed (`seed + layerIndex`) — so the whole poster looks like one physical pass but stays editable per layer.
- [x] This is the "Press Check" embryo (REIMAGINED 3.2).
- **Acceptance:** ALL Copy Machine → all layers treated, each re-rollable individually → one undo step for the whole operation.

### Phase CM-4 — Gesture recording (stretch, feeds 3.2)
- "Copy → Scatter → Copy" as a recordable **Gesture** (macro chain). Only scope if CM-0–2 land clean.

---

## 5. Parameter philosophy (P2 / P4)

- **Emotional names, pro values.** Sliders labeled *Wobble*, *Drag*, *Grain*, *Voids*, *Bands*, *Ghost* — with the underlying px/% as secondary text. Matches §9.9 (plain language + pro vocabulary).
- **Wobble and Drag are the signature.** Default preset should nail the reference: `wobble ~35`, `drag ~40`, `bands ~25`, `grain ~60`, `contrast ~75`, `ghost ~20`.
- **No legibility police (P4).** Copy Machine can and will destroy text. That's the point. The existing legibility readout stays an *instrument*, never a warning.
- **Tension dial ready (3.2).** Every param is a plain number 0–100, so the future global Tension fader can scale them all uniformly — design params with that multiplier in mind (scatter already takes `tensionScale`; Copy Machine should too).

---

## 6. Key files

| File | Role |
|------|------|
| `src/lib/copyMachine.ts` | **New.** Pure displacement/tonal render, seeded. All math here. |
| `src/lib/copyMachine.test.ts` | **New.** Determinism + param-mapping tests. |
| `src/lib/treatments.ts` | Register type, label, tonal filters, render hook |
| `src/lib/editorModel.ts` | Reuse `createSeededRandom`; maybe a `getCopyMachineProfile(intensity)` like the xerox/decay profiles |
| `src/hooks/useTreatments.ts` | Ghost companion layer lifecycle (CM-2) |
| `src/components/InspectorPanel.tsx` | Copy Machine param editor (slider group) |
| `src/components/LeftRail.tsx` | Treatment entry point + scope badge |
| `src/components/CommandPalette.tsx` | Cmd+K registration |
| `src/App.tsx` | `addMisprintDuplicate` → refactored into companion-layer helper (CM-2) |

---

## 7. Gotchas

- **Text must stay text.** The spatial bake operates on the object's *rendered pixels* for display, but the Fabric source object keeps its type and editability. Never `toDataURL` → replace the source. This is the whole 2.1 contract — a Copy-treated headline is still a headline the client can reword.
- **Displacement at export DPI.** The displacement amplitude is in canvas px; at 4× export it must scale or the wobble will look 4× too fine. Compute amplitude as `wobble * (exportScale)` in the export render path. (`print.ts` / export pipeline.)
- **Determinism on reload.** The displacement field is derived from `seed` only — never store the baked bitmap. On `loadFromJSON`, re-render from seed (same as `reconcileArtifactTreatments` does for slice/tear).
- **Ghost vs. artifact-fragment cleanup.** Ghost companions need a tag key (e.g. `COPY_GHOST_SOURCE_ID_KEY`) and must join the orphan-cleanup sweep in `cleanupOrphanedArtifactFragments` so removing the treatment doesn't leak ghost layers.
- **Performance.** `getImageData` displacement is O(w×h) — fine for a poster object, but cache the baked result per `(seed, params, exportScale)` and invalidate only on param/seed change. Don't rebake on every canvas frame.
- **Fabric filter ordering.** Tonal filters run *after* the spatial bake, so grain sits on top of the warped edges (correct — toner grain is applied by the drum, after the paper slips).

---

## 8. Definition of done

Per project rules, **not complete without a user-facing path.**

- [x] CM-0 displacement spike renders wobble + drag, byte-identical on repeat (test green)
- [x] `copy-machine` in treatment union, label, Cmd+K, LeftRail with scope badge
- [x] Inspector param sliders, live re-render, re-roll dice, bypass, remove
- [x] Source object editable after apply; Cmd+Z works (incremental treatment op, not full snapshot)
- [x] Save → reload → re-renders identically from seed
- [x] Export at 4× shows correctly scaled wobble
- [x] CM-2 ghost companion with cleanup + undo
- [x] Regression templates in HANDOFF pass (slice/tear/scatter/xerox unaffected)

---

## 9. Why this is the right next move

1. **It's the moat, productized.** REIMAGINED calls the chaos tools the differentiator but "gimmicks" until they're parametric, re-rollable, revertible. Copy Machine is the most legible, most desirable chaos instrument — the reference image is instantly recognizable and endlessly reproducible in client work (gig posters, zines, editorial).
2. **It proves the Instrument architecture** that the entire Serendipity Engine (3.2) is built on — typed params, seed, re-roll, companion layers, poster-scope. Build Copy Machine right and Xerox/Decay/Scrape fold into the same system.
3. **It's achievable now.** The deterministic model layer, treatment stack, re-roll UI, and misprint-duplicate primitive already exist. The only genuinely new engineering is the displacement bake, and it's isolated and testable.
4. **It forces the two hard problems early** — spatial (non-filter) treatments and export-DPI scaling — in a contained scope, before Press Check or the full Serendipity Engine depend on them.

---

## Suggested PR sequence

| PR | Title | Scope |
|----|-------|-------|
| 1 | Copy Machine displacement bake (CM-0) | `copyMachine.ts` + tests only, no UI |
| 2 | Copy Machine treatment v1 (CM-1) | treatments wiring + Inspector + LeftRail + Cmd+K |
| 3 | Misregistration ghost companion (CM-2) | `useTreatments` + App refactor of `addMisprintDuplicate` |
| 4 | Poster-scope copier pass (CM-3) | canvas-scope + per-layer seeds |

---

*Written 2026-08-08 · main @ `f01cc53` · Phase B (vectors/booleans) complete*
