# Carson Lab

A local browser-based poster editor for making messy, manual, David Carson-inspired compositions.

## Run

```bash
npm install
npm run dev
```

Open the local URL Vite prints.

## Features

- Manual canvas editor with text, image, shape, and fragment layers
- Move, resize, rotate, duplicate, delete, and reorder layers
- Slice selected layers into strips or columns
- Scatter selected layers for controlled layout accidents
- Letter break: cut each glyph into its strokes and pull them apart — vector, editable, weave-aware
- Weave a word through collage scraps — over one, under the next, cut along each scrap's edge
- Tear the edges of any layer so a scan becomes a pasted paper scrap
- Found paper: receipts, envelopes, carbon invoices, kraft, newsprint, tickets, tape — pasted already torn
- Real materials: crumple the whole sheet (lit folds and wrinkles), clear packing tape, translucent masking tape, peeled-paper scars
- Photograph the collage: one light, each scrap's shadow set by how many sheets it lies on
- Copy Machine: a physical toner copier — dot gain, halftone, scan drift, streaks, lid edge, copy-of-a-copy generations
- Typography controls for font, size, spacing, line height, skew, stretch, color, opacity, and blend mode
- Local image upload with grayscale, contrast, threshold, blur, and noise effects
- Poster presets plus custom size
- Local save/load
- PNG export
- Undo/redo

See [docs/CARSON-METHOD.md](docs/CARSON-METHOD.md) for how David Carson works and how the tools map to it.

## Checks

```bash
npm test
npm run build
npm run lint
```
