# How David Carson works — and what Carson (the app) does about it

A field guide to the method behind the tool. Each claim is marked **sourced** (Carson or a primary interview says so) or **inferred** (read from the work or the period's standard techniques — plausible, not documented). Features are mapped to the code that implements them, then the gaps.

---

## 1. The method in seven lines

1. **Read the content first.** "Read the article. Look at the art. Listen to the music." The form comes from the material, never a formula. *(sourced — [Jeff Mellin interview](https://www.jeffmellin.com/davidcarsoninterview), [designboom 2021](https://www.designboom.com/design/david-carson-masterclass-graphic-design-interview-04-22-2021/))*
2. **No grid.** "I've never used grids; I still don't." *(sourced — [AIGA Eye on Design](https://eyeondesign.aiga.org/anti-grid-icon-david-carson-on-why-computers-make-you-lazy-and-indie-mag-design-needs-to-liven-up/))*
3. **Basic decisions, not tricks.** "It's about font choice, cropping and basic, often intuitive design decisions" — "very few software tricks, or even color." *(sourced — [designboom 2013](https://www.designboom.com/design/interview-with-graphic-designer-david-carson-09-22-2013/))*
4. **Many ideas at once, getting progressively more experimental.** *(sourced — designboom 2013)*
5. **Found matter.** Torn bits of posters from cities he visits, street litter, cardboard, his own phone photos and old screen prints. *(sourced — AIGA; [Wallpaper\*](https://www.wallpaper.com/art/david-carson-macallan-whisky-concept-no-3))*
6. **Arrange loose, photograph, glue last.** Pieces are moved around on the floor "with many tweaks, until I am happy", photographed with a phone — which gives "depth and texture, even shadows, that a scanner wouldn't do" — and glued to the board as "the very last process". *(sourced — Wallpaper\*)*
7. **Keep the relevant accident.** Things that fell on the floor, a printer that "messed up" — picked up and scanned in, *if* they're relevant, not just weird. *(sourced — interview snippets, [Shane de Lange](https://shanedelange.medium.com/the-evolution-of-graphic-design-craft-an-interview-with-david-carson-e0094c736e52), [Adam Banks](https://medium.com/@adambanksdotcom/an-interview-with-david-carson-b4daa3df624c))*

"Don't mistake legibility for communication." *(sourced — [TED 2003, Design and Discovery](https://www.ted.com/talks/david_carson_design_and_discovery))*

---

## 2. Collage

| What he does | Status | In the app |
|---|---|---|
| Tears found paper — posters, receipts, tickets, cardboard *(sourced)* | **Built** | **Found paper** (Assets tab / ⌘K "Paste …"): receipt, security envelope, carbon invoice, kraft, newsprint, graph paper, ticket, masking tape, black paper, poster fragment. Painted procedurally and seeded, already torn, with a pale fibrous core along the rip. `src/lib/foundPaper.ts` |
| Tears his own scans and prints *(sourced, inferred for the edge detail)* | **Built** | **Tear edges** on any layer (Mask menu / ⌘K): a ripped clip, re-rollable. `tornEdgeClip` in `src/lib/weave.ts` |
| Type behind, between and over the scraps *(sourced, secondary)* | **Built** | **Weave through**: the biggest word in a selection goes over one scrap and under the next, cut on each scrap's real (torn) outline, living in the word's mask. `src/lib/weave.ts` |
| Photographs the loose arrangement for real shadows and depth *(sourced)* | **Built** | **Photograph the collage**: one light; each scrap's shadow distance, softness and density follow how many sheets it lies on, plus seeded curl. Ink casts nothing. Live drop-shadow styles. `src/lib/collageLight.ts` |
| Cut-and-tape tiled printouts (the Beach Culture "Mixed Messages" title, printed over 4 sheets) *(sourced)* | Gap | Tiled-print enlarger: split a layer across N "printer pages" with seams, overlaps and slight misalignment. |
| Masking tape holding pieces down *(inferred)* | Partly | Masking tape paper exists; tape doesn't yet snap across the edge of two scraps. |

## 3. Copier and scanner — the Copy Machine

Carson met the copier at the Rapperswil workshop with Hans-Rudolf Lutz: "using copy machines, and blowing things up, and cutting up pictures". *(sourced)* The specific mechanics below are **inferred** — the standard toner-copier behaviours of the period that match the look of the work — so the engine models the *physics*, not a Carson recipe.

| Physical cause | Control | Model (`src/lib/copyMachine.ts`) |
|---|---|---|
| Toner spreads from every mark (dot gain); thin lines thicken, counters fill | **Contrast** | dilate + soften ink, then a copier curve |
| Photo mode prints midtones as dots | **Contrast** | 45° clustered halftone screen modulates the threshold |
| Loose toner on the paper, pinholes in the blacks, ragged edges, uneven solids | **Grain** | sparse specks / pinholes, threshold noise, low mottle |
| Original moved while the bar ran | **Drag**, **Scan angle** | scan drift: each scanline gets a growing offset (stretch / shear), smeared while the hand moves |
| Paper and drum slip | **Wobble**, **Tear** | seeded displacement field |
| Toner starvation | **Bands** | stripes across the direction of travel |
| Dirt on the glass, a scratched drum | **Streaks** | lines along the direction of travel, printing or dropping out |
| Toner dropout | **Voids** | irregular soft blobs |
| Lid left open | **Lid edge** | black creeping in from the frame |
| Copy of a copy, enlarged or reduced each time | **Generations**, **Copy size** | resample about the centre, soften, re-tone — forms erode and thicken |
| Misregistered second pass | **Ghost**, **Ghost offset** | tonal-only echo companion |

An opaque source (a photo, a scrap) copies as a white sheet laid over what's below; a transparent layer (type) copies as toner only and overprints.

Gaps, in order of value:
1. **Printer-error generator** — skipped lines, misfeed shift, a band of repeated scanlines (the "printer messed up" accident he scans in).
2. **Phone-photo look for the whole board** — slight perspective, light falloff, warm white balance over the lit collage.
3. **Fax / low-res** — 1-bit at a coarse dpi with run-length artefacts.

## 4. Type

Documented: the Bryan Ferry interview set entirely in Zapf Dingbats, with a legible reprint at the back *(sourced — [Ray Gun](https://en.wikipedia.org/wiki/Ray_Gun_(magazine)), [Eye](https://eyemagazine.com/review/article/who-cares-if-you-read))*; lines of type that "bashed into each other", light-on-dark and dark-on-dark, stories read across the gutter, inconsistent mastheads ("rAY GUn, RAYGUN") *(sourced — [Joe Clark](https://joeclark.org/design/davidcarson.html))*; irregular columns pushing off the page *(sourced — EBSCO)*. Extreme tracking, negative leading, type cut into strips and giant cropped letters are **inferred** from the work.

Already in the app: glyph break, type strips, slice, misprint, stretch/skew, negative leading, rotated columns. Gaps: **letter break into bars** (a glyph split into its strokes and pulled apart, like the "h" and "y" in the reference poster), **per-letter case/font mixing**, **dingbat swap** that keeps the real text and an optional legible reprint.

## 5. Colour

"Very few software tricks, or even color." *(sourced)* Recent collages mix phone photos with his old screen prints. *(sourced)* Muted paper tones, black, and a red or blue accent is **inferred**. The found-paper palette keeps to that range on purpose.

---

## 6. Working the method in the app

1. Read the text. Pick one word that carries it.
2. Paste five to ten **found papers**; move them by hand until it's right — no grid.
3. Set the word huge, rotate it, let it run off the page.
4. Select the word and the scraps: **Weave through**. Weave again to swap over/under; paint the mask to pull a single letter forward.
5. Put small type through the **Copy Machine** — two generations, some drag.
6. **Photograph the collage** to light the board. Re-light until the shadows feel like a window.
7. Fork variations (⌘B) and push each one further than the last.
