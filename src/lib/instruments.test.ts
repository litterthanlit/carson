import { describe, expect, it } from 'vitest'
import { getLayerDecayProfile } from './editorModel'
import {
  getInstrument,
  instrumentUsesTension,
  resolveInstrumentParams,
  scaleTreatmentParams,
} from './instruments'
import { instrumentTensionScale, scaleInstrumentParams } from './instrumentTension'
import { gridTensionScale } from './grid'

describe('instrument registry', () => {
  it('describes Age, ink-loss, and fold as layer instruments on the treatment stack', () => {
    expect(getInstrument('age')).toMatchObject({
      name: 'Age selected',
      treatmentType: 'decay',
      scope: 'layer',
      tensionKeys: ['amount'],
    })
    expect(getInstrument('ink-loss')).toMatchObject({
      name: 'Ink loss',
      treatmentType: 'decay-marks',
      scope: 'layer',
      defaultParams: { amount: 55, kind: 0 },
    })
    expect(getInstrument('fold')).toMatchObject({
      name: 'Fold marks',
      treatmentType: 'decay-marks',
      scope: 'layer',
      defaultParams: { amount: 55, kind: 1 },
    })
    expect(getInstrument('wear')).toMatchObject({
      treatmentType: 'decay-marks',
      defaultParams: { amount: 55, kind: 2 },
    })
    expect(getInstrument('misprint')).toMatchObject({
      name: 'Misprint offset',
      treatmentType: 'misprint',
      scope: 'layer',
      tensionKeys: ['offset'],
    })
    expect(getInstrument('type-strips')).toMatchObject({
      name: 'Type strip',
      treatmentType: 'type-strips',
      scope: 'layer',
      tensionKeys: ['jitter'],
    })
  })

  it('keeps mark kind when the decay amount slider overrides params', () => {
    expect(resolveInstrumentParams('ink-loss', { amount: 80 })).toEqual({ amount: 80, kind: 0 })
    expect(resolveInstrumentParams('fold', { amount: 20 })).toEqual({ amount: 20, kind: 1 })
  })

  it('treats Tension as an input to every intensity instrument', () => {
    expect(instrumentUsesTension('decay')).toBe(true)
    expect(instrumentUsesTension('decay-marks')).toBe(true)
    expect(instrumentUsesTension('xerox')).toBe(true)
    expect(instrumentUsesTension('scatter')).toBe(true)
    expect(instrumentUsesTension('copy-machine')).toBe(true)
    expect(instrumentUsesTension('misprint')).toBe(true)
    expect(instrumentUsesTension('type-strips')).toBe(true)
    expect(instrumentUsesTension('distress')).toBe(true)
    expect(instrumentUsesTension('cold-wash')).toBe(false)
  })

  it('scales stored intensity params without mutating kind or scan angle', () => {
    expect(instrumentTensionScale(gridTensionScale(0))).toBe(1)
    expect(instrumentTensionScale(gridTensionScale(100))).toBe(2)
    expect(scaleInstrumentParams({ amount: 40, kind: 0 }, ['amount'], 2)).toEqual({ amount: 80, kind: 0 })
    expect(scaleTreatmentParams('decay-marks', { amount: 40, kind: 1 }, 2)).toEqual({ amount: 80, kind: 1 })
    expect(scaleTreatmentParams('copy-machine', { wobble: 35, dragAngle: 90 }, 2)).toMatchObject({
      wobble: 70,
      dragAngle: 90,
    })
    expect(scaleTreatmentParams('misprint', { offset: 10, opacity: 0.27 }, 2)).toEqual({ offset: 20, opacity: 0.27 })
    expect(scaleTreatmentParams('type-strips', { rows: 5, jitter: 12 }, 2)).toEqual({ rows: 5, jitter: 24 })
  })

  it('pushes Age amount through Tension into a stronger decay profile', () => {
    const rested = getLayerDecayProfile(scaleTreatmentParams('decay', { amount: 40 }, 1).amount ?? 40)
    const restless = getLayerDecayProfile(scaleTreatmentParams('decay', { amount: 40 }, 2).amount ?? 40)
    expect(restless.noise).toBeGreaterThan(rested.noise)
    expect(restless.contrast).toBeGreaterThan(rested.contrast)
  })
})
