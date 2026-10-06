import { describe, expect, it } from 'vitest'
import { BUILDING_GRID_SIZE, INTERSECTION_GRID_SIZE, MAX_ROUNDS, POLICE_CAR_COUNT } from './board'

describe('board constants', () => {
  it('follows the official City Chase layout', () => {
    expect(BUILDING_GRID_SIZE).toBe(5)
    expect(INTERSECTION_GRID_SIZE).toBe(4)
    expect(MAX_ROUNDS).toBe(11)
    expect(POLICE_CAR_COUNT).toBe(3)
  })
})
