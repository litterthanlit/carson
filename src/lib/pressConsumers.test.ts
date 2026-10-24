import { describe, expect, it } from 'vitest'
import type { FabricObject } from 'fabric'
import { applyPosterPreset } from './editorModel'
import { addArtboard, createDefaultDocument, normalizeDocumentMeta, readArtboardPress, writeArtboardPress } from './document'
import { createHistoryState, pushHistoryOp, restoreActionForRedo, restoreActionForUndo } from './historyLog'
import { COMPANION_POSE_KEY, companionPoseStamp, isCompanionPoseStale, stampCompanionPose } from './companionFollow'
import { inkMapPixels, inkMapSize } from './inkMap'
import { bindPress, pressInkDensityAt, pressRegistration } from './press'
import { PRESS_CHECK_DEFAULTS, renderPressCheckPass } from './pressCheck'
import { misprintPoseForTreatment } from './misprintTreatment'
import { typeStripInkOpacity } from './typeStripsTreatment'
import { copyMachineGhostDelta, COPY_MACHINE_DEFAULTS, COPY_MACHINE_INK_BLEED } from './copyMachine'
import { copyMachineChainUsesPress, copyMachinePressSignature, copyMachineSheetPatch } from './copyMachineTreatment'
import { createSeededRandom } from './random'
import type { Treatment } from './treatments'

class ImageDataPolyfill {
  readonly width: number
  readonly height: number
  readonly data: Uint8ClampedArray

  constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight?: number, height?: number) {
    if (typeof dataOrWidth === 'number') {
      this.width = dataOrWidth
      this.height = widthOrHeight ?? dataOrWidth
      this.data = new Uint8ClampedArray(this.width * this.height * 4)
      return
    }
    this.data = dataOrWidth
    this.width = widthOrHeight ?? 0
    this.height = height ?? 0
  }
}

if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = ImageDataPolyfill as typeof ImageData
}

const press = bindPress({ seed: 777, feedAngle: 0 }, { width: 800, height: 600 })

function countingRandom(seed: number) {
  const random = createSeededRandom(seed)
  let calls = 0
  return {
    random: () => {
      calls++
      return random()
    },
    calls: () => calls,
  }
}

describe('posters on a press', () => {
  it('starts every new poster and artboard on a run of its own', () => {
    const doc = createDefaultDocument(applyPosterPreset('a3'), {})
    const first = readArtboardPress(doc.artboards[0])
    expect(first).not.toBeNull()
    const next = addArtboard(doc, 'square')
    const second = readArtboardPress(next.artboards[1])
    expect(second).not.toBeNull()
  })

  it('keeps posters made before the press off it, and drops broken runs', () => {
    const doc = createDefaultDocument(applyPosterPreset('a3'), {})
    const legacy = { ...doc, artboards: doc.artboards.map((board) => writeArtboardPress(board, null)) }
    expect(readArtboardPress(normalizeDocumentMeta(legacy).artboards[0])).toBeNull()
    expect('press' in normalizeDocumentMeta(legacy).artboards[0]).toBe(false)
    const broken = { ...doc, artboards: doc.artboards.map((board) => ({ ...board, press: { feedAngle: 'up' } as never })) }
    expect('press' in normalizeDocumentMeta(broken).artboards[0]).toBe(false)
    const turned = writeArtboardPress(doc.artboards[0], { seed: 5, feedAngle: 450 })
    expect(readArtboardPress(turned)).toEqual({ seed: 5, feedAngle: 90 })
  })

  it('undoes and redoes a re-ink like any poster change', () => {
    let state = pushHistoryOp(createHistoryState(), { type: 'snapshot', label: 'Start', data: '{}' })
    state = pushHistoryOp(state, {
      type: 'press',
      label: 'Re-inked the press #9',
      artboardId: 'board-1',
      before: JSON.stringify({ seed: 1, feedAngle: 0 }),
      after: JSON.stringify({ seed: 9, feedAngle: 0 }),
    })
    expect(restoreActionForUndo(state)).toEqual({
      kind: 'press',
      artboardId: 'board-1',
      pressJson: JSON.stringify({ seed: 1, feedAngle: 0 }),
      label: 'Undo: Re-inked the press #9',
    })
    expect(restoreActionForRedo({ ...state, cursor: 0 })).toMatchObject({
      kind: 'press',
      pressJson: JSON.stringify({ seed: 9, feedAngle: 0 }),
    })
  })
})

describe('companions follow their source', () => {
  function layer(treatments: Partial<Treatment>[], pose = { left: 10, top: 20 }): FabricObject {
    return { id: 'text-1', ...pose, angle: 0, scaleX: 1, scaleY: 1, treatments } as unknown as FabricObject
  }

  it('notices when a copied layer settles somewhere new', () => {
    const object = layer([{ type: 'copy-machine', enabled: true }])
    expect(isCompanionPoseStale(object)).toBe(false)
    stampCompanionPose(object)
    expect(isCompanionPoseStale(object)).toBe(false)
    ;(object as unknown as { left: number }).left = 40
    expect(isCompanionPoseStale(object)).toBe(true)
    stampCompanionPose(object)
    expect((object as unknown as Record<string, unknown>)[COMPANION_POSE_KEY]).toBe(companionPoseStamp(object))
  })

  it('re-places an aged or xeroxed layer after a move only on a press', () => {
    const off = layer([{ type: 'decay', enabled: true }])
    stampCompanionPose(off, false)
    ;(off as unknown as { left: number }).left = 80
    expect(isCompanionPoseStale(off, false)).toBe(false)
    const on = layer([{ type: 'xerox', enabled: true }])
    stampCompanionPose(on, true)
    ;(on as unknown as { left: number }).left = 80
    expect(isCompanionPoseStale(on, true)).toBe(true)
    const marked = layer([{ type: 'decay-marks', enabled: true }])
    stampCompanionPose(marked)
    ;(marked as unknown as { top: number }).top = 300
    expect(isCompanionPoseStale(marked)).toBe(true)
  })

  it('leaves layers without companions, and layers inside a multi-selection, alone', () => {
    const plain = layer([{ type: 'scatter', enabled: true }])
    stampCompanionPose(plain)
    ;(plain as unknown as { left: number }).left = 99
    expect(isCompanionPoseStale(plain)).toBe(false)
    const grouped = layer([{ type: 'misprint', enabled: true }])
    stampCompanionPose(grouped)
    ;(grouped as unknown as { left: number; group: unknown }).left = 0
    ;(grouped as unknown as { group: unknown }).group = { type: 'activeselection' }
    expect(isCompanionPoseStale(grouped)).toBe(false)
  })
})

describe('the ink map', () => {
  it('covers the sheet at a small size, wet in blue and dry in amber', () => {
    const size = inkMapSize(press)
    expect(Math.max(size.width, size.height)).toBe(320)
    expect(size.width / size.height).toBeCloseTo(800 / 600, 1)
    const pixels = inkMapPixels(press, size.width, size.height)
    let wet = 0
    let dry = 0
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] === 0) continue
      if (pixels[i + 2] > pixels[i]) wet++
      else dry++
    }
    expect(wet).toBeGreaterThan(0)
    expect(dry).toBeGreaterThan(0)
  })
})

describe('Press Check on the press', () => {
  function sheetOfType(size: number): ImageData {
    const image = new ImageData(size, size)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const glyph = x % 16 < 8 && y > 8 && y < size - 8
        const i = (y * size + x) * 4
        image.data[i] = glyph ? 18 : 240
        image.data[i + 1] = glyph ? 14 : 236
        image.data[i + 2] = glyph ? 12 : 228
        image.data[i + 3] = 255
      }
    }
    return image
  }

  it('prints from the run alone — no dice of its own — and differs by run', () => {
    const source = sheetOfType(64)
    const sheet = { press, originX: 0, originY: 0, unit: 800 / 64 }
    const counter = countingRandom(3)
    const one = renderPressCheckPass(source, PRESS_CHECK_DEFAULTS, counter.random, 1, sheet)
    expect(counter.calls()).toBe(0)
    const again = renderPressCheckPass(source, PRESS_CHECK_DEFAULTS, createSeededRandom(99), 1, sheet)
    expect([...again.data]).toEqual([...one.data])
    const other = renderPressCheckPass(source, PRESS_CHECK_DEFAULTS, createSeededRandom(3), 1, {
      ...sheet,
      press: bindPress({ seed: 778, feedAngle: 0 }, { width: 800, height: 600 }),
    })
    expect([...other.data]).not.toEqual([...one.data])
  })

  it('still prints the legacy look off the press', () => {
    const source = sheetOfType(48)
    const a = renderPressCheckPass(source, PRESS_CHECK_DEFAULTS, createSeededRandom(5), 1)
    const b = renderPressCheckPass(source, PRESS_CHECK_DEFAULTS, createSeededRandom(5), 1, undefined)
    expect([...b.data]).toEqual([...a.data])
  })
})

describe('echoes and strips on the press', () => {
  const misprint: Treatment = { id: 'm', type: 'misprint', seed: 12, enabled: true, params: { offset: 10, opacity: 0.3 } }

  it('slips every echo the run’s way and prints it as dark as the ink there', () => {
    const slip = pressRegistration(press)
    const at = (x: number, y: number) =>
      misprintPoseForTreatment({ left: 100, top: 100, angle: 0 }, misprint, 1, { press, centerX: x, centerY: y })
    const pose = at(300, 300)
    const shift = { dx: pose.left - 100, dy: pose.top - 100 }
    // Seeded jitter aside, the echo moves along the run's slip.
    expect(shift.dx * slip.dx + shift.dy * slip.dy).toBeGreaterThan(5)
    expect(pose.opacity).toBeCloseTo(Math.min(1, 0.3 * pressInkDensityAt(press, 300, 300) * 1.15), 6)
    // Off the press, nothing changes.
    expect(misprintPoseForTreatment({ left: 100, top: 100, angle: 0 }, misprint, 1).opacity).toBe(0.3)
  })

  it('prints type strips lighter where the roller ran dry', () => {
    expect(typeStripInkOpacity({ left: 0, top: 0, width: 100, height: 20 }, null)).toBe(0.96)
    const strip = { left: 200, top: 100, width: 300, height: 24 }
    expect(typeStripInkOpacity(strip, press)).toBeCloseTo(0.96 * pressInkDensityAt(press, 350, 112), 6)
  })

  it('sends the copier ghost the same way as every misprint, just as far as before', () => {
    const slip = pressRegistration(press)
    const legacy = copyMachineGhostDelta(6)
    const onPress = copyMachineGhostDelta(6, slip)
    expect(Math.hypot(onPress.dx, onPress.dy)).toBeCloseTo(Math.hypot(legacy.dx, legacy.dy), 6)
    expect(onPress.dx * slip.dx + onPress.dy * slip.dy).toBeGreaterThan(0)
  })
})

describe('the copier on the press', () => {
  it('ties a bake to its spot on the sheet when its ink or drum reads the press', () => {
    const step = (params: Record<string, number>) => ({ enabled: true, params })
    const quiet = { ...COPY_MACHINE_DEFAULTS, grain: 0, bands: 0, streaks: 0, voids: 0 }
    expect(copyMachineChainUsesPress([step(quiet)])).toBe(false)
    expect(copyMachineChainUsesPress([step({ ...COPY_MACHINE_DEFAULTS })])).toBe(true)
    expect(copyMachineChainUsesPress([step({ ...quiet, streaks: 10 })])).toBe(true)
    expect(copyMachineChainUsesPress([step({ ...COPY_MACHINE_INK_BLEED })])).toBe(true)
    expect(copyMachineChainUsesPress([{ enabled: false, params: { ...COPY_MACHINE_INK_BLEED } }])).toBe(false)
    expect(copyMachinePressSignature(null, { left: 1, top: 2 })).toBe('')
    expect(copyMachinePressSignature(press, { left: 10, top: 20.25 })).toBe('|press:777/0/800x600@10.0,20.3')
  })

  it('maps a layer raster onto the sheet by its bounding box', () => {
    expect(copyMachineSheetPatch(press, { left: 40, top: 60, width: 200 }, 400)).toEqual({
      press,
      originX: 40,
      originY: 60,
      unit: 0.5,
    })
  })
})
