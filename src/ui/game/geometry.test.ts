import { describe, expect, it } from 'vitest'
import { ALL_BUILDINGS } from '../../core'
import {
  HEIGHT_LARGE,
  WORLD_SIZE,
  buildingsBackToFront,
  project,
  roofCenter,
  showsRightWall,
  viewBox,
} from './geometry'

describe('board geometry', () => {
  it('keeps left and right straight in the front view', () => {
    const left = project('front', 0, 300)
    const right = project('front', WORLD_SIZE, 300)
    expect(left.y).toBeCloseTo(right.y)
  })

  it('turns to the right in the angled view: the right side comes closer', () => {
    const left = project('angle', 0, 300)
    const right = project('angle', WORLD_SIZE, 300)
    expect(right.y).toBeGreaterThan(left.y)
    expect(showsRightWall('angle')).toBe(true)
    expect(showsRightWall('front')).toBe(false)
  })

  it('draws buildings from back to front', () => {
    for (const mode of ['front', 'angle'] as const) {
      const order = buildingsBackToFront(mode)
      expect([...order].sort((a, b) => a - b)).toEqual([...ALL_BUILDINGS])
      const ys = order.map((b) => roofCenter(mode, b).y)
      // 奥のビル（上の列）が先、手前のビル（下の列）が後
      expect(order.indexOf(0)).toBeLessThan(order.indexOf(20))
      expect(ys[0]).toBeLessThan(ys[ys.length - 1])
    }
  })

  it('fits the whole board, including the tallest roofs, in the view box', () => {
    for (const mode of ['front', 'angle'] as const) {
      const [left, top, width, height] = viewBox(mode).split(' ').map(Number)
      for (const x of [0, WORLD_SIZE]) {
        for (const y of [0, WORLD_SIZE]) {
          for (const z of [0, HEIGHT_LARGE]) {
            const p = project(mode, x, y, z)
            expect(p.x).toBeGreaterThanOrEqual(left)
            expect(p.x).toBeLessThanOrEqual(left + width)
            expect(p.y).toBeGreaterThanOrEqual(top)
            expect(p.y).toBeLessThanOrEqual(top + height)
          }
        }
      }
    }
  })
})
