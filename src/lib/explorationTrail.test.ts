import { describe, expect, it } from 'vitest'
import { pushHistoryOp, createHistoryState, type HistoryOp } from './historyLog'
import {
  activeTrailFrame,
  commitTrailFrame,
  isTrailWorthy,
  liveOpIds,
  patchTrailThumbnail,
  pruneTrailToOps,
  MAX_TRAIL_FRAMES,
} from './explorationTrail'

function snapshot(label: string, data = '{}'): HistoryOp {
  return { type: 'snapshot', label, data }
}

describe('exploration trail', () => {
  it('skips nudge and reorder ops', () => {
    expect(isTrailWorthy({ type: 'snapshot', label: 'Start', data: '{}' })).toBe(true)
    expect(isTrailWorthy({ type: 'treatment', label: 'Xerox', objectId: 'a', before: '[]', after: '[]' })).toBe(true)
    expect(isTrailWorthy({ type: 'objectPatch', label: 'Nudged', objectId: 'a', before: '{}', after: '{}' })).toBe(false)
    expect(isTrailWorthy({ type: 'layerOrder', label: 'Reordered', before: '[]', after: '[]' })).toBe(false)
  })

  it('drops frames that left the redo branch', () => {
    let state = createHistoryState()
    state = pushHistoryOp(state, snapshot('Start'))
    state = pushHistoryOp(state, snapshot('Xerox'))
    const ids = liveOpIds(state.ops)
    const frames = [
      { id: 't1', opId: ids[0]!, label: 'Start' },
      { id: 't2', opId: ids[1]!, label: 'Xerox' },
    ]
    const undone = { ...state, cursor: 0, ops: state.ops.slice(0, 1) }
    expect(pruneTrailToOps(frames, liveOpIds(undone.ops))).toEqual([frames[0]])
  })

  it('replaces a consecutive frame with the same label', () => {
    const first = commitTrailFrame([], ['op-1'], { id: 't1', opId: 'op-1', label: 'Started a new poster' })
    const next = commitTrailFrame(first, ['op-1', 'op-2'], {
      id: 't2',
      opId: 'op-2',
      label: 'Started a new poster',
    })
    expect(next).toHaveLength(1)
    expect(next[0]?.opId).toBe('op-2')
  })

  it('appends a frame and caps the strip', () => {
    const opIds: string[] = []
    let frames: ReturnType<typeof commitTrailFrame> = []
    for (let index = 0; index < MAX_TRAIL_FRAMES + 4; index += 1) {
      const opId = `op-${index}`
      opIds.push(opId)
      frames = commitTrailFrame(frames, opIds, { id: `t-${index}`, opId, label: `Step ${index}` })
    }
    expect(frames).toHaveLength(MAX_TRAIL_FRAMES)
    expect(frames[0]?.opId).toBe('op-4')
    expect(frames.at(-1)?.opId).toBe(`op-${MAX_TRAIL_FRAMES + 3}`)
  })

  it('fills in a thumbnail on the matching op', () => {
    const frames = patchTrailThumbnail(
      [{ id: 't1', opId: 'op-1', label: 'Start' }],
      'op-1',
      'data:image/jpeg;base64,abc',
    )
    expect(frames[0]?.thumbnail).toBe('data:image/jpeg;base64,abc')
  })

  it('highlights the last framed op at or before the cursor', () => {
    let state = createHistoryState()
    state = pushHistoryOp(state, snapshot('Start'))
    state = pushHistoryOp(state, {
      type: 'objectPatch',
      label: 'Nudged',
      objectId: 'a',
      before: '{}',
      after: '{}',
    })
    state = pushHistoryOp(state, snapshot('Scatter'))
    const ids = liveOpIds(state.ops)
    const frames = [
      { id: 't1', opId: ids[0]!, label: 'Start' },
      { id: 't2', opId: ids[2]!, label: 'Scatter' },
    ]
    expect(activeTrailFrame(frames, ids, 1)?.label).toBe('Start')
    expect(activeTrailFrame(frames, ids, 2)?.label).toBe('Scatter')
  })
})
