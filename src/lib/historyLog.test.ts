import { describe, expect, it } from 'vitest'
import {
  canRedo,
  canUndo,
  createHistoryState,
  pushHistoryOp,
  redoState,
  snapshotForRedo,
  snapshotForUndo,
  undoState,
} from './historyLog'

describe('historyLog', () => {
  it('tracks ops and supports undo/redo', () => {
    let state = createHistoryState()
    state = pushHistoryOp(state, { type: 'snapshot', label: 'Start', data: '{}' })
    state = pushHistoryOp(state, { type: 'snapshot', label: 'Edit', data: '{"v":1}' })
    expect(canUndo(state)).toBe(true)
    const undone = undoState(state)
    expect(undone.op?.label).toBe('Start')
    state = undone.state
    const redone = redoState(state)
    expect(redone.op?.label).toBe('Edit')
  })

  it('restores snapshots via cursor helpers', () => {
    let state = createHistoryState()
    state = pushHistoryOp(state, { type: 'snapshot', label: 'Start', data: '{"a":1}' })
    state = pushHistoryOp(state, { type: 'snapshot', label: 'Edit', data: '{"a":2}' })
    const undone = undoState(state)
    expect(snapshotForUndo(undone.state)).toBe('{"a":1}')
    const redone = redoState(undone.state)
    expect(snapshotForRedo(redone.state)).toBe('{"a":2}')
    expect(canRedo(redone.state)).toBe(false)
  })
})
