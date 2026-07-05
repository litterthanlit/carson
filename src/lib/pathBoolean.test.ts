import { describe, expect, it } from 'vitest'
import type { Polygon } from 'martinez-polygon-clipping'
import {
  booleanSubtract,
  booleanUnion,
  multiPolygonToPathData,
  normalizeToMultiPolygon,
} from './pathBoolean'

const square = (x: number, y: number, size: number): Polygon => [
  [
    [x, y],
    [x + size, y],
    [x + size, y + size],
    [x, y + size],
  ],
]

describe('pathBoolean', () => {
  it('unions overlapping squares into one polygon', () => {
    const result = booleanUnion([square(0, 0, 100), square(50, 50, 100)])
    expect(result.length).toBeGreaterThan(0)
    const { pathData } = multiPolygonToPathData(result)
    expect(pathData[0][0]).toBe('M')
    expect(pathData.some((command) => command[0] === 'Z')).toBe(true)
  })

  it('subtracts the second square from the first', () => {
    const result = booleanSubtract(square(0, 0, 100), square(50, 50, 100))
    const polygons = normalizeToMultiPolygon(result)
    expect(polygons.length).toBeGreaterThan(0)
    const { pathData, left, top } = multiPolygonToPathData(polygons)
    expect(left).toBe(0)
    expect(top).toBe(0)
    expect(pathData.length).toBeGreaterThan(2)
  })

  it('normalizes single-polygon geometry', () => {
    const geometry = square(10, 10, 40)
    expect(normalizeToMultiPolygon(geometry)).toEqual([geometry])
  })

  it('builds fabric-ready path data from multipolygon output', () => {
    const { pathData, left, top } = multiPolygonToPathData([square(20, 30, 50)])
    expect(left).toBe(20)
    expect(top).toBe(30)
    expect(pathData).toEqual([
      ['M', 0, 0],
      ['L', 50, 0],
      ['L', 50, 50],
      ['L', 0, 50],
      ['Z'],
    ])
  })
})
