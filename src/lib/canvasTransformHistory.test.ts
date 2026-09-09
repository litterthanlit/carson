import { describe, expect, it } from 'vitest'
import { collectCanvasTransformPatches } from './canvasTransformHistory'

describe('canvasTransformHistory', () => {
  it('emits patches only for objects whose capture changed', () => {
    expect(
      collectCanvasTransformPatches(
        [
          { objectId: 'a', patch: '{"left":10}' },
          { objectId: 'b', patch: '{"left":20}' },
          { objectId: '', patch: '{"left":0}' },
        ],
        [
          { objectId: 'a', patch: '{"left":40}' },
          { objectId: 'b', patch: '{"left":20}' },
        ],
      ),
    ).toEqual([{ objectId: 'a', before: '{"left":10}', after: '{"left":40}' }])
  })

  it('returns nothing when the gesture did not move anything', () => {
    expect(
      collectCanvasTransformPatches(
        [{ objectId: 'a', patch: '{"left":10}' }],
        [{ objectId: 'a', patch: '{"left":10}' }],
      ),
    ).toEqual([])
  })
})
