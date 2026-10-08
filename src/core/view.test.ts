import { describe, expect, it } from 'vitest'
import { applyAction } from './game'
import { placeAll, playRounds, searchAll } from './testUtils'
import { getView } from './view'

// ビル ID           交差点 ID
//  0  1  2  3  4      0  1  2  3
//  5  6  7  8  9      4  5  6  7
// 10 11 12 13 14      8  9 10 11
// 15 16 17 18 19     12 13 14 15
// 20 21 22 23 24

const IDLE_SEARCHES: [number, number, number] = [24, 20, 4]

describe('getView', () => {
  it('shows the runner everything', () => {
    const s = playRounds(placeAll([15, 12, 3]), [0, 1, 2], IDLE_SEARCHES)
    const v = getView(s, 'runner')
    expect(v.runnerPosition).toBe(2)
    expect(v.traces).toEqual([
      { building: 0, color: 'yellow', round: 1, found: false },
      { building: 1, color: 'blue', round: 2, found: false },
      { building: 2, color: 'blue', round: 3, found: false },
    ])
    expect(v.helicopters).toEqual([15, 12, 3])
  })

  it('hides the runner position and unfound traces from police', () => {
    const s = playRounds(placeAll([15, 12, 3]), [0, 1, 2], IDLE_SEARCHES)
    const v = getView(s, 'police')
    expect(v.runnerPosition).toBeNull()
    expect(v.traces).toEqual([])
    expect(v.traceCount).toBe(3)
    expect(JSON.stringify(v)).not.toContain('"building":0,') // 未発見の痕跡が漏れていない
  })

  it('shows police found traces, numbering only yellow and red', () => {
    // 逃亡者: 5 → 0 → 1 → 2 → 7 → 12 → 11 → 10
    // ヘリコプター0: 交差点0（ビル 0, 1, 5, 6）/ ヘリコプター1: 交差点6（ビル 7, 8, 12, 13）/ ヘリコプター2: 交差点12
    // Round 1〜6 は逃亡者が通らないビル（6, 8, 20）を捜索して待機
    let s = playRounds(placeAll([0, 6, 12]), [5, 0, 1, 2, 7, 12], [6, 8, 20])
    s = applyAction(s, { type: 'runnerMove', building: 11 })
    s = applyAction(s, { type: 'policeSearch', helicopter: 0, building: 5 }) // 黄（1番目）
    s = applyAction(s, { type: 'policeSearch', helicopter: 1, building: 12 }) // 赤（6番目）
    s = applyAction(s, { type: 'policeSearch', helicopter: 2, building: 20 })
    s = applyAction(s, { type: 'runnerMove', building: 10 })
    s = applyAction(s, { type: 'policeSearch', helicopter: 0, building: 0 }) // 青（2番目）

    const v = getView(s, 'police')
    expect(v.runnerPosition).toBeNull()
    expect(v.traces).toEqual([
      { building: 5, color: 'yellow', round: 1, found: true },
      { building: 0, color: 'blue', round: null, found: true },
      { building: 12, color: 'red', round: 6, found: true },
    ])
  })

  it('reveals everything to police once the game has ended', () => {
    let s = placeAll([0, 3, 15])
    s = applyAction(s, { type: 'runnerMove', building: 7 })
    s = searchAll(s, [0, 3, 24])
    s = applyAction(s, { type: 'runnerMove', building: 6 })
    s = applyAction(s, { type: 'policeSearch', helicopter: 0, building: 6 })
    const v = getView(s, 'police')
    expect(v.phase).toBe('ended')
    expect(v.runnerPosition).toBe(6)
    expect(v.traces).toEqual([
      { building: 7, color: 'yellow', round: 1, found: false },
      { building: 6, color: 'blue', round: 2, found: false },
    ])
  })

  it('returns copies that do not share arrays with the state', () => {
    const s = placeAll([0, 5, 10])
    const v = getView(s, 'police')
    v.helicopters[0] = 15
    expect(s.helicopters[0]).toBe(0)
  })
})
