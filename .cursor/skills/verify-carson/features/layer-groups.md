# Layer groups

Group combines two or more selected layers into a nested Layers row. Ungroup restores the children as top-level layers.

## Sub-features

- `group-select` enables Group after a two-layer shift-click.
- `group-create` nests the children under a `Group` row.
- `group-ungroup` returns `Oversized headline` as a top-level row.

## How to get to it (user POV)

- Choose tab `Layers`, shift-click two layer rows, then `Group`.
- Press `Cmd+G` with two layers selected and focus outside a text field.
- Choose `Ungroup` or press `Cmd+Shift+G` with a group selected.

## Driving it with verify-carson

Preconditions:

- Doctor reports the expected URL and this run's pid.
- Seed layers are ungrouped.
- Bare `G` is not pressed. That toggles the layout grid.

- **Select two layers.** Choose `Oversized headline`, then shift-click `Red interruption`. Run `node .cursor/skills/verify-carson/scripts/drive.mjs --feature layer-groups`. The `Group` button is enabled.
- **Group.** Choose `Group`. A layer row matching `Group group` appears. Nested `Red interruption` and `Oversized headline` rows remain under it.
- **Ungroup.** Choose `Ungroup`. The `Group group` row is gone. `Oversized headline` is a top-level row again.
- **Proof.** `artifacts/layer-groups/grouped.png` shows the group row. `ungrouped.png` shows the children restored.

## Gotchas

- `G` without Cmd toggles the column grid. Use the Group button or Cmd+G.
- Nested rows are not draggable. Reorder only top-level layers in this recipe.
- A component instance that is a group detaches on ungroup. Use seed layers that are not instances.
