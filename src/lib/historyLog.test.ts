import { describe, expect, it } from 'vitest'
import {
  canRedo,
  canUndo,
  createHistoryState,
  opsSinceLastSnapshot,
  pushHistoryOp,
  redoState,
  restoreActionForRedo,
  restoreActionForUndo,
  shouldSnapshot,
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
    expect(undone.op?.label).toBe('Edit')
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

  it('counts ops since the last snapshot', () => {
    let state = createHistoryState()
    state = pushHistoryOp(state, { type: 'snapshot', label: 'Start', data: '{}' })
    state = pushHistoryOp(state, {
      type: 'treatment',
      label: 'Toggle',
      objectId: 'layer-1',
      before: '[]',
      after: '[{"id":"t1"}]',
    })
    expect(opsSinceLastSnapshot(state)).toBe(1)
    expect(shouldSnapshot(state)).toBe(false)
  })

  it('restores treatment ops incrementally', () => {
    let state = createHistoryState()
    state = pushHistoryOp(state, { type: 'snapshot', label: 'Start', data: '{"a":1}' })
    state = pushHistoryOp(state, {
      type: 'treatment',
      label: 'Bypass',
      objectId: 'layer-1',
      before: '[{"enabled":true}]',
      after: '[{"enabled":false}]',
    })
    const action = restoreActionForUndo(state)
    expect(action).toEqual({
      kind: 'treatment',
      objectId: 'layer-1',
      treatmentsJson: '[{"enabled":true}]',
      label: 'Undo: Bypass',
    })
    const redoAction = restoreActionForRedo({ ...state, cursor: 0 })
    expect(redoAction).toEqual({
      kind: 'treatment',
      objectId: 'layer-1',
      treatmentsJson: '[{"enabled":false}]',
      label: 'Redo: Bypass',
    })
  })
})
