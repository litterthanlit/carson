/**
 * Operation-log history — lightweight ops with periodic full snapshots (Horizon 2.1).
 */
export type HistoryOp =
  | { id?: string; type: 'snapshot'; label: string; data: string }
  | { id?: string; type: 'treatment'; label: string; objectId: string; before: string; after: string }
  | { id?: string; type: 'posterTreatment'; label: string; artboardId: string; before: string; after: string }
  | { id?: string; type: 'objectPatch'; label: string; objectId: string; before: string; after: string }
  | { id?: string; type: 'layerOrder'; label: string; before: string; after: string }

export type HistoryState = {
  ops: HistoryOp[]
  cursor: number
}

export type HistoryRestoreAction =
  | { kind: 'snapshot'; data: string; label: string }
  | { kind: 'treatment'; objectId: string; treatmentsJson: string; label: string }
  | { kind: 'posterTreatment'; artboardId: string; treatmentsJson: string; label: string }
  | { kind: 'objectPatch'; objectId: string; patchJson: string; label: string }
  | { kind: 'layerOrder'; orderJson: string; label: string }
  | null

const MAX_OPS = 200
const SNAPSHOT_EVERY = 20

export function createHistoryState(): HistoryState {
  return { ops: [], cursor: -1 }
}

export function newHistoryOpId(): string {
  return `hop-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export function pushHistoryOp(state: HistoryState, op: HistoryOp): HistoryState {
  const nextOp: HistoryOp = { ...op, id: op.id ?? newHistoryOpId() }
  const trimmed = state.ops.slice(0, state.cursor + 1)
  const next = [...trimmed, nextOp].slice(-MAX_OPS)
  return { ops: next, cursor: next.length - 1 }
}

export function indexOfOp(state: HistoryState, opId: string): number {
  return state.ops.findIndex((op) => op.id === opId)
}

export function nearestSnapshotIndex(state: HistoryState, atCursor: number): number {
  const start = Math.min(atCursor, state.ops.length - 1)
  for (let index = start; index >= 0; index -= 1) {
    if (state.ops[index]?.type === 'snapshot') return index
  }
  return -1
}

export function jumpRestoreActions(state: HistoryState, targetCursor: number): HistoryRestoreAction[] {
  if (targetCursor < 0 || targetCursor >= state.ops.length) return []
  const target = state.ops[targetCursor]
  if (!target) return []
  if (target.type === 'snapshot') {
    return [{ kind: 'snapshot', data: target.data, label: target.label }]
  }
  const snapIndex = nearestSnapshotIndex(state, targetCursor)
  const actions: HistoryRestoreAction[] = []
  if (snapIndex >= 0) {
    const snap = state.ops[snapIndex]
    if (snap?.type === 'snapshot') {
      actions.push({ kind: 'snapshot', data: snap.data, label: snap.label })
    }
  }
  for (let index = snapIndex + 1; index <= targetCursor; index += 1) {
    const action = restoreActionForRedo({ ...state, cursor: index - 1 })
    if (action) actions.push(action)
  }
  return actions
}

export function opsSinceLastSnapshot(state: HistoryState): number {
  for (let index = state.cursor; index >= 0; index -= 1) {
    if (state.ops[index]?.type === 'snapshot') {
      return state.cursor - index
    }
  }
  return state.cursor + 1
}

export function shouldSnapshot(state: HistoryState): boolean {
  return state.ops.length === 0 || opsSinceLastSnapshot(state) >= SNAPSHOT_EVERY
}

export function canUndo(state: HistoryState): boolean {
  return state.cursor > 0
}

export function canRedo(state: HistoryState): boolean {
  return state.cursor < state.ops.length - 1
}

export function snapshotAtCursor(state: HistoryState): string | null {
  for (let index = state.cursor; index >= 0; index -= 1) {
    const op = state.ops[index]
    if (op?.type === 'snapshot') return op.data
  }
  return null
}

export function undoState(state: HistoryState): { state: HistoryState; op: HistoryOp | null } {
  if (!canUndo(state)) return { state, op: null }
  const cursor = state.cursor - 1
  return { state: { ...state, cursor }, op: state.ops[state.cursor] ?? null }
}

export function redoState(state: HistoryState): { state: HistoryState; op: HistoryOp | null } {
  if (!canRedo(state)) return { state, op: null }
  const cursor = state.cursor + 1
  return { state: { ...state, cursor }, op: state.ops[cursor] ?? null }
}

export function snapshotForUndo(state: HistoryState): string | null {
  return snapshotAtCursor(state)
}

export function snapshotForRedo(state: HistoryState): string | null {
  for (let index = state.cursor; index < state.ops.length; index += 1) {
    const op = state.ops[index]
    if (op?.type === 'snapshot') return op.data
  }
  return null
}

export function restoreActionForUndo(state: HistoryState): HistoryRestoreAction {
  if (!canUndo(state)) return null
  const op = state.ops[state.cursor]
  if (!op) return null
  if (op.type === 'treatment') {
    return {
      kind: 'treatment',
      objectId: op.objectId,
      treatmentsJson: op.before,
      label: `Undo: ${op.label}`,
    }
  }
  if (op.type === 'posterTreatment') {
    return {
      kind: 'posterTreatment',
      artboardId: op.artboardId,
      treatmentsJson: op.before,
      label: `Undo: ${op.label}`,
    }
  }
  if (op.type === 'objectPatch') {
    return {
      kind: 'objectPatch',
      objectId: op.objectId,
      patchJson: op.before,
      label: `Undo: ${op.label}`,
    }
  }
  if (op.type === 'layerOrder') {
    return {
      kind: 'layerOrder',
      orderJson: op.before,
      label: `Undo: ${op.label}`,
    }
  }
  const snapshot = snapshotForUndo({ ...state, cursor: state.cursor - 1 })
  if (!snapshot) return null
  return { kind: 'snapshot', data: snapshot, label: `Undo: ${op.label}` }
}

export function restoreActionForRedo(state: HistoryState): HistoryRestoreAction {
  if (!canRedo(state)) return null
  const op = state.ops[state.cursor + 1]
  if (!op) return null
  if (op.type === 'treatment') {
    return {
      kind: 'treatment',
      objectId: op.objectId,
      treatmentsJson: op.after,
      label: `Redo: ${op.label}`,
    }
  }
  if (op.type === 'posterTreatment') {
    return {
      kind: 'posterTreatment',
      artboardId: op.artboardId,
      treatmentsJson: op.after,
      label: `Redo: ${op.label}`,
    }
  }
  if (op.type === 'objectPatch') {
    return {
      kind: 'objectPatch',
      objectId: op.objectId,
      patchJson: op.after,
      label: `Redo: ${op.label}`,
    }
  }
  if (op.type === 'layerOrder') {
    return {
      kind: 'layerOrder',
      orderJson: op.after,
      label: `Redo: ${op.label}`,
    }
  }
  return { kind: 'snapshot', data: op.data, label: `Redo: ${op.label}` }
}
