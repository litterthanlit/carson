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

  it('restores poster treatment ops incrementally', () => {
    let state = createHistoryState()
    state = pushHistoryOp(state, { type: 'snapshot', label: 'Start', data: '{"a":1}' })
    state = pushHistoryOp(state, {
      type: 'posterTreatment',
      label: 'Re-roll poster treatment',
      artboardId: 'board-1',
      before: '[{"id":"s1","seed":1}]',
      after: '[{"id":"s1","seed":2}]',
    })
    const action = restoreActionForUndo(state)
    expect(action).toEqual({
      kind: 'posterTreatment',
      artboardId: 'board-1',
      treatmentsJson: '[{"id":"s1","seed":1}]',
      label: 'Undo: Re-roll poster treatment',
    })
    const redoAction = restoreActionForRedo({ ...state, cursor: 0 })
    expect(redoAction).toEqual({
      kind: 'posterTreatment',
      artboardId: 'board-1',
      treatmentsJson: '[{"id":"s1","seed":2}]',
      label: 'Redo: Re-roll poster treatment',
    })
  })

  it('counts poster treatment ops toward snapshot threshold', () => {
    let state = createHistoryState()
    state = pushHistoryOp(state, { type: 'snapshot', label: 'Start', data: '{}' })
    state = pushHistoryOp(state, {
      type: 'posterTreatment',
      label: 'Bypass poster treatment',
      artboardId: 'board-1',
      before: '[]',
      after: '[{"enabled":false}]',
    })
    expect(opsSinceLastSnapshot(state)).toBe(1)
    expect(shouldSnapshot(state)).toBe(false)
  })

  it('restores object patch ops incrementally', () => {
    let state = createHistoryState()
    state = pushHistoryOp(state, { type: 'snapshot', label: 'Start', data: '{}' })
    state = pushHistoryOp(state, {
      type: 'objectPatch',
      label: 'Changed opacity',
      objectId: 'layer-1',
      before: '{"opacity":1}',
      after: '{"opacity":0.5}',
    })
    expect(restoreActionForUndo(state)).toEqual({
      kind: 'objectPatch',
      objectId: 'layer-1',
      patchJson: '{"opacity":1}',
      label: 'Undo: Changed opacity',
    })
    expect(restoreActionForRedo({ ...state, cursor: 0 })).toEqual({
      kind: 'objectPatch',
      objectId: 'layer-1',
      patchJson: '{"opacity":0.5}',
      label: 'Redo: Changed opacity',
    })
  })

  it('restores layer order ops incrementally', () => {
    let state = createHistoryState()
    state = pushHistoryOp(state, { type: 'snapshot', label: 'Start', data: '{}' })
    state = pushHistoryOp(state, {
      type: 'layerOrder',
      label: 'Reordered layers',
      before: '["a","b"]',
      after: '["b","a"]',
    })
    expect(restoreActionForUndo(state)).toEqual({
      kind: 'layerOrder',
      orderJson: '["a","b"]',
      label: 'Undo: Reordered layers',
    })
  })
})
