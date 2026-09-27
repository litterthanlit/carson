/** Minimal shape of a flattened layer row (see flattenLayerTree). */
export type LayerTreeRow = {
  id: string
  parentId?: string | null
}

/** Ids of rows that have at least one child row, i.e. expandable groups. */
export function groupIdsWithChildren(rows: LayerTreeRow[]): Set<string> {
  const ids = new Set<string>()
  for (const row of rows) {
    if (row.parentId) ids.add(row.parentId)
  }
  return ids
}

/**
 * Groups the user collapsed, minus any group that contains a selected layer:
 * selecting a nested layer (e.g. on the canvas) reveals it, as in Photoshop.
 */
export function effectiveCollapsedIds(
  rows: LayerTreeRow[],
  collapsedIds: ReadonlySet<string>,
  selectedIds: Iterable<string>,
): Set<string> {
  const effective = new Set(collapsedIds)
  if (effective.size === 0) return effective
  const parentOf = new Map(rows.map((row) => [row.id, row.parentId ?? null]))
  for (const id of selectedIds) {
    let parent = parentOf.get(id) ?? null
    while (parent) {
      effective.delete(parent)
      parent = parentOf.get(parent) ?? null
    }
  }
  return effective
}

/** Rows to render: drops every row that sits under a collapsed ancestor. */
export function visibleLayerRows<T extends LayerTreeRow>(rows: T[], collapsedIds: ReadonlySet<string>): T[] {
  if (collapsedIds.size === 0) return rows
  const parentOf = new Map(rows.map((row) => [row.id, row.parentId ?? null]))
  const hidden = (row: T) => {
    let parent = row.parentId ?? null
    while (parent) {
      if (collapsedIds.has(parent)) return true
      parent = parentOf.get(parent) ?? null
    }
    return false
  }
  return rows.filter((row) => !hidden(row))
}
