import { describe, expect, it } from 'vitest'
import {
  canUndo,
  createHistoryState,
  pushHistoryOp,
  redoState,
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
})
