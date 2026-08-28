import { describe, expect, it } from 'vitest'
import { reviveSerializedObject } from './fabricRevive'

describe('reviveSerializedObject', () => {
  it('rejects snapshots with no type', async () => {
    await expect(reviveSerializedObject({})).rejects.toThrow(/missing a type/)
  })
})
