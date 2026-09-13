import { describe, expect, it } from 'vitest'
import { saveAsDialogCopy, saveAsNameError, uniqueCopyName } from './fileIdentity'

describe('file identity', () => {
  it('names a copy without colliding with existing posters', () => {
    expect(uniqueCopyName('Night bus', [])).toBe('Night bus copy')
    expect(uniqueCopyName('Night bus', ['Night bus', 'Night bus copy'])).toBe('Night bus copy 2')
    expect(uniqueCopyName('  ', ['Untitled poster copy'])).toBe('Untitled poster copy 2')
  })

  it('refuses empty and colliding Save as names instead of overwrite-by-confirm', () => {
    expect(saveAsNameError('   ', ['Night bus'])).toMatch(/name this copy/i)
    expect(saveAsNameError('Night bus', ['Night bus'])).toMatch(/already exists/i)
    expect(saveAsNameError('Night bus evening', ['Night bus'])).toBeUndefined()
    expect(saveAsDialogCopy().body).toMatch(/original stays on Home/i)
  })
})
