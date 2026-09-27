# Brush

The Brush paints pressure-sensitive strokes onto a paint layer. The first stroke creates a `Paint` layer above the selection; later strokes land on the selected paint layer. The Eraser removes paint, and on any other layer it paints that layer's mask instead, so nothing is destroyed.

## Sub-features

- `brush-new-layer` creates a `Paint` layer on the first stroke.
- `brush-options` exposes Size, Hardness, Opacity, Flow, Smoothing, and pen-pressure toggles.
- `brush-eraser-paint` erases pixels on a paint layer.
- `brush-eraser-mask` masks a non-paint layer (text, image, shape) instead of erasing it.
- `brush-undo` undoes each stroke as one step; undoing the first stroke removes the layer.
- `brush-click-through` clicks on transparent parts of a paint layer select the art beneath.

## How to get to it (user POV)

- Choose `Brush tool` in the rail, then `Brush` or `Eraser`.
- Press `B` for the brush or `E` for the eraser; `[` and `]` change the size.

## Driving it with verify-carson

Preconditions:

- Doctor reports the expected URL and this run's pid.
- Seed poster is loaded. No `Paint` layer yet.

- **Paint.** Choose `Brush tool`, then `Brush`. Toolbar `Brush options` is visible. Drag across the canvas. Status reads `Painted on a new layer`.
- **Layers.** Open tab `Layers`. A row `Paint` exists.
- **Undo.** Choose `Undo`. Status reads `Undo: Painted on a new layer` and the `Paint` row is gone.

Command: `node .cursor/skills/verify-carson/scripts/drive.mjs --run-dir "$CARSON_VERIFY_RUN_DIR" --feature brush`

## Gotchas

- Single-key shortcuts are ignored while focus is in a text field; after dragging a Brush options slider focus returns to the page, but typing into a field keeps it.
- The brush overlay captures pointer input while the tool is active; choose `Move tool` before clicking layers on the canvas.
- Synthetic pointer events can't be captured; the overlay tolerates this, so pen-pressure checks can dispatch `PointerEvent`s with `pointerType: 'pen'`.
