# Carson — Reimagined
## Audit & Vision: The Most Accessible Professional Creative Tool Ever Made

*Prepared June 2026 · Based on full source audit of `src/App.tsx` (2,156 lines), `src/lib/editorModel.ts` (744 lines), live UI inspection, and research into David Carson's design philosophy.*

---

# 1. Executive Summary

**What Carson is today:** a local, single-screen poster editor built on React 19 + Fabric.js 7, wrapped in a bare WKWebView for macOS. It has one genuinely rare idea — *controlled chaos as a first-class feature* (Accident Engine, Xerox generations, Layer Decay, Expressive Type Lab) — buried inside a tool that lacks nearly every fundamental a working designer needs: zoom, keyboard shortcuts, non-destructive editing, real typography, color management, alignment, masking, vectors, professional export, and reliable persistence.

**The paradox:** Carson's *soul* is ahead of Photoshop, Figma, and Canva — none of them treat serendipity, texture, and expressive accident as core primitives. But its *body* is roughly 2% of a professional tool. Most current "effects" are one-shot, destructive rasterizations with hidden randomness: they delete the original object and replace it with a baked PNG. That is the exact opposite of how Carson himself worked — he kept cutting, recombining, and reacting to material. The current architecture makes reacting impossible; you get one roll of the dice and an undo button.

**The opportunity:** No tool on the market occupies the position "professional-grade *and* built for expressive experimentation." Photoshop is powerful but hostile to play (every experiment costs setup). Figma is collaborative but emotionally sterile — it optimizes for systems, not feeling. Canva is accessible but creatively ceiling-capped. Procreate is fluid but raster-only and solo. The white space is a tool where **precision and play are the same gesture** — where a designer can push a composition to the edge of chaos, pull it back, keep the good accident, and ship a print-ready PDF, all without leaving the app.

**Three findings drive everything below:**

1. **Architecture is destiny.** The destructive, snapshot-JSON architecture cannot support professional work or true experimentation. Moving to a non-destructive scene graph (objects + modifier stacks + seeded operations) is the single prerequisite for everything else. It is also *already half-built*: `editorModel.ts` is pure, deterministic (seeded `random` injection), and tested. The model layer is right; the application layer throws the model's determinism away.
2. **The chaos tools are the moat — but they need memory.** "Scatter" and "Bad crop" are fun once. They become professional instruments when they're parametric, re-rollable, previewable, and revertible: *chaos with a leash*.
3. **Accessibility is mostly absent, not mostly wrong.** There are no keyboard shortcuts at all — not even Cmd+Z. No zoom. No tooltips. Fixing the missing fundamentals is cheap and transformative; nothing has to be unlearned.

---

# 2. Product Vision Statement

> **Carson is the studio where precision and play are the same gesture.**
>
> It gives working designers the full power of professional image-making — typography, layout, color, masking, vector + raster, print-ready output, real-time collaboration — inside an interface a beginner can learn in an afternoon. And it gives everyone something no other tool has: a serendipity engine that treats accidents, texture, and emotional expression as professional instruments, not happy mistakes. You never leave Carson to finish a job, and you never feel like Carson finished the job *for* you.

**One-line positioning:** *Photoshop's power, Figma's fluency, Procreate's feel — and a point of view none of them have.*

**What Carson is not:** a template generator, a Canva clone, an AI poster vending machine, or a toy. Every feature must pass the test: *does this give a professional more control, or take it away?*

---

# 3. Core Design Principles (extracted from Carson's philosophy — not his style)

Research basis: Carson's Ray Gun/Beach Culture tenure, *The End of Print*, his TED talk, and the AIGA Medal citation. The principles below are reinterpretations for product design — deliberately *not* grunge aesthetics, torn paper, or illegible UI. The interface itself should be calm and legible; the *canvas* is where expression lives.

### P1 — Intuition before instruction
Carson came to design from surfing and sociology, with no formal training, and tripled Ray Gun's circulation. **Product translation:** every tool must be usable by instinct first (direct manipulation, visible results, forgiving defaults) and masterable by depth second (numeric precision, parameters, shortcuts). Never require a tutorial to make a first mark. The learning curve should be *discovered*, not assigned.

### P2 — Form is feeling
Carson refused to separate layout from emotion; typography was atmosphere, rhythm, tension. **Product translation:** the tool should let designers manipulate *emotional* dimensions directly — tension, density, rhythm, decay — not only geometric ones (x, y, w, h). Carson's existing sliders (Intensity, Generation, Amount) are embryonic versions of this. Lean in: make expressive parameters as precise and scriptable as coordinates.

### P3 — The accident is a material
Carson kept the misprints, the overlaps, the wrong fonts — and *curated* them. The skill was in the selection, not the randomness. **Product translation:** randomness must have memory and a leash. Every stochastic operation gets: a visible seed, a re-roll button, a live preview, variation thumbnails, and full reversibility. The designer is the editor of accidents, never their victim.

### P4 — Legibility is not communication (but it's a dial, not a dogma)
The famous Zapf Dingbats interview made a point: even rejection is a designed experience. **Product translation:** the tool never moralizes. No warnings that type is "too small" or contrast "fails" — instead, *informative instruments* (legibility meter, contrast readout, print-gamut preview) that report without judging. Professionals decide; the tool informs.

### P5 — Specific beats generic
Carson's work was responsive to subject, audience, and cultural moment — never a reusable formula. **Product translation:** anti-template by design. Instead of "5,000 templates," provide *starting energies* (compositional postures, type attitudes, texture moods) that are generative and parameterized, so two users never start from the same pixel. Assistance should push divergence, not convergence.

### P6 — Discovery through making
Carson worked by physically cutting, photocopying, recombining — fast, cheap iterations with real material. **Product translation:** exploration must be cheaper than deliberation. Branching variations, side-by-side comps, an "exploration trail" you can walk back through — make trying ten ideas faster than debating one.

### P7 — Personality over formula
"Design becomes memorable when it carries an attitude rather than a formula." **Product translation:** the product itself should have a voice (in copy, in defaults, in what it celebrates) and should surface *the user's own* emerging patterns back to them ("you keep reaching for compressed type and acid green — want that as a style?") rather than imposing house taste.

---

# 4. Comprehensive UX/UI Audit

## 4.1 Current strengths (genuine, worth protecting)

| Strength | Evidence | Why it matters |
|---|---|---|
| **A real point of view** | Accident Engine, Xerox/Print-Scan, Layer Decay, Expressive Type Lab, tear collage, scrape masks | No mainstream tool ships "controlled chaos" as a category. This is the moat. |
| **Pure, testable, deterministic model layer** | `editorModel.ts`: every generator accepts an injectable `random()`; unit tested | The foundation for seeded, re-rollable, non-destructive chaos already exists. |
| **Calm, legible chrome** | Light glass panels, low density, clear section grouping, focus-visible styles, aria-labels on regions/buttons | Correctly keeps the *interface* quiet so the *canvas* can be loud — the right reading of Carson (P4). |
| **Teaching by example** | Seeded demo poster ("RAY GUN / CUT TYPE", rotated side type, acid rule) | New users see what the tool is *for* in the first second. Better onboarding than most empty-canvas tools. |
| **Honest feedback loop** | Status line narrates every action ("Sliced into strips", "Applied xerox generation 5") | Embryonic action history; great bones for an exploration trail. |
| **Sensible export ergonomics** | Format/scale/background/quality controls, computed final dimensions shown on the button | Showing "Export 2480 × 3508" is better UX than Photoshop's export dialog. |
| **Expressive parameters as sliders** | Intensity, Legibility, Generation, Amount | Emotional dimensions exposed as controls — P2 in embryo. |

## 4.2 Weaknesses, friction, and flow-killers

### A. Destructive architecture (the root defect)
- `sliceSelected`, `applyXeroxToSelected`, `applyLayerDecayToSelected`, `distressSelected`, `aggressiveCropSelected`, `breakSelectedType`, `tearCollageSelected` all call `object.toDataURL()` → delete the original → insert baked PNG fragments. **Text becomes pixels permanently.** A client says "change the headline" after you've xeroxed it → start over.
- `applyImageEffect` *replaces* the whole filter array (`image.filters = effectMap[effect]`), so applying Contrast silently removes Grayscale. Effects can't be deliberately stacked; users will perceive it as a bug.
- `applyPosterStyle` mutates every object's position/angle/blend *relative to current state* with no preview; clicking twice compounds drift irreversibly.
- Hidden, unseeded randomness: the app calls model functions *without* passing `random`, so identical clicks give unrepeatable results. The model supports seeds; the app discards them. You cannot say "that scatter, but 10% gentler."

### B. Missing fundamentals (intimidating by absence)
- **No keyboard shortcuts whatsoever.** No Cmd+Z/Y, no Delete/Backspace, no arrow-key nudge, no Cmd+D duplicate, no Escape deselect. Confirmed: zero `keydown` listeners in the codebase. For any professional this is disqualifying on first contact.
- **No zoom or pan.** `displayScale = min(1, 660/w, 780/h)` — an A2 poster is edited at ~38% magnification, forever. Kerning a headline or placing a 2px rule is physically impossible. This is the single biggest flow-state killer.
- **No snapping, alignment, distribution, or smart guides.** The "Crop marks/grid" tool *paints decorative rectangles onto the artwork* — fake crop marks that export inside the image. Charming as texture; dangerous as the only "grid system."
- **No grouping, no lock, no hide.** Layers panel is select-only: no drag-reorder (only Front/Back extremes), no thumbnails, no multi-select, no rename inline.
- **No text editing on canvas** double-click works via Fabric, but all property editing lives in the inspector; no font preview in the dropdown; **8 system fonts total**, no upload, no Google Fonts, no variable fonts, no OpenType features, no text-on-path, no paragraph styles.
- **Color is a single hex `<input type=color>`.** No swatches, no document palette, no eyedropper, no gradients, no recently-used, disabled entirely for images. Blend dropdown exposes raw compositing jargon (`source-over`) to users.
- **Shapes = rectangles.** The "Block" tool is the entire vector vocabulary. No ellipse, line, polygon, pen tool, boolean ops, or strokes.

### C. Trust and persistence failures
- **localStorage-only saves, capped at 12 projects, deduped by name** — saving with an existing name silently overwrites. Embedded data-URL images will blow the ~5MB quota almost immediately and `setItem` will throw (uncaught). No autosave; closing the tab silently loses work. For a professional tool, data loss = death.
- History capped at 40 full-canvas JSON snapshots, rebuilt by `JSON.stringify` on every change — O(document size) per edit; will hitch visibly on image-heavy posters. History is lost on reload and wiped by project load.
- The export path mutates live canvas background then restores it — a crash mid-export corrupts state.
- Canvas hard-capped at 320–3000px (`clampDimension`); a 4× export of A2 is the practical ceiling. No PDF, no SVG, no CMYK, no bleed/trim, no real printer's marks. **Print poster tool that cannot produce a print-ready file.**

### D. Discoverability & comprehension debt
- Left rail = 9 stacked sections (~30 buttons) with no hierarchy of frequency: "Text" (used constantly) has equal weight with "Red dive type" (used never). Requires scrolling; no search.
- **Selection-scoped vs. canvas-scoped actions are visually identical.** "Photocopy noise" hits the whole poster; "Distress" hits the selection; nothing indicates which before you click.
- Icon reuse breaks signification: Scissors appears on 5 unrelated tools, Sparkles on 3, Layers on 4.
- **"Dive Poster Tools"** is a category named after one specific poster the author was recreating — meaningless to anyone else. "Cold image," "Red dive type" are private vocabulary.
- No tooltips, no descriptions, no preview-on-hover. The only way to learn what "Misprint offset" does is to fire it at your artwork.
- Status text is near-invisible (low-contrast gray on gray — confirmed visually) and is the *only* narration of what happened.

### E. Accessibility gaps
- No keyboard operability of the canvas at all (WCAG 2.1.1 failure for the core surface).
- Status updates not in an `aria-live` region — screen readers never hear "Sliced into strips."
- Muted text colors likely fail 4.5:1; sliders lack visible value increments; color is the only differentiator between layer kinds in some states.
- No reduced-motion consideration, no dark mode, no touch/stylus support (mouse-up-only slider commit ignores pen input quirks).

### F. Inherited patterns that should be challenged (and a few wrongly discarded)
- **Wrongly inherited:** the three-panel "Holy Grail" desktop layout with a *property sheet of 12 stacked sliders* — 1990s inspector design. Modern answer: contextual on-canvas controls + a small, searchable inspector.
- **Wrongly discarded:** zoom, shortcuts, snapping — these are not "old software baggage," they are the muscle-memory contract of the entire profession.
- **Half-right:** one-click "poster styles" (Magazine chaos, etc.) have the right spirit (compositional energies, P5) but the wrong mechanics (irreversible global mutation, no preview, compounding drift).

---

# 5. Strengths & Weaknesses Summary

**Keep and amplify:** the chaos/texture/expressive-type concept; the pure deterministic model layer; the calm chrome; the example-first canvas; expressive sliders; visible export dimensions.

**Fix urgently:** destructive operations; no shortcuts; no zoom; persistence fragility; selection-scope ambiguity; status invisibility.

**Build (missing for professional work):** real typography, color systems, vector tools, masking, components/styles, grids, multi-artboard, print export, color management, collaboration, asset libraries, AI assistance.

**Kill or rework:** "Dive Poster Tools" as a category (generalize into Texture/Treatment instruments); fake crop marks as the grid story; name-keyed silent save overwrite; raw blend-mode jargon.

---

# 6. Feature Gap Analysis for Professional Graphic Design

Verdict per capability — **Missing / Partial / Present** — with the standard a working designer expects:

| Capability | Status | Gap detail |
|---|---|---|
| **Advanced typography** | Partial (≈15%) | Has size/spacing/line-height/skew on 8 system fonts. Missing: font management (upload, Google/Adobe fonts, variable axes), OpenType features, kerning pairs, baseline shift per-character styling, text-on-path, text wrap, hyphenation/justification engine. |
| **Editorial / text layout** | Missing | No multi-column text, linked text frames, paragraph/character styles, baseline grids, master pages, or spreads. Cannot lay out a magazine page. |
| **Layer management** | Partial (≈20%) | Flat list, select + front/back only. Missing: drag-reorder, groups, nesting, lock, hide, thumbnails, search/filter, multi-select, color labels. |
| **Non-destructive workflows** | Missing (critical) | Nearly all signature effects rasterize and replace. No adjustment layers, no effect stacks, no editable parameters after apply, no smart-object equivalent. |
| **Vector ↔ raster interop** | Missing | Rect-only vectors; text destructively rasterized by effects; no pen tool, no booleans, no vectorization, no live filters on vectors. |
| **Poster & print design** | Partial (≈25%) | Presets are pixel-based (A3 = 1240px ≈ 106 DPI — *below* print resolution at that size). No DPI concept, no bleed/trim/safe zones, no real crop marks, 3000px canvas cap. |
| **Grid systems & alignment** | Missing | No snapping, guides, margins, columns, distribute, or align. Decorative grid only. |
| **Blend modes & masking** | Partial (≈25%) | 6 of ~16 composite modes; no layer masks, clipping masks, alpha masks, or vector masks (scrape "masks" are opaque rectangles painted on top). |
| **Smart objects / components** | Missing | No instances, no shared symbols, no nested compositions. |
| **Asset libraries & styles** | Missing | "Assets" panel is a text list of uploaded filenames — not even re-insertable. No color/text/effect styles, no team libraries. |
| **High-res & print-ready export** | Missing | PNG/JPG only, RGB only, ≤4× of a ≤3000px canvas. No PDF/X, no TIFF, no SVG, no CMYK, no ICC profiles. |
| **Color management** | Missing | No working space, no profiles, no gamut warning, no CMYK preview, no spot colors. |
| **Professional export formats** | Missing | See above; also no slices/multi-asset export, no export presets per destination. |
| **Collaboration & feedback** | Missing | Single-user, single-device, localStorage. No cloud docs, sharing, comments, or multiplayer. |
| **AI-assisted production** | Missing | None. (An honest zero — better than a bolted-on generator.) |

**Bottom line:** today Carson supports *one* real-world deliverable — a low-res RGB poster image for screens — and only if the client never requests revisions to anything that's been "treated." The signature features are demo-grade sparks of a category-defining product.

---

# 7. What "Better than Photoshop" Means — Dimension by Dimension

| Dimension | Photoshop's failure | Carson's bar |
|---|---|---|
| **Ease of learning** | 40 years of accreted UI; "how do I crop a layer" is a YouTube genre | First mark in 10 seconds; first finished poster in 10 minutes; advanced depth revealed progressively by use, not by menus |
| **Workflow efficiency** | Modal dialogs, destructive defaults, save-as anxiety | Everything live-previewed, everything reversible, autosaved cloud docs, command palette for every action |
| **Creative freedom** | Experiments are expensive (duplicate file, snapshot, pray) | Branching variations are one keystroke; chaos instruments with seeds; exploration is cheaper than deliberation (P6) |
| **Accessibility & inclusivity** | Keyboard-hostile canvas, poor SR support, pro-jargon everywhere | Full keyboard operability, aria-live narration, plain-language labels with pro terms on hover, dyslexia-friendly option, touch/stylus parity |
| **Performance** | Multi-GB installs, scratch disks, launch time | Instant load, 60fps canvas at 10k×10k via WebGPU tiles, works offline |
| **Collaboration** | Files emailed as `final_v3_FINAL2.psd` | Figma-grade multiplayer + comments + versioned branches |
| **Cross-device** | Desktop monolith + diverging iPad app | One document, every device, stylus-first on tablet |
| **AI-enhanced creativity** | Generative fill = outsourced decisions | AI as studio assistant: masks, cutouts, variations, cleanup — designer keeps every decision (see §9) |
| **Discoverability** | 600 commands hidden in menus | Searchable command palette, hover-previews, "what just happened" trail, contextual tool surfacing |
| **Cognitive load** | Everything visible always; 30 panels | One calm surface; tools appear when relevant; selection-scope always explicit |
| **Delight** | Professional anxiety | Play that produces production work; the tool celebrates good accidents |

---

# 8. Prioritized Roadmap

Format per item: **Problem → Vision alignment → Impact → Complexity → Priority.**

## Horizon 1 — Immediate (1–2 weeks): make the existing tool trustworthy and fluent

**1.1 Full keyboard layer** — Cmd+Z/Shift+Z, Delete, arrows (1px) + Shift-arrows (10px), Cmd+D duplicate, Cmd+G *(reserve)*, Escape, V/T/R tool keys, Cmd+S save, Cmd+E export.
*Problem:* zero shortcuts; pros disqualify the tool in 30 seconds. *Vision:* intuition includes muscle memory (P1). *Impact:* every user, every minute. *Complexity:* **Low.** *Priority:* **Critical.**

**1.2 Zoom & pan** — pinch/Cmd+scroll zoom 10–800%, space-drag pan, Cmd+0 fit / Cmd+1 100%. Fabric supports viewport transforms natively.
*Problem:* A2 posters editable only at ~38%; precision impossible. *Vision:* "seamlessly between precision and play" requires being able to *see*. *Impact:* unblocks all detail work. *Complexity:* **Low–Medium.** *Priority:* **Critical.**

**1.3 Persistence you can trust** — debounced autosave to IndexedDB (not localStorage), explicit "overwrite?" on name collision, store images as Blobs, quota-failure toast, crash-safe export.
*Problem:* silent overwrite + ~5MB quota + no autosave = guaranteed data loss. *Impact:* table stakes for trust. *Complexity:* **Low–Medium.** *Priority:* **Critical.**

**1.4 Seed + re-roll on every chaos tool** — surface the seed the model layer already supports; each stochastic action gets ↻ re-roll and an undoable preview; show "Scatter #4719" in the trail.
*Problem:* hidden randomness, one roll of the dice. *Vision:* P3 — the accident is a material; the designer curates. *Impact:* converts gimmicks into instruments; the differentiating feature becomes usable. *Complexity:* **Low** (model is already deterministic). *Priority:* **Critical.**

**1.5 Selection-scope clarity** — badge every action button: ▣ "selection" vs ⬚ "canvas"; disable + tooltip when scope unmet; hover highlights what will be affected.
*Problem:* identical buttons hit selection or whole poster unpredictably. *Impact:* removes the #1 source of "what just happened?!" *Complexity:* **Low.** *Priority:* **Critical.**

**1.6 Layers panel v1.5** — drag-reorder, hide/lock toggles, thumbnails, inline rename, multi-select with Shift/Cmd.
*Problem:* select-only list; Front/Back are the only ordering moves. *Impact:* basic compositional control. *Complexity:* **Medium.** *Priority:* **Critical.**

**1.7 Accessibility pass** — `aria-live="polite"` status region; raise status/muted text to ≥4.5:1; full tab-order audit; visible focus on canvas objects (outline the selection for keyboard users); honor `prefers-reduced-motion`.
*Problem:* SRs hear nothing; status is invisible to everyone. *Impact:* inclusivity + the status trail becomes useful for all. *Complexity:* **Low.** *Priority:* **Important.**

**1.8 Naming & tooltip sweep** — kill "Dive Poster Tools" (fold into "Texture" and "Treatments"); plain-language blend modes ("Normal," not "source-over"); every button gets a one-line tooltip describing effect + scope; distinct icons per tool family.
*Impact:* discoverability without redesign. *Complexity:* **Low.** *Priority:* **Important.**

**1.9 Snapping v1** — canvas edges, centers, and object-to-object smart guides (Fabric `aligning_guidelines` pattern); hold Cmd to suspend snapping *(precision and play in one gesture)*.
*Complexity:* **Medium.** *Priority:* **Important.**

**1.10 Quick wins for delight** — font dropdown renders each name in its own face; eyedropper (EyeDropper API); recently-used color swatches; double-click layer row to zoom-to-layer.
*Complexity:* **Low.** *Priority:* **Nice-to-have.**

## Horizon 2 — Mid-term (1–3 months): become a professional instrument

**2.1 Non-destructive core (the big one)** — replace bake-and-replace with a scene graph: every object carries a **treatment stack** (Xerox gen 5 → Decay 40 → Scatter seed 4719…), rendered live, editable/reorderable/removable forever; text stays text under every treatment. Migrate history from JSON snapshots to operation log (fixes performance and enables infinite undo + named checkpoints).
*Problem:* the root defect (§4.2-A). *Vision:* P3 and P6 are impossible without it; "professional capability" is impossible without it. *Impact:* transforms the product's ceiling; enables client revisions, variations, components, collaboration. *Complexity:* **High.** *Priority:* **Critical.**

**2.2 Real typography** — font upload + Google Fonts + variable-font axes (a *slider on weight/width* is profoundly Carson: stretch and compress as expression); OpenType features; per-character styling; text-on-path; styles (character/paragraph) as reusable assets.
*Impact:* unlocks editorial, branding, type-driven posters — the heart of the target work. *Complexity:* **High.** *Priority:* **Critical.**

**2.3 Vector vocabulary** — ellipse/line/polygon/star, pen tool with bezier editing, boolean ops, strokes with dash control; everything accepts the same treatment stacks as text/images (vector ↔ raster interop by architecture, not conversion).
*Complexity:* **Medium–High.** *Priority:* **Critical.**

**2.4 Color system** — document palette, saved swatches, gradients (linear/radial), full blend-mode set with live hover preview, contrast readout *(an instrument, not a warning — P4)*.
*Complexity:* **Medium.** *Priority:* **Critical.**

**2.5 Masking** — clipping masks (clip layer to shape/text), alpha masks painted with a soft brush, "scrape" reimagined as a real eraser-mask instrument (its current spirit, made non-destructive).
*Complexity:* **Medium–High.** *Priority:* **Critical.**

**2.6 Print pipeline v1** — document DPI; presets in real units (A3 at 300dpi); bleed/trim/safe-area as *document chrome* (never baked into artwork); PDF export with true printer's marks; TIFF; soft-proof CMYK preview with gamut hinting; remove the 3000px cap via tiled rendering.
*Problem:* a poster tool that can't print. *Impact:* "concept → print-ready without switching apps" becomes literally true. *Complexity:* **High.** *Priority:* **Critical.**

**2.7 Grid & layout systems** — column/baseline grids as overlays, margins, align/distribute toolbar, "broken grid" mode: define the grid, then *violate it deliberately* — snap-to-grid and scatter-off-grid as two ends of one Tension slider. The most Carson feature in the roadmap: structure exists to be played against (P2/P5).
*Complexity:* **Medium.** *Priority:* **Important.**

**2.8 Components & asset library** — turn any group into a reusable component with overrides; asset panel becomes visual (thumbnails, drag-to-canvas, reusable images/styles/treatment-stacks). Treatment stacks as shareable assets = "brushes" for chaos.
*Complexity:* **Medium–High.** *Priority:* **Important.**

**2.9 Information architecture redesign** — three-zone model: minimal persistent toolbar (6 tools); contextual on-canvas controls for the selection (type controls appear *at* the text); a single right panel with tabs (Inspect / Treatments / Layers / Assets) + Cmd+K command palette searching every action ("xerox", "make it grungier", "export A3 PDF").
*Problem:* 9-section scroll-rail with flat hierarchy. *Impact:* halves time-to-tool; makes 10× more features fit without 10× clutter. *Complexity:* **Medium.** *Priority:* **Important.**

**2.10 Onboarding as play** — replace nothing with a 90-second "wreck this poster" interactive intro: give users a finished boring poster and teach by inviting destruction (scatter it, xerox it, re-roll it, undo it). Teaches the moat features *and* reversibility in one move.
*Complexity:* **Low–Medium.** *Priority:* **Important.**

**2.11 Variations / branching comps** — Cmd+B forks the current state into a side-by-side variant; gallery view to compare/merge; exploration trail (visual history with thumbnails) replaces the status line.
*Vision:* P6 made structural. *Impact:* the deliberation→exploration flip; also the foundation for client presentation. *Complexity:* **Medium–High.** *Priority:* **Important.**

**2.12 Multi-artboard** — several artboards per document (poster + IG post + story); per-artboard export presets; sizes in real units.
*Complexity:* **Medium.** *Priority:* **Important.**

## Horizon 3 — Long-term (3–12+ months): define the category

**3.1 Cloud documents + real-time collaboration** — CRDT-based multiplayer (operation-log architecture from 2.1 is the prerequisite), share links, comments pinned to layers, version history with named milestones, role-based view (client sees comps gallery, not the editor).
*Impact:* the "Figma of image editing" claim becomes real; teams adopt, not just individuals. *Complexity:* **High.** *Priority:* **Critical** (sequenced after 2.1).

**3.2 The Serendipity Engine (flagship)** — unify Accident/Xerox/Decay/Type Lab into one system: **Instruments** (named chaos operators with parameters + seeds) playable on anything, recordable into **Gestures** (macro chains: "slice → scatter 30% → xerox 3"), shareable as assets, and modulatable document-wide by a single **Tension** dial that scales every instrument's intensity. Add **"Press Check"** mode: simulate ink spread, misregistration, and paper texture as a live, non-destructive *document* treatment with print-faithful export.
*Vision:* P2+P3+P7 as architecture. *Impact:* the feature nobody can copy without rebuilding their engine; the reason designers say "you can only make this in Carson." *Complexity:* **High.** *Priority:* **Critical** (it *is* the differentiation).

**3.3 AI as studio assistant (never autonomous creator)** — strict covenant: AI executes and proposes; the designer decides and directs. Concretely:
- *Production acceleration:* one-click subject masking/background removal (outputs an **editable mask**, not a flattened cutout); content-aware cleanup; auto-vectorize; upscale for print.
- *Exploration acceleration:* "Riff" — generate 6 *layout* variations of the user's own composition (re-arrangements of their elements, never new imagery), each fully editable and seeded; type pairing suggestions from the user's own historical taste.
- *Technical barrier removal:* natural-language command palette ("make this feel more 1994", "prep this for newsprint") that maps to *visible, adjustable* parameter changes — the user watches the sliders move and can grab them.
- *Taste mirror (P7):* on request, surface the user's recurring moves as draft personal styles.
- Hard lines: no prompt-to-poster generation, no AI compositions presented as finished work, every AI action undoable and inspectable in the trail.
*Complexity:* **High.** *Priority:* **Important→Critical** by 12 months.

**3.4 Cross-device** — tablet app with stylus-first treatment painting (paint decay *where you want it* with pressure — Procreate-feel on the chaos instruments); same cloud doc everywhere; phone app for review/comments.
*Complexity:* **High.** *Priority:* **Important.**

**3.5 Performance re-platform** — WebGPU tiled renderer for 10k×10k canvases at 60fps; workers for filter stacks; the 3000px cap and JSON-snapshot hitching die here permanently. (Begin spiking during Horizon 2.)
*Complexity:* **High.** *Priority:* **Critical** for the pro claim.

**3.6 Community & marketplace** — share Instruments, Gestures, treatment stacks, and starting-energy "Postures" (not templates: parameterized compositional attitudes that render differently for every user — P5's anti-template economy).
*Complexity:* **Medium–High.** *Priority:* **Nice-to-have→Important** once 3.2 lands.

**3.7 Native shell maturity** — the WKWebView wrapper gains a real menu bar, file associations (.carson), native save/open dialogs, Quick Look previews, and offline-first cloud sync.
*Complexity:* **Medium.** *Priority:* **Important.**

---

# 9. Specific UI & Interaction Recommendations

1. **Three-zone shell:** slim left toolbar (Move, Text, Shape, Image, Mask, Instruments — six items); contextual controls floating *at the selection* on canvas; one tabbed right panel. Everything else behind Cmd+K.
2. **Treatment stack UI:** selected object shows its stack as horizontal chips above the inspector (`Xerox·5 → Decay·40 → Scatter·#4719`); click a chip to edit parameters; drag to reorder; toggle eye to bypass; right-click → "save stack as asset."
3. **Re-roll affordance:** every stochastic chip carries a dice icon; click = new seed with live preview; long-press = scrub through seeds like a filmstrip. Seeds visible and copy-able — "controlled chaos" literally.
4. **The Tension dial:** one prominent rotary control (header, right of center) scaling all instrument intensities document-wide from *Composed* → *Restless*. Drag it while watching the poster breathe. This is the product's signature control — the emotional master fader (P2).
5. **Exploration trail:** replace the status line with a horizontal thumbnail filmstrip (collapsible) along the bottom — every meaningful state, clickable to jump back, fork-able into a variation. Undo becomes *spatial and visual*.
6. **Scope preview:** hovering any action button ghosts its effect on the canvas at 40% opacity for 200ms (cheap to do for deterministic ops once seeds are fixed). Nothing fires blind.
7. **Hold-Cmd to break snap; hold-Shift to constrain:** the precision↔play toggle lives in the modifier keys, the same physical gesture every designer already knows.
8. **Legibility meter, not legibility police:** small live readout on selected text (estimated reading effort: Clear / Working / Resistant) — Carson's spectrum as an instrument, never a warning dialog (P4).
9. **Plain language + pro vocabulary:** primary labels human ("Multiply" not "source-over"; "Make a copy with print drift" on hover for "Misprint offset"); pro terms shown as secondary text so beginners *acquire* the vocabulary.
10. **Canvas keyboard operability:** Tab cycles objects, arrows nudge, Enter enters text-edit, Cmd+arrow reorders z-index — full parity with mouse, announced via aria-live.

---

# 10. Differentiating Concepts (vs. Photoshop, Canva, Figma)

| Concept | Why no competitor has it |
|---|---|
| **Instruments & Gestures** (parametric, seeded, replayable chaos operators) | Photoshop's filters are static math; Figma has no concept of expressive randomness; Canva's effects are decorative stickers. Carson's are *performances* — recordable, shareable, tweakable. |
| **The Tension dial** (document-wide emotional master fader) | No tool exposes a global expressive parameter. It reframes the product in one control: this is software with a point of view about *feeling*. |
| **Anti-template "Postures"** (generative starting energies, never identical twice) | Directly attacks Canva's sameness problem; aligned with P5. A posture is a parameterized attitude — "oversized confrontational type," "quiet editorial drift" — instantiated uniquely per user, per seed. |
| **Press Check** (live physical-print simulation as a document treatment) | Photoshop soft-proofs color; nobody soft-proofs *materiality* — ink spread, misregistration, paper tooth — and lets you keep it as the look, exporting print-faithfully. Born from Carson's existing Xerox/decay DNA. |
| **Exploration trail + branching comps** | Photoshop's history dies on close; Figma's version history is administrative. Making exploration *visible, spatial, and fork-able* changes how people design, not just how they save. |
| **Broken-grid system** (structure and violation as one continuum) | Every tool does grids; none treats deliberate grid violation as a supported, parameterized practice. Pure P2: tension between order and chaos as a slider. |
| **AI taste mirror** | Every competitor's AI imposes a model's taste. Carson's reflects *the user's own* emerging style back as draft assets — amplifying personality instead of averaging it away (P7). |

---

# 11. What This Product Becomes If Executed Exceptionally Well

Eighteen months from now, Carson is the tool designers open *first* — not because it replaced Photoshop feature-for-feature, but because the distance between "I have a feeling" and "I have a comp" collapsed to minutes, and the distance between "I have a comp" and "it's at the printer" collapsed to one export dialog.

A junior designer learns it in an afternoon and ships real client work the same week, because nothing in the interface punishes ignorance — every action previews, every accident reverses, every advanced capability surfaces exactly when reached for. A senior art director keeps it open all day, because the Instruments produce textures and compositions that are demonstrably impossible elsewhere, and because handing a client a comps-gallery link with three seeded variations beats emailing flattened JPEGs forever. A studio adopts it because four people can be inside the same album cover at once — one kerning the type at 400%, one painting decay with a stylus on an iPad, one adjusting the Tension dial, one leaving comments — and the file that goes to press is the file they played in.

The deepest win is cultural. Photoshop taught a generation that professional meant *careful*. Figma taught a generation that design meant *systems*. Carson teaches the next generation what David Carson taught his: that the work communicates when it *feels* — and that feeling is not the opposite of craft, it's the point of it. The tool's defining achievement won't be any single feature; it will be that "made in Carson" becomes a recognizable quality in the wild — work with texture, attitude, and evidence of a human hand — produced at professional speed, to professional standards, by people who were never told they weren't allowed to play.

The objective was never another image editor. It's the studio where precision and play are the same gesture — and where the accident, finally, has a home in production software.

---

*Appendix — code-level fixes worth filing immediately regardless of roadmap: (1) `applyImageEffect` replaces the filter array instead of composing — stacked effects silently vanish; (2) double history commit on mount (`seedPoster` + poster-size effect); (3) name-keyed save silently overwrites in `saveProject`; (4) `localStorage.setItem` quota errors uncaught; (5) export mutates live canvas background non-atomically; (6) `applyPosterStyle` compounds drift on repeat clicks; (7) model-layer `random` parameter never passed from App — determinism discarded at the call site.*
