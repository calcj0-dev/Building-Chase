import { describe, expect, it } from 'vitest'
import {
  IllegalActionError,
  applyAction,
  createGame,
  currentRole,
  getLegalActions,
  runnerMoveTargets,
  traceColorForRound,
} from './game'
import { applyAll, hideAt, placeAll, playRounds, searchAll } from './testUtils'
import type { GameState } from './types'

// ビル ID           交差点 ID
//  0  1  2  3  4      0  1  2  3
//  5  6  7  8  9      4  5  6  7
// 10 11 12 13 14      8  9 10 11
// 15 16 17 18 19     12 13 14 15
// 20 21 22 23 24

// 逃亡者のルートと重ならない位置にヘリコプターを置き、毎ラウンド無関係なビルを捜索させる
const FAR_HELICOPTERS: [number, number, number] = [15, 12, 3]
const IDLE_SEARCHES: [number, number, number] = [24, 20, 4]

/** ヘリコプターの配置が終わり、逃亡者がスタート地点を選ぶところ */
function hidePhase(): GameState {
  return placeAll(FAR_HELICOPTERS)
}

describe('createGame', () => {
  it('starts in the setup phase with nothing placed', () => {
    const s = createGame()
    expect(s.phase).toBe('setup')
    expect(s.round).toBe(0)
    expect(s.helicopters).toEqual([null, null, null])
    expect(s.runnerPosition).toBeNull()
    expect(s.traces).toEqual([])
    expect(currentRole(s)).toBe('police')
  })
})

describe('traceColorForRound', () => {
  it('marks round 1 yellow, round 6 red, and the rest blue', () => {
    expect(traceColorForRound(1)).toBe('yellow')
    expect(traceColorForRound(6)).toBe('red')
    for (const r of [2, 3, 4, 5, 7, 8, 9, 10, 11]) expect(traceColorForRound(r)).toBe('blue')
  })
})

describe('setup phase', () => {
  it('lets police place each helicopter on any free intersection', () => {
    expect(getLegalActions(createGame())).toHaveLength(3 * 16)
  })

  it('lets the runner hide after all 3 helicopters are placed', () => {
    const s = placeAll([0, 5, 10])
    expect(s.helicopters).toEqual([0, 5, 10])
    expect(s.phase).toBe('hide')
    expect(s.round).toBe(0)
    expect(currentRole(s)).toBe('runner')
  })

  it('allows placing helicopters in any order', () => {
    const s = applyAll(createGame(), [
      { type: 'placePolice', helicopter: 2, intersection: 7 },
      { type: 'placePolice', helicopter: 0, intersection: 1 },
    ])
    expect(s.phase).toBe('setup')
    expect(s.helicopters).toEqual([1, null, 7])
  })

  it('rejects two helicopters on the same intersection', () => {
    const s = applyAction(createGame(), { type: 'placePolice', helicopter: 0, intersection: 4 })
    expect(() => applyAction(s, { type: 'placePolice', helicopter: 1, intersection: 4 })).toThrow(
      IllegalActionError,
    )
  })

  it('rejects placing the same helicopter twice', () => {
    const s = applyAction(createGame(), { type: 'placePolice', helicopter: 0, intersection: 4 })
    expect(() => applyAction(s, { type: 'placePolice', helicopter: 0, intersection: 5 })).toThrow(
      IllegalActionError,
    )
  })

  it('rejects out-of-range intersections', () => {
    expect(() =>
      applyAction(createGame(), { type: 'placePolice', helicopter: 0, intersection: 16 }),
    ).toThrow(IllegalActionError)
  })

  it('rejects runner moves before setup is complete', () => {
    expect(() => applyAction(createGame(), { type: 'runnerMove', building: 0 })).toThrow(
      IllegalActionError,
    )
  })
})

describe('hiding at the start point', () => {
  it('lets the runner hide in any of the 25 buildings', () => {
    expect(runnerMoveTargets(hidePhase())).toHaveLength(25)
  })

  it('does not use a trace, and police act first in round 1', () => {
    const s = hideAt(hidePhase(), 12)
    expect(s.runnerPosition).toBe(12)
    expect(s.traces).toEqual([])
    expect(s.phase).toBe('police')
    expect(s.round).toBe(1)
    expect(currentRole(s)).toBe('police')
  })

  it('lets police search the start point before the runner moves', () => {
    // ヘリコプター2 は交差点3（ビル 3, 4, 8, 9）。逃亡者は 8 に隠れた
    const s = applyAction(hideAt(hidePhase(), 8), {
      type: 'policeSearch',
      helicopter: 2,
      building: 8,
    })
    expect(s.winner).toBe('police')
    expect(s.endReason).toBe('arrested')
  })
})

describe('runner phase', () => {
  /** 12 に隠れ、Round 1 の警察が行動し終えたところ */
  function runnerTurn(): GameState {
    return searchAll(hideAt(hidePhase(), 12), IDLE_SEARCHES)
  }

  it('comes after the police phase of the same round', () => {
    const s = runnerTurn()
    expect(s.phase).toBe('runner')
    expect(s.round).toBe(1)
  })

  it('only allows orthogonally adjacent buildings', () => {
    const s = runnerTurn()
    expect([...runnerMoveTargets(s)].sort((a, b) => a - b)).toEqual([7, 11, 13, 17])
    expect(() => applyAction(s, { type: 'runnerMove', building: 6 })).toThrow(IllegalActionError) // 斜め
    expect(() => applyAction(s, { type: 'runnerMove', building: 14 })).toThrow(IllegalActionError) // 2マス先
  })

  it('leaves the yellow trace at the start point on the first move', () => {
    const s = applyAction(runnerTurn(), { type: 'runnerMove', building: 13 })
    expect(s.runnerPosition).toBe(13)
    expect(s.traces).toEqual([{ round: 1, building: 12, found: false }])
    expect(s.phase).toBe('police')
    expect(s.round).toBe(2)
    expect(currentRole(s)).toBe('police')
  })

  it('never allows returning to a building with a trace', () => {
    let s = playRounds(hidePhase(), [12, 13], IDLE_SEARCHES)
    s = searchAll(s, IDLE_SEARCHES)
    expect(runnerMoveTargets(s)).not.toContain(12)
    expect(() => applyAction(s, { type: 'runnerMove', building: 12 })).toThrow(IllegalActionError)
    s = applyAction(s, { type: 'runnerMove', building: 14 })
    expect(s.traces.map((t) => t.building)).toEqual([12, 13])
    expect(s.runnerPosition).toBe(14)
  })

  it('numbers traces by the round in which the runner left the building', () => {
    // スタート 0 → 1 → 2 → 7 → 6 → 5 → 10（6回移動）
    const s = playRounds(hidePhase(), [0, 1, 2, 7, 6, 5, 10], IDLE_SEARCHES)
    expect(s.traces.map((t) => [t.round, t.building])).toEqual([
      [1, 0], // 黄: スタート地点
      [2, 1],
      [3, 2],
      [4, 7],
      [5, 6],
      [6, 5], // 赤: 5回移動した後にいたビル
    ])
    expect(s.runnerPosition).toBe(10)
    expect(s.phase).toBe('police')
    expect(s.round).toBe(7)
  })
})

describe('police phase', () => {
  function policePhase(): GameState {
    // ヘリコプター: 0, 5, 10 / 逃亡者: 24 に隠れた直後（Round 1 の警察フェーズ）
    return hideAt(placeAll([0, 5, 10]), 24)
  }

  it('offers orthogonal moves to free intersections plus 4 searches per helicopter', () => {
    const actions = getLegalActions(policePhase())
    const h0 = actions.filter((a) => 'helicopter' in a && a.helicopter === 0)
    // 交差点 0 の隣は 1 と 4（どちらも空き）+ 捜索 4棟
    expect(h0).toHaveLength(2 + 4)
    const h1 = actions.filter((a) => 'helicopter' in a && a.helicopter === 1)
    // 交差点 5 の隣は 1, 4, 6, 9（すべて空き）+ 捜索 4棟
    expect(h1).toHaveLength(4 + 4)
  })

  it('moves a helicopter to an adjacent free intersection', () => {
    const s = applyAction(policePhase(), { type: 'policeMove', helicopter: 0, intersection: 1 })
    expect(s.helicopters).toEqual([1, 5, 10])
    expect(s.actedHelicopters).toEqual([true, false, false])
    expect(s.phase).toBe('police')
  })

  it('rejects diagonal moves, long moves and occupied intersections', () => {
    const s = policePhase()
    expect(() => applyAction(s, { type: 'policeMove', helicopter: 1, intersection: 0 })).toThrow(
      IllegalActionError,
    ) // 斜め
    expect(() => applyAction(s, { type: 'policeMove', helicopter: 0, intersection: 2 })).toThrow(
      IllegalActionError,
    ) // 2マス先
    const s2 = applyAction(s, { type: 'policeMove', helicopter: 0, intersection: 4 })
    expect(() => applyAction(s2, { type: 'policeMove', helicopter: 1, intersection: 4 })).toThrow(
      IllegalActionError,
    ) // 使用中
  })

  it('lets a helicopter move into an intersection another helicopter just left', () => {
    let s = applyAction(policePhase(), { type: 'policeMove', helicopter: 1, intersection: 6 })
    s = applyAction(s, { type: 'policeMove', helicopter: 0, intersection: 1 })
    s = applyAction(s, { type: 'policeMove', helicopter: 2, intersection: 9 })
    expect(s.helicopters).toEqual([1, 6, 9])
  })

  it('rejects searching a building not around the helicopter', () => {
    expect(() =>
      applyAction(policePhase(), { type: 'policeSearch', helicopter: 0, building: 12 }),
    ).toThrow(IllegalActionError)
  })

  it('rejects a second action from the same helicopter in one round', () => {
    const s = applyAction(policePhase(), { type: 'policeMove', helicopter: 0, intersection: 1 })
    expect(() => applyAction(s, { type: 'policeSearch', helicopter: 0, building: 1 })).toThrow(
      IllegalActionError,
    )
    expect(getLegalActions(s).some((a) => 'helicopter' in a && a.helicopter === 0)).toBe(false)
  })

  it('lets helicopters act in any order', () => {
    let s = applyAction(policePhase(), { type: 'policeSearch', helicopter: 2, building: 12 })
    s = applyAction(s, { type: 'policeSearch', helicopter: 0, building: 0 })
    expect(s.actedHelicopters).toEqual([true, false, true])
  })

  it('hands over to the runner in the same round after all 3 helicopters act', () => {
    const s = searchAll(policePhase(), [0, 6, 12])
    expect(s.phase).toBe('runner')
    expect(s.round).toBe(1)
    expect(s.actedHelicopters).toEqual([true, true, true])
  })

  it('resets the helicopters after the runner moves', () => {
    const s = applyAction(searchAll(policePhase(), [0, 6, 12]), {
      type: 'runnerMove',
      building: 23,
    })
    expect(s.phase).toBe('police')
    expect(s.round).toBe(2)
    expect(s.actedHelicopters).toEqual([false, false, false])
  })

  it('rejects police actions during the runner phases', () => {
    expect(() =>
      applyAction(hidePhase(), { type: 'policeMove', helicopter: 0, intersection: 11 }),
    ).toThrow(IllegalActionError)
    const runner = searchAll(hideAt(hidePhase(), 0), IDLE_SEARCHES)
    expect(() =>
      applyAction(runner, { type: 'policeMove', helicopter: 0, intersection: 11 }),
    ).toThrow(IllegalActionError)
  })
})

describe('search', () => {
  it('finds nothing in an empty building', () => {
    const s = applyAction(hideAt(placeAll([0, 5, 10]), 24), {
      type: 'policeSearch',
      helicopter: 0,
      building: 0,
    })
    expect(s.searchLog).toEqual([{ round: 1, helicopter: 0, building: 0, outcome: 'nothing' }])
    expect(s.phase).toBe('police')
  })

  it('finds the start point trace after the first move', () => {
    // 逃亡者: 6 に隠れて 7 へ。Round 2 にヘリコプター0（交差点0）がビル6を捜索
    let s = playRounds(placeAll([0, 3, 15]), [6, 7], [0, 3, 24])
    s = applyAction(s, { type: 'policeSearch', helicopter: 0, building: 6 })
    expect(s.traces).toEqual([{ round: 1, building: 6, found: true }])
    expect(s.searchLog.at(-1)).toMatchObject({ round: 2, outcome: 'trace' })
  })

  it('reports a trace again when searching an already found trace', () => {
    let s = playRounds(placeAll([0, 3, 15]), [6, 7], [0, 3, 24])
    s = applyAction(s, { type: 'policeSearch', helicopter: 0, building: 6 })
    s = applyAction(s, { type: 'policeMove', helicopter: 1, intersection: 2 })
    s = applyAction(s, { type: 'policeSearch', helicopter: 2, building: 24 })
    s = applyAction(s, { type: 'runnerMove', building: 8 })
    s = applyAction(s, { type: 'policeSearch', helicopter: 0, building: 6 })
    expect(s.searchLog.at(-1)?.outcome).toBe('trace')
    expect(s.traces[0].found).toBe(true)
  })

  it('finds the runner (not a trace) in the building it is in now', () => {
    let s = playRounds(placeAll([0, 3, 15]), [1, 6], [0, 3, 24])
    s = applyAction(s, { type: 'policeSearch', helicopter: 0, building: 6 })
    expect(s.searchLog.at(-1)?.outcome).toBe('runner')
  })

  it('arrests the runner and ends the game immediately', () => {
    let s = playRounds(placeAll([0, 3, 15]), [1, 6], [0, 3, 24])
    s = applyAction(s, { type: 'policeSearch', helicopter: 0, building: 6 })
    expect(s.phase).toBe('ended')
    expect(s.winner).toBe('police')
    expect(s.endReason).toBe('arrested')
    expect(currentRole(s)).toBeNull()
    expect(getLegalActions(s)).toEqual([])
    expect(() => applyAction(s, { type: 'policeSearch', helicopter: 1, building: 3 })).toThrow(
      IllegalActionError,
    )
  })
})

describe('game end', () => {
  // スタート + 11回の移動
  const ESCAPE_PATH = [0, 1, 2, 7, 6, 5, 10, 11, 12, 13, 14, 9]

  it('gives police a final search after the 11th move', () => {
    const s = playRounds(hidePhase(), ESCAPE_PATH, IDLE_SEARCHES)
    expect(s.traces).toHaveLength(11) // 痕跡 11 個をすべて使う
    expect(s.phase).toBe('police')
    expect(s.round).toBe(12) // 最後の捜索
    expect(s.runnerPosition).toBe(9)
  })

  it('lets the runner escape when the final search fails', () => {
    const s = searchAll(playRounds(hidePhase(), ESCAPE_PATH, IDLE_SEARCHES), IDLE_SEARCHES)
    expect(s.phase).toBe('ended')
    expect(s.winner).toBe('runner')
    expect(s.endReason).toBe('escaped')
    expect(s.traces[0]).toMatchObject({ round: 1, building: 0 })
    expect(s.traces[5]).toMatchObject({ round: 6, building: 5 })
  })

  it('can still arrest the runner in the final search', () => {
    let s = playRounds(hidePhase(), ESCAPE_PATH, IDLE_SEARCHES)
    // ヘリコプター2 は交差点3（ビル 3, 4, 8, 9）にいる
    s = applyAction(s, { type: 'policeSearch', helicopter: 2, building: 9 })
    expect(s.winner).toBe('police')
    expect(s.endReason).toBe('arrested')
  })

  it('declares the runner surrounded when no move is possible', () => {
    // 5 に隠れて 6 → 1 → 0 と動くと、ビル0の隣（1, 5）はどちらも痕跡あり
    let s = playRounds(hidePhase(), [5, 6, 1, 0], IDLE_SEARCHES)
    expect(s.phase).toBe('police') // Round 4 の警察はまだ行動できる
    s = searchAll(s, IDLE_SEARCHES)
    expect(s.phase).toBe('ended')
    expect(s.winner).toBe('police')
    expect(s.endReason).toBe('surrounded')
    expect(s.round).toBe(4)
  })
})

describe('immutability', () => {
  it('never mutates the given state', () => {
    const s0 = searchAll(hideAt(hidePhase(), 3), IDLE_SEARCHES)
    const snapshot = structuredClone(s0)
    const s1 = applyAction(s0, { type: 'runnerMove', building: 8 })
    applyAction(s1, { type: 'policeMove', helicopter: 0, intersection: 11 })
    expect(s0).toEqual(snapshot)
    expect(s1.traces).toHaveLength(1)
    expect(s1.actedHelicopters).toEqual([false, false, false])
  })
})
