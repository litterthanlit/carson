import { describe, expect, it } from 'vitest'
import type { Canvas } from 'fabric'
import { createSeededRandom } from './random'
import { installFabricDefaults } from './fabricDefaults'
import { reviveSerializedObject } from './fabricRevive'
import {
  clipSegmentToRect,
  defaultFrameSpec,
  FRAME_COLOR,
  frameBoxForCorners,
  frameDashPattern,
  frameExtensionRays,
  frameGeometry,
  frameHandlePoints,
  FrameHandles,
  frameRectFromDrag,
  frameScaleDefaults,
  isFrameHandles,
  normalizeFrameSpec,
  readFrameSpec,
  rescaleFrameSpec,
  shuffleFrameSpec,
  snapToTargets,
  type FrameSpec,
} from './frameHandles'

installFabricDefaults()

const spec = (patch: Partial<FrameSpec> = {}): FrameSpec => ({ ...defaultFrameSpec(1500, 1500), ...patch })

describe('frame handles spec', () => {
  it('scales weight and handle size with the poster', () => {
    expect(frameScaleDefaults(1500, 1500)).toEqual({ weight: 2, handleSize: 20 })
    const a3 = frameScaleDefaults(3508, 4961)
    expect(a3.weight).toBeGreaterThan(6)
    expect(a3.handleSize).toBeGreaterThan(60)
    expect(frameScaleDefaults(200, 100).weight).toBeGreaterThanOrEqual(1)
  })

  it('normalizes stored specs: clamps numbers, drops unknowns, keeps canonical order', () => {
    const fallback = spec()
    const result = normalizeFrameSpec(
      { weight: -4, handleSize: 'big', handles: ['bl', 'nope', 'tl', 'tl'], handleFill: 'glitter', knockout: 'red', extend: ['left', 'top'], dash: 'dotted' },
      fallback,
    )
    expect(result.weight).toBe(0.25)
    expect(result.handleSize).toBe(fallback.handleSize)
    expect(result.handles).toEqual(['tl', 'bl'])
    expect(result.handleFill).toBe(fallback.handleFill)
    expect(result.knockout).toBe(fallback.knockout)
    expect(result.extend).toEqual(['top', 'left'])
    expect(result.dash).toBe('dotted')
    expect(normalizeFrameSpec(null, fallback)).toEqual(fallback)
  })

  it('rescales for a new poster size', () => {
    const next = rescaleFrameSpec(spec({ weight: 2, handleSize: 20 }), 2)
    expect(next.weight).toBe(4)
    expect(next.handleSize).toBe(40)
    expect(rescaleFrameSpec(spec(), 1)).toEqual(spec())
  })

  it('shuffles deterministically per seed and always keeps a handle', () => {
    const a = shuffleFrameSpec(spec(), createSeededRandom(42))
    const b = shuffleFrameSpec(spec(), createSeededRandom(42))
    expect(a).toEqual(b)
    for (let seed = 1; seed < 60; seed++) {
      const shuffled = shuffleFrameSpec(spec(), createSeededRandom(seed))
      expect(shuffled.handles.some((handle) => ['tl', 'tr', 'br', 'bl'].includes(handle))).toBe(true)
      expect(shuffled.weight).toBe(spec().weight)
    }
  })
})

describe('frame geometry', () => {
  it('puts handles on corners and midpoints of a centered frame', () => {
    const points = frameHandlePoints(100, 60, ['tl', 'r', 'b'])
    expect(points).toEqual([
      { position: 'tl', x: -50, y: -30 },
      { position: 'r', x: 50, y: 0 },
      { position: 'b', x: 0, y: 30 },
    ])
  })

  it('runs edge lines on from the corners toward each extended side', () => {
    expect(frameExtensionRays(100, 60, ['top'])).toEqual([
      { x: -50, y: -30, dx: 0, dy: -1 },
      { x: 50, y: -30, dx: 0, dy: -1 },
    ])
    expect(frameExtensionRays(100, 60, ['left', 'right'])).toHaveLength(4)
  })

  it('clips a segment to a rectangle (Liang–Barsky)', () => {
    const rect = { left: 0, top: 0, right: 100, bottom: 100 }
    expect(clipSegmentToRect({ x: 50, y: 50 }, { x: 50, y: -950 }, rect)).toEqual([0, 0.05])
    // Starts outside, enters, leaves.
    const span = clipSegmentToRect({ x: -50, y: 10 }, { x: 150, y: 10 }, rect)
    expect(span?.[0]).toBeCloseTo(0.25)
    expect(span?.[1]).toBeCloseTo(0.75)
    // Misses entirely.
    expect(clipSegmentToRect({ x: -50, y: -10 }, { x: 150, y: -10 }, rect)).toBeNull()
    expect(clipSegmentToRect({ x: 150, y: 50 }, { x: 250, y: 50 }, rect)).toBeNull()
  })

  it('draws the outline as four edges and trims construction lines with the clipper', () => {
    const geometry = frameGeometry(100, 60, spec({ handles: [], extend: ['top'] }), {
      reach: 1000,
      clipRay: () => [0, 0.1],
    })
    expect(geometry.segments).toHaveLength(6)
    expect(geometry.segments[4]).toEqual({ x1: -50, y1: -30, x2: -50, y2: -130 })
  })

  it('leaves the outline off when asked and skips rays the clipper rejects', () => {
    const geometry = frameGeometry(100, 60, spec({ outline: false, extend: ['top', 'bottom'] }), { clipRay: () => null })
    expect(geometry.segments).toHaveLength(0)
    expect(geometry.handles).toHaveLength(4)
  })

  it('cuts lines out of open handles so the art shows through', () => {
    const geometry = frameGeometry(100, 60, spec({ handles: ['tl', 't'], handleFill: 'open', handleSize: 10 }))
    const top = geometry.segments.filter((segment) => segment.y1 === -30 && segment.y2 === -30)
    // Top edge from -50 to 50, minus [-55,-45] (tl) and [-5,5] (t).
    expect(top).toEqual([
      { x1: -45, y1: -30, x2: -5, y2: -30 },
      { x1: 5, y1: -30, x2: 50, y2: -30 },
    ])
    // The left edge loses its top end to the corner handle.
    const left = geometry.segments.filter((segment) => segment.x1 === -50 && segment.x2 === -50)
    expect(left).toEqual([{ x1: -50, y1: -25, x2: -50, y2: 30 }])
  })

  it('keeps lines whole under solid and knockout handles', () => {
    const geometry = frameGeometry(100, 60, spec({ handles: ['tl'], handleFill: 'knockout' }))
    expect(geometry.segments).toHaveLength(4)
  })

  it('makes square-capped dash patterns', () => {
    expect(frameDashPattern('solid', 2)).toEqual([])
    expect(frameDashPattern('dashed', 2)).toEqual([8, 10])
    expect(frameDashPattern('dotted', 2)).toEqual([0, 5])
  })
})

describe('drawing and placing frames', () => {
  it('builds a rectangle from a drag, square with shift, from center with alt', () => {
    expect(frameRectFromDrag({ x: 100, y: 100 }, { x: 40, y: 160 })).toEqual({ left: 40, top: 100, width: 60, height: 60 })
    expect(frameRectFromDrag({ x: 0, y: 0 }, { x: 30, y: 10 }, { square: true })).toEqual({ left: 0, top: 0, width: 30, height: 30 })
    expect(frameRectFromDrag({ x: 50, y: 50 }, { x: 60, y: 70 }, { fromCenter: true })).toEqual({ left: 40, top: 30, width: 20, height: 40 })
  })

  it('snaps to the nearest target inside the threshold', () => {
    expect(snapToTargets(103, [0, 100, 110], 5)).toEqual({ value: 100, guide: 100 })
    expect(snapToTargets(108, [0, 100, 110], 5)).toEqual({ value: 110, guide: 110 })
    expect(snapToTargets(50, [0, 100], 5)).toEqual({ value: 50, guide: null })
  })

  it('fits a frame to a rotated layer by its corners', () => {
    const rect = new FrameHandles({ left: 200, top: 100, width: 120, height: 80, angle: 30 })
    const box = frameBoxForCorners(rect.getCoords(), 30)
    expect(box.width).toBeCloseTo(120)
    expect(box.height).toBeCloseTo(80)
    expect(box.left).toBeCloseTo(200)
    expect(box.top).toBeCloseTo(100)
    expect(box.angle).toBe(30)
  })
})

describe('FrameHandles layer', () => {
  it('serializes its spec and revives through the class registry', async () => {
    const frame = new FrameHandles({ left: 10, top: 20, width: 300, height: 200, fill: '#ff0000', frame: { handles: ['tl'], extend: ['left'] } })
    expect(isFrameHandles(frame)).toBe(true)
    expect(readFrameSpec(frame)?.handles).toEqual(['tl'])
    const json = frame.toObject() as unknown as Record<string, unknown>
    expect(json.type).toBe('FrameHandles')
    expect((json.frame as FrameSpec).extend).toEqual(['left'])
    const revived = await reviveSerializedObject(JSON.parse(JSON.stringify(json)) as Record<string, unknown>)
    expect(isFrameHandles(revived)).toBe(true)
    expect(readFrameSpec(revived)).toEqual(frame.frame)
    expect(revived.fill).toBe('#ff0000')
    expect(revived.width).toBe(300)
  })

  it('has no stroke padding: the bounding box is the frame', () => {
    const frame = new FrameHandles({ left: 0, top: 0, width: 300, height: 200 })
    expect(frame.strokeWidth).toBe(0)
    expect(frame.fill).toBe(FRAME_COLOR)
    expect(frame.getBoundingRect()).toMatchObject({ left: 0, top: 0, width: 300, height: 200 })
  })

  it('exports SVG with poster-pixel weights and lines trimmed to the poster', () => {
    const frame = new FrameHandles({
      left: 100,
      top: 100,
      width: 200,
      height: 100,
      scaleX: 2,
      frame: { weight: 3, handleSize: 10, handles: ['tl', 'br'], handleFill: 'open', extend: ['top'] },
    })
    // Only the poster rectangle is read from the canvas.
    frame.canvas = { viewportTransform: [1, 0, 0, 1, 0, 0], width: 1000, height: 800 } as unknown as Canvas
    const svg = frame.toSVG()
    expect(svg).toContain('scale(0.5 1)')
    expect(svg).toContain('stroke-width="3"')
    expect(svg).toContain('stroke-linecap="square"')
    expect((svg.match(/<rect /g) ?? []).length).toBe(2)
    expect(svg).toContain('fill="none"')
    // Frame is 400 × 100 drawn at top-left (100, 100): the top-left corner sits at (-200, -50)
    // in frame space. The line up from it reaches the poster top at y = -150 and stops
    // short of the open handle at y = -55.
    expect(svg).toContain('M-200 -150L-200 -55')
  })

  it('keeps extended frames on screen so their construction lines are never culled', () => {
    const frame = new FrameHandles({ left: -5000, top: -5000, width: 10, height: 10, frame: { extend: ['right'] } })
    expect(frame.isOnScreen()).toBe(true)
    frame.set({ frame: { ...frame.frame, extend: [] } })
    expect(frame.isOnScreen()).toBe(false)
  })
})
