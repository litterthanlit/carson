import { describe, expect, it } from 'vitest'
import { createSeededRandom } from './random'
import {
  releaseField,
  liftMaps,
  pressureField,
  relaidPose,
  tapeBand,
  TAPE_LIFT_DEFAULTS,
  tapeLiftParamsFromRecord,
  type LayerFrame,
} from './tapeLift'

const frame: LayerFrame = { center: { x: 500, y: 300 }, ex: { x: 1, y: 0 }, ey: { x: 0, y: 1 }, halfW: 400, halfH: 100 }
const mean = (values: Float32Array) => values.reduce((sum, value) => sum + value, 0) / values.length

describe('tape lift', () => {
  it('lays the tape along the layer, running past both ends', () => {
    const band = tapeBand(frame, { ...TAPE_LIFT_DEFAULTS, angle: 0 }, createSeededRandom(1))
    expect(Math.abs(band.dir.x)).toBeGreaterThan(0.99)
    expect(band.length).toBeGreaterThan(800)
    expect(band.width).toBeCloseTo(200 * 0.55, -1)
    // Centred across the layer when position is 50 (give or take a hand's wobble).
    expect(Math.abs(band.center.y - 300)).toBeLessThan(40)
  })

  it('moves across the layer with position and turns with angle', () => {
    const top = tapeBand(frame, { ...TAPE_LIFT_DEFAULTS, position: 0 }, createSeededRandom(2))
    const bottom = tapeBand(frame, { ...TAPE_LIFT_DEFAULTS, position: 100 }, createSeededRandom(2))
    expect(top.center.y).toBeLessThan(bottom.center.y)
    const across = tapeBand(frame, { ...TAPE_LIFT_DEFAULTS, angle: 90 }, createSeededRandom(3))
    expect(Math.abs(across.dir.y)).toBeGreaterThan(0.99)
  })

  it('throws the strip away at re-lay 0 and sticks it down beside the gap otherwise', () => {
    const band = tapeBand(frame, TAPE_LIFT_DEFAULTS, createSeededRandom(4))
    expect(relaidPose(band, { ...TAPE_LIFT_DEFAULTS, relay: 0 }, createSeededRandom(4))).toBeNull()
    const pose = relaidPose(band, { ...TAPE_LIFT_DEFAULTS, relay: 80, mirror: 1 }, createSeededRandom(4))!
    const away = Math.abs((pose.center.x - band.center.x) * band.normal.x + (pose.center.y - band.center.y) * band.normal.y)
    expect(away).toBeGreaterThan(band.width * 0.3)
    expect(pose.mirrored).toBe(true)
  })

  it('rubs harder with more pressure', () => {
    const soft = pressureField(200, 50, { ...TAPE_LIFT_DEFAULTS, pressure: 20 }, createSeededRandom(5))
    const hard = pressureField(200, 50, { ...TAPE_LIFT_DEFAULTS, pressure: 90 }, createSeededRandom(5))
    expect(mean(hard)).toBeGreaterThan(mean(soft))
    for (const value of hard) expect(value).toBeLessThanOrEqual(1)
  })

  it('lifts more ink with more pressure, grain by grain rather than as a fade', () => {
    const release = releaseField(200, 50, 3, createSeededRandom(6))
    const lift = (pressure: number) =>
      liftMaps(new Float32Array(200 * 50).fill(pressure), release, 200, 50, { ...TAPE_LIFT_DEFAULTS, tear: 0 }, createSeededRandom(7)).lift
    const light = lift(0.3)
    const firm = lift(0.8)
    expect(mean(firm)).toBeGreaterThan(mean(light))
    // Mostly all-or-nothing per fibre: few pixels sit in the middle.
    const middling = [...lift(0.5)].filter((value) => value > 0.2 && value < 0.8).length / (200 * 50)
    expect(middling).toBeLessThan(0.5)
  })

  it('tears paper only when asked, and torn spots give up all their ink', () => {
    const pressure = new Float32Array(200 * 50).fill(0.9)
    const release = releaseField(200, 50, 3, createSeededRandom(8))
    const none = liftMaps(pressure, release, 200, 50, { ...TAPE_LIFT_DEFAULTS, tear: 0 }, createSeededRandom(9))
    expect(mean(none.tear)).toBe(0)
    const torn = liftMaps(pressure, release, 200, 50, { ...TAPE_LIFT_DEFAULTS, tear: 100 }, createSeededRandom(9))
    expect(mean(torn.tear)).toBeGreaterThan(0)
    torn.tear.forEach((value, index) => expect(torn.lift[index]).toBeGreaterThanOrEqual(value - 1e-6))
  })

  it('grips less with masking tape than with clear film', () => {
    const pressure = new Float32Array(200 * 50).fill(0.7)
    const release = releaseField(200, 50, 3, createSeededRandom(10))
    const clear = liftMaps(pressure, release, 200, 50, { ...TAPE_LIFT_DEFAULTS, tear: 0, tape: 0 }, createSeededRandom(11))
    const masking = liftMaps(pressure, release, 200, 50, { ...TAPE_LIFT_DEFAULTS, tear: 0, tape: 1 }, createSeededRandom(11))
    expect(mean(masking.lift)).toBeLessThan(mean(clear.lift))
  })

  it('is the same pull for the same seed, and reads old params with defaults', () => {
    const run = () => tapeBand(frame, TAPE_LIFT_DEFAULTS, createSeededRandom(12))
    expect(run()).toEqual(run())
    expect(tapeLiftParamsFromRecord({ tape: 0.7 }).tape).toBe(1)
    expect(tapeLiftParamsFromRecord({}).pressure).toBe(TAPE_LIFT_DEFAULTS.pressure)
  })
})
