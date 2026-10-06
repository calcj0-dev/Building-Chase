import { describe, expect, it } from 'vitest'
import {
  ALL_BUILDINGS,
  ALL_INTERSECTIONS,
  BUILDING_GRID_SIZE,
  BUILDING_NEIGHBORS,
  BUILDINGS_AROUND_INTERSECTION,
  INTERSECTION_GRID_SIZE,
  INTERSECTION_NEIGHBORS,
  INTERSECTIONS_AROUND_BUILDING,
  MAX_ROUNDS,
  POLICE_CAR_COUNT,
  buildingAt,
  buildingPoint,
  intersectionAt,
  intersectionPoint,
} from './board'

// ビル ID           交差点 ID
//  0  1  2  3  4      0  1  2  3
//  5  6  7  8  9      4  5  6  7
// 10 11 12 13 14      8  9 10 11
// 15 16 17 18 19     12 13 14 15
// 20 21 22 23 24

describe('board constants', () => {
  it('follows the official City Chase layout', () => {
    expect(BUILDING_GRID_SIZE).toBe(5)
    expect(INTERSECTION_GRID_SIZE).toBe(4)
    expect(ALL_BUILDINGS).toHaveLength(25)
    expect(ALL_INTERSECTIONS).toHaveLength(16)
    expect(MAX_ROUNDS).toBe(11)
    expect(POLICE_CAR_COUNT).toBe(3)
  })
})

describe('coordinates', () => {
  it('converts between ids and grid points', () => {
    expect(buildingAt(2, 3)).toBe(13)
    expect(buildingPoint(13)).toEqual({ row: 2, col: 3 })
    expect(intersectionAt(3, 1)).toBe(13)
    expect(intersectionPoint(13)).toEqual({ row: 3, col: 1 })
  })

  it('returns null outside the grid', () => {
    expect(buildingAt(-1, 0)).toBeNull()
    expect(buildingAt(0, 5)).toBeNull()
    expect(intersectionAt(4, 0)).toBeNull()
  })
})

describe('building neighbors', () => {
  it('only includes orthogonal neighbors', () => {
    expect([...BUILDING_NEIGHBORS[0]].sort((a, b) => a - b)).toEqual([1, 5])
    expect([...BUILDING_NEIGHBORS[2]].sort((a, b) => a - b)).toEqual([1, 3, 7])
    expect([...BUILDING_NEIGHBORS[12]].sort((a, b) => a - b)).toEqual([7, 11, 13, 17])
  })
})

describe('intersection neighbors', () => {
  it('only includes orthogonal neighbors', () => {
    expect([...INTERSECTION_NEIGHBORS[0]].sort((a, b) => a - b)).toEqual([1, 4])
    expect([...INTERSECTION_NEIGHBORS[5]].sort((a, b) => a - b)).toEqual([1, 4, 6, 9])
    expect([...INTERSECTION_NEIGHBORS[15]].sort((a, b) => a - b)).toEqual([11, 14])
  })
})

describe('buildings around intersection', () => {
  it('lists the 4 surrounding buildings', () => {
    expect(BUILDINGS_AROUND_INTERSECTION[0]).toEqual([0, 1, 5, 6])
    expect(BUILDINGS_AROUND_INTERSECTION[5]).toEqual([6, 7, 11, 12])
    expect(BUILDINGS_AROUND_INTERSECTION[15]).toEqual([18, 19, 23, 24])
  })

  it('maps each building back to the intersections that can search it', () => {
    expect(INTERSECTIONS_AROUND_BUILDING[0]).toEqual([0]) // 角
    expect(INTERSECTIONS_AROUND_BUILDING[2]).toEqual([1, 2]) // 辺
    expect(INTERSECTIONS_AROUND_BUILDING[12]).toEqual([5, 6, 9, 10]) // 内側
  })
})
