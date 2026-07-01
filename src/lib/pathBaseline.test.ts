import { describe, expect, it } from 'vitest'
import { Ellipse, Path } from 'fabric'
import { HISTORY_PROPS } from './editorConstants'
import { movePathPoint } from './pathEditing'
import {
  addTreatment,
  captureTransformBaseline,
  readTreatments,
  renderTreatmentStack,
} from './treatments'

describe('path baseline (Phase B0)', () => {
  it('stores scatter and slice treatments on a Path', () => {
    const path = new Path('M 0 0 L 100 40 L 200 10', {
      left: 50,
      top: 80,
      stroke: '#111111',
      strokeWidth: 3,
      fill: '',
    })
    path.set({ kind: 'shape', name: 'Pen stroke' } as Partial<Path>)

    addTreatment(path, 'scatter', { distance: 46, rotation: 18, scale: 0.14 }, 42)
    addTreatment(path, 'slice', { direction: 0, pieces: 5, gap: 9 }, 7)

    const stack = readTreatments(path)
    expect(stack).toHaveLength(2)
    expect(stack.find((item) => item.type === 'scatter')?.seed).toBe(42)
    expect(stack.find((item) => item.type === 'slice')?.params.pieces).toBe(5)
  })

  it('applies scatter transform without throwing on paths', () => {
    const path = new Path('M 0 0 L 80 20', { left: 10, top: 20, stroke: '#111', fill: '' })
    captureTransformBaseline(path)
    addTreatment(path, 'scatter', { distance: 46, rotation: 18, scale: 0.14 }, 1)
    const beforeLeft = path.left
    expect(() => renderTreatmentStack(path)).not.toThrow()
    expect(path.left).not.toBe(beforeLeft)
    expect(readTreatments(path)).toHaveLength(1)
  })

  it('round-trips stroke dash and treatments through canvas serialization props', () => {
    const ellipse = new Ellipse({ left: 120, top: 140, rx: 60, ry: 40, stroke: '#111111', strokeWidth: 4, fill: '' })
    ellipse.set({
      strokeDashArray: [12, 6],
      kind: 'shape',
      name: 'Ellipse',
    } as Partial<Ellipse>)
    addTreatment(ellipse, 'scatter', { distance: 20, rotation: 10, scale: 0.1 }, 99)

    const snapshot = ellipse.toObject(HISTORY_PROPS as never) as unknown as Record<string, unknown>
    expect(snapshot.strokeDashArray).toEqual([12, 6])
    expect(snapshot.strokeWidth).toBe(4)
    expect(Array.isArray(snapshot.treatments)).toBe(true)
    expect((snapshot.treatments as { type: string }[])[0]?.type).toBe('scatter')
  })

  it('keeps path geometry editable after anchor move on a rotated path', () => {
    const path = new Path('M 0 0 C 20 20 40 0 60 30', {
      left: 100,
      top: 100,
      angle: 25,
      stroke: '#111',
      fill: '',
    })
    const anchor = { commandIndex: 1, x: 60, y: 30, role: 'anchor' as const }
    const next = movePathPoint(path.path as Parameters<typeof movePathPoint>[0], anchor, 70, 40)
    path._setPath(next as Path['path'], true)
    path.setCoords()

    expect(path.path[1]).toEqual(['C', 20, 20, 40, 0, 70, 40])
    expect(path.angle).toBe(25)
  })
})
