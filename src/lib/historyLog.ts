/**
 * Operation-log history — lightweight ops with periodic full snapshots (Horizon 2.1).
 */
export type HistoryOp =
  | { type: 'snapshot'; label: string; data: string }
  | { type: 'treatment'; label: string; objectId: string; before: string; after: string }

export type HistoryState = {
  ops: HistoryOp[]
  cursor: number
}

const MAX_OPS = 200
const SNAPSHOT_EVERY = 20

export function createHistoryState(): HistoryState {
  return { ops: [], cursor: -1 }
}

export function pushHistoryOp(state: HistoryState, op: HistoryOp): HistoryState {
  const trimmed = state.ops.slice(0, state.cursor + 1)
  const next = [...trimmed, op].slice(-MAX_OPS)
  return { ops: next, cursor: next.length - 1 }
}

export function shouldSnapshot(state: HistoryState): boolean {
  const sinceSnapshot = state.ops.slice(state.cursor).filter((op) => op.type === 'snapshot').length
  return state.ops.length === 0 || sinceSnapshot >= SNAPSHOT_EVERY
}

export function canUndo(state: HistoryState): boolean {
  return state.cursor > 0
}

export function canRedo(state: HistoryState): boolean {
  return state.cursor < state.ops.length - 1
}

export function undoState(state: HistoryState): { state: HistoryState; op: HistoryOp | null } {
  if (!canUndo(state)) return { state, op: null }
  const cursor = state.cursor - 1
  return { state: { ...state, cursor }, op: state.ops[cursor] ?? null }
}

export function redoState(state: HistoryState): { state: HistoryState; op: HistoryOp | null } {
  if (!canRedo(state)) return { state, op: null }
  const cursor = state.cursor + 1
  return { state: { ...state, cursor }, op: state.ops[cursor] ?? null }
}

export function snapshotForUndo(state: HistoryState): string | null {
  for (let index = state.cursor; index >= 0; index -= 1) {
    const op = state.ops[index]
    if (op?.type === 'snapshot') return op.data
  }
  return null
}

export function snapshotForRedo(state: HistoryState): string | null {
  for (let index = state.cursor; index < state.ops.length; index += 1) {
    const op = state.ops[index]
    if (op?.type === 'snapshot') return op.data
  }
  return null
}
