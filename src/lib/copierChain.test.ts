import { describe, expect, it } from 'vitest'
import { copierChain, usesCopier } from './copyMachineTreatment'
import { copyMachineParamsFromGeneration } from './copyMachine'
import type { Treatment } from './treatments'

const treatment = (type: Treatment['type'], params: Record<string, number> = {}): Treatment => ({
  id: `${type}-1`,
  type,
  seed: 7,
  enabled: true,
  params,
})

describe('copier chain', () => {
  it('runs Xerox through the copier, set by its generation', () => {
    const chain = copierChain([treatment('xerox', { generation: 8 }), treatment('scatter')])
    expect(chain).toHaveLength(1)
    expect(chain[0].type).toBe('copy-machine')
    expect(chain[0].params.contrast).toBe(copyMachineParamsFromGeneration(8).contrast)
    expect(chain[0].seed).toBe(7)
  })

  it('keeps Copy machine steps as they are, in order', () => {
    const chain = copierChain([treatment('copy-machine', { grain: 12 }), treatment('xerox', { generation: 2 })])
    expect(chain.map((item) => item.type)).toEqual(['copy-machine', 'copy-machine'])
    expect(chain[0].params.grain).toBe(12)
  })

  it('knows which layers use the copier', () => {
    expect(usesCopier([treatment('xerox')])).toBe(true)
    expect(usesCopier([treatment('decay')])).toBe(false)
  })
})
