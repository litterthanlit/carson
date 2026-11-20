import { describe, expect, it } from 'vitest'
import {
  COPY_MACHINE_DEFAULTS,
  COPY_MACHINE_SOLVENT_TRANSFER,
  renderCopyMachinePass,
} from './copyMachine'
import { copyMachineChainHasSolvent, copyMachineChainPadding, copyMachineGhostInput } from './copyMachineTreatment'
import { getInstrument } from './instruments'
import { createSeededRandom } from './random'
import {
  applySolventTransfer,
  copyMachineBleedPadding,
  SOLVENT_TRANSFER_DEFAULTS,
  solventTransferIsIdle,
} from './solventTransfer'
import { treatmentLabel } from './treatments'

if (typeof globalThis.ImageData === 'undefined') {
  class PolyfillImageData {
    width: number
    height: number
    data: Uint8ClampedArray
    colorSpace: PredefinedColorSpace = 'srgb'
    constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
      if (typeof dataOrWidth === 'number') {
        this.width = dataOrWidth
        this.height = widthOrHeight
        this.data = new Uint8ClampedArray(this.width * this.height * 4)
      } else {
        this.data = dataOrWidth
        this.width = widthOrHeight
        this.height = height ?? dataOrWidth.length / 4 / widthOrHeight
      }
    }
  }
  ;(globalThis as unknown as { ImageData: unknown }).ImageData = PolyfillImageData
}

function makeImageData(width: number, height: number): ImageData {
  return new ImageData(width, height)
}

/** Synthesize a clean multi-bar "word" ink plane (0 paper .. 1 solid ink). */
function wordInkPlane(width: number, height: number): Float32Array {
  const ink = new Float32Array(width * height)
  // Five vertical bars representing strokes of a word in the middle of the sheet.
  for (let bar = 0; bar < 5; bar++) {
    const x0 = Math.round(width * 0.22) + bar * Math.round(width * 0.12)
    const x1 = x0 + Math.max(4, Math.round(width * 0.045))
    const y0 = Math.round(height * 0.3)
    const y1 = Math.round(height * 0.7)
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) ink[y * width + x] = 1
    }
  }
  return ink
}

function wordImageData(width: number, height: number): ImageData {
  const img = makeImageData(width, height)
  const ink = wordInkPlane(width, height)
  for (let p = 0, i = 0; p < ink.length; p++, i += 4) {
    if (ink[p] > 0.5) {
      img.data[i] = 10
      img.data[i + 1] = 10
      img.data[i + 2] = 10
      img.data[i + 3] = 255
    }
  }
  return img
}

function sum(plane: Float32Array): number {
  let total = 0
  for (let i = 0; i < plane.length; i++) total += plane[i]
  return total
}

describe('solventTransfer', () => {
  it('draws zero random numbers and returns unchanged ink when idle', () => {
    const ink = wordInkPlane(64, 64)
    let calls = 0
    const spy = () => {
      calls += 1
      return 0.5
    }
    expect(solventTransferIsIdle(SOLVENT_TRANSFER_DEFAULTS)).toBe(true)
    const res = applySolventTransfer(ink, 64, 64, SOLVENT_TRANSFER_DEFAULTS, spy)
    expect(calls).toBe(0)
    expect(Array.from(res.ink)).toEqual(Array.from(ink))
  })

  it('is deterministic for a given seed and varies across seeds', () => {
    const ink = wordInkPlane(120, 120)
    const params = { blot: 70, smear: 70, seams: 75, debris: 60, dragAngle: 90 }
    const a = applySolventTransfer(ink, 120, 120, params, createSeededRandom(17))
    const b = applySolventTransfer(ink, 120, 120, params, createSeededRandom(17))
    const c = applySolventTransfer(ink, 120, 120, params, createSeededRandom(99))
    expect(Array.from(a.ink)).toEqual(Array.from(b.ink))
    expect(Array.from(a.ink)).not.toEqual(Array.from(c.ink))
  })

  it('blot pools ink locally around strokes while keeping stark 1-bit contrast', () => {
    const ink = wordInkPlane(140, 140)
    const before = sum(ink)
    const res = applySolventTransfer(ink, 140, 140, { blot: 80, smear: 0, seams: 0, debris: 0, dragAngle: 0 }, createSeededRandom(7))
    expect(sum(res.ink)).toBeGreaterThan(before * 1.05)

    // Stark 1-bit xerox bite: vast majority of pixels should snap close to 0 or 1, not muddy gray.
    let midGray = 0
    for (let i = 0; i < res.ink.length; i++) {
      if (res.ink[i] > 0.1 && res.ink[i] < 0.9) midGray += 1
    }
    expect(midGray / res.ink.length).toBeLessThan(0.05)
  })

  it('smear drags combed ink outward along the rub axis', () => {
    const ink = wordInkPlane(140, 140)
    const res = applySolventTransfer(
      ink,
      140,
      140,
      { blot: 65, smear: 85, seams: 0, debris: 0, dragAngle: 90 },
      createSeededRandom(21),
    )
    // Expect dragged ink above/below the original vertical stroke span (y < 0.3*140 or y >= 0.7*140).
    let outsideInk = 0
    for (let y = 0; y < 140; y++) {
      if (y >= 42 && y < 98) continue
      for (let x = 0; x < 140; x++) outsideInk += res.ink[y * 140 + x]
    }
    expect(outsideInk).toBeGreaterThan(15)
  })

  it('debris adds irregular toner flakes in the whitespace margins', () => {
    const ink = wordInkPlane(160, 160)
    const res = applySolventTransfer(
      ink,
      160,
      160,
      { blot: 0, smear: 0, seams: 0, debris: 80, dragAngle: 0 },
      createSeededRandom(33),
    )
    let marginInk = 0
    for (let y = 0; y < 160; y++) {
      for (let x = 0; x < 160; x++) {
        if (x < 30 || x > 130 || y < 38 || y > 122) marginInk += res.ink[y * 160 + x]
      }
    }
    expect(marginInk).toBeGreaterThan(20)
  })

  it('computes zero bleed padding when idle and bounded positive padding when active', () => {
    expect(copyMachineBleedPadding(COPY_MACHINE_DEFAULTS, 400)).toBe(0)
    const pad = copyMachineBleedPadding(COPY_MACHINE_SOLVENT_TRANSFER, 400)
    expect(pad).toBeGreaterThanOrEqual(40)
    expect(pad).toBeLessThanOrEqual(340)
    expect(copyMachineChainHasSolvent([{ enabled: true, params: { ...COPY_MACHINE_SOLVENT_TRANSFER } }])).toBe(true)
    expect(copyMachineChainHasSolvent([{ enabled: true, params: { ...COPY_MACHINE_DEFAULTS } }])).toBe(false)
    expect(copyMachineChainPadding([{ enabled: true, params: { ...COPY_MACHINE_SOLVENT_TRANSFER } }], 400)).toBe(pad)
  })

  it('integrates cleanly with renderCopyMachinePass, instruments, ghost input, and treatment labels', () => {
    const inst = getInstrument('solvent-transfer')
    expect(inst.treatmentType).toBe('copy-machine')
    expect(inst.defaultParams.blot).toBeGreaterThan(0)
    expect(inst.defaultParams.smear).toBeGreaterThan(0)
    expect(inst.defaultParams.seams).toBeGreaterThan(0)
    expect(inst.defaultParams.debris).toBeGreaterThan(0)

    const source = wordImageData(120, 120)
    const baked = renderCopyMachinePass(source, COPY_MACHINE_SOLVENT_TRANSFER, createSeededRandom(42))
    // Uses deep jet-black solvent toner (5) on transparent layer pixels.
    let sawDeepBlack = false
    for (let i = 0; i < baked.data.length; i += 4) {
      if (baked.data[i + 3] > 200 && baked.data[i] === 5) {
        sawDeepBlack = true
        break
      }
    }
    expect(sawDeepBlack).toBe(true)

    const ghost = copyMachineGhostInput(COPY_MACHINE_SOLVENT_TRANSFER, source, baked)
    expect(ghost.source).toBe(baked)
    expect(ghost.params).toMatchObject({ blot: 0, smear: 0, seams: 0, debris: 0 })

    expect(
      treatmentLabel({ id: 't1', type: 'copy-machine', seed: 12, enabled: true, params: { ...COPY_MACHINE_SOLVENT_TRANSFER } }),
    ).toBe('Solvent·#12')
    expect(
      treatmentLabel({ id: 't2', type: 'copy-machine', seed: 12, enabled: true, params: { ...COPY_MACHINE_DEFAULTS } }),
    ).toBe('Copy·#12')
  })
})
