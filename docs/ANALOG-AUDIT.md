# Analog audit — October 2026

Every effect checked against the six rules in [CARSON-METHOD.md §0](./CARSON-METHOD.md): **model the cause**, **physical units**, **hands aren't rulers**, **matter is conserved**, **edges carry the truth**, **every accident seeded**.

Already built to the standard: Copy Machine, Tape lift, Letter break, Weave, Found paper, Crumple, Photograph the collage.

Status: **Fixed** (this pass) · **Open**.

## Headline findings

- The filter-stack treatments (Xerox, Age, Distress, Cold wash) only reach pixels on image layers. On type they were an opacity/blend tweak (Xerox, Age) or nothing (Distress) — and onboarding step 2 runs Xerox on a textbox.
- Fabric's `Noise` filter calls `Math.random` on every `applyFilters`, so any treatment using it re-rolled on every refresh, reload and export.
- Almost nothing outside the rebuilt set knows the sheet's physical size; sizes are poster px constants.

## Findings

| # | Effect | What it did | Rules broken | Sev | Status |
|---|---|---|---|---|---|
| 1 | Xerox / Copy selected | Grayscale+Contrast+Noise+Blur filters; on type only opacity+multiply | 1 2 5 6 | High | **Fixed** — runs the Copy Machine engine set by generation; old saves render through it |
| 2 | Age / Decay | Contrast+Noise+Blur; nothing ages | 1 2 5 6 | High | **Fixed** — paper ageing: yellowing toward the edges, ink fade, foxing, in mm |
| 3 | Distress | Contrast+Noise+Blur; nothing on type | 1 2 5 6 | High | **Fixed** — abrasion: rubbed off along strokes, through the paper's tooth |
| 4 | Cold wash | Grayscale + blue BlendColor + Noise | 1 6 | Med | Open — single cool ink through a halftone |
| 5 | Filter Gallery (28 Photoshop-style filters) | Pure looks; sizes as layer fractions; rasterises text | 1 2 | Med | Open — move to a "Digital" shelf |
| 6 | "Newsprint" | Pixelate (square blocks) | 1 5 | High | Open — real 85 lpi dot screen in mm |
| 7 | "Grain", "Wash paint" | Uniform `Math.random` noise | 5 6 | Med | Open |
| 8 | Inspector image effects | Fabric Blur/Noise | 6 | Low | Open |
| 9 | Slice | Equal, ruler-straight, axis-aligned strips; kerf discarded | 2 3 4 5 | High | **Fixed** — hand-cut lines shared by neighbours, wobble, mm |
| 10 | Bad crop | Three straight strips, hard-coded angles, multiply | 3 4 5 | Med-High | Open — reuse the hand-cut geometry |
| 11 | Crop | Axis-aligned crop; double-rotation; throw lost on refresh | 3 5 | Med | Open |
| 12 | Tear collage | Straight rectangles named "torn" | 1 2 3 4 5 | High | **Fixed** — real tear lines shared by neighbours, fibre rim, mm |
| 13 | Break letters (glyph-break) | Fixed advances, recolours letters cyan/lime | 1 4 | Med-High | Open — merge into Letter break |
| 14 | Type strip | Perfect bars with invented Arial Black text | 3 4 5 | High | Open |
| 15 | Misprint offset | Faint clone that reads as a drop shadow | 1 2 | Med | **Fixed** — a second impression of the same ink at full density, misfed ~0.4–2 mm, turned about the gripper edge |
| 16 | Ink loss / Fold marks | Paper-coloured rectangles; 2px lines on one layer | 1 3 4 5 | High | **Fixed** (Ink loss — ink eroded from the edges in, fibre-frayed) · Open (Fold → sheet-wide crease) |
| 17 | Scatter | ±46px, ±18°, ±14% scale, uniform | 2 3 | Med | **Fixed** — hand pose: mm drift, mostly-small angles, no rescaling |
| 18 | White scrapes | Even straight rects as transparent holes, 1024px raster | 1 2 3 5 | High | Open — blade strokes revealing paper |
| 19 | Press Check | RGB split, px constants, 1280/2048px raster | 1 2 | Med-High | Open — CMYK plates shifted in mm |
| 20 | Photocopy noise | 117 shape layers incl. cyan scanlines | 2 3 5 | High | **Fixed** — runs the Copy Machine (grain, streaks) |
| 21 | Surface wear | Even black bands, cyan rects | 1 3 5 | High | **Fixed** — runs the Copy Machine (bands, streaks) |
| 22 | Diagonal texture | Perfect 18px hatch, ~940 rect layers | 2 3 5 6 | High | Open — Letratone sheet, cut by hand |
| 23 | Duplicate drift / Nudge layout | px moves, stretch, fades; Nudge moves fragments | 2 3 4 | Med | Open — hand pose |
| 24 | Flip mistake, Collide, Bury type, Decay offset | Unseeded constants, `difference` blend, clones | 1 3 4 6 | Med | Open |
| 25 | Red echo type | Hard-coded "ECHO" in Arial Black | 1 4 6 | Med | Open — rubber-stamp the selected word |
| 26 | Poster energy presets | Cycles every blend mode, parity offsets | 3 6 | Med | Open |
| 27 | Crop marks / grid | 1px rects; cyan rule-of-thirds grid | 2 | Low | Open |
| 28 | Seed poster | Perfect rects, 34 steps per torn edge, folds at exactly ½ | 2 3 5 | Low-Med | Open |

`Math.random` traps: `editorModel.ts` generators fall back to `options.random ?? Math.random` — every caller passes a seed today, but `random` should be required.

## Known limitation (open)

Raster companions are each made from the source: a layer carrying two of the separate families — copier (Xerox/Copy machine), tape lift, cuts (Slice/Tear), surface (Age/Distress/Ink loss), letter break — shows two prints. Within a family they compose (the surface pipeline runs Age → Distress → Ink loss on one print). The long-term fix is one per-layer print pipeline that every family feeds in stack order.

The Copy Machine itself still sizes its halftone, mottle, wobble and drag in poster px rather than mm (correct at 300 dpi, coarse on a 72 dpi screen poster).

