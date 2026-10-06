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
import { applyAll, placeAll, playRounds, searchAll } from './testUtils'
import type { GameState } from './types'

// ビル ID           交差点 ID
//  0  1  2  3  4      0  1  2  3
//  5  6  7  8  9      4  5  6  7
// 10 11 12 13 14      8  9 10 11
// 15 16 17 18 19     12 13 14 15
// 20 21 22 23 24

// 逃亡者のルートと重ならない位置にパトカーを置き、毎ラウンド無関係なビルを捜索させる
const FAR_CARS: [number, number, number] = [15, 12, 3]
const IDLE_SEARCHES: [number, number, number] = [24, 20, 4]

function startedGame(): GameState {
  return placeAll(FAR_CARS)
}

describe('createGame', () => {
  it('starts in the setup phase with nothing placed', () => {
    const s = createGame()
    expect(s.phase).toBe('setup')
    expect(s.round).toBe(0)
    expect(s.policeCars).toEqual([null, null, null])
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
  it('lets police place each car on any free intersection', () => {
    expect(getLegalActions(createGame())).toHaveLength(3 * 16)
  })

  it('moves to round 1 runner phase after all 3 cars are placed', () => {
    const s = placeAll([0, 5, 10])
    expect(s.policeCars).toEqual([0, 5, 10])
    expect(s.phase).toBe('runner')
    expect(s.round).toBe(1)
    expect(currentRole(s)).toBe('runner')
  })

  it('allows placing cars in any order', () => {
    const s = applyAll(createGame(), [
      { type: 'placePolice', car: 2, intersection: 7 },
      { type: 'placePolice', car: 0, intersection: 1 },
    ])
    expect(s.phase).toBe('setup')
    expect(s.policeCars).toEqual([1, null, 7])
  })

  it('rejects two cars on the same intersection', () => {
    const s = applyAction(createGame(), { type: 'placePolice', car: 0, intersection: 4 })
    expect(() => applyAction(s, { type: 'placePolice', car: 1, intersection: 4 })).toThrow(
      IllegalActionError,
    )
  })

  it('rejects placing the same car twice', () => {
    const s = applyAction(createGame(), { type: 'placePolice', car: 0, intersection: 4 })
    expect(() => applyAction(s, { type: 'placePolice', car: 0, intersection: 5 })).toThrow(
      IllegalActionError,
    )
  })

  it('rejects out-of-range intersections', () => {
    expect(() =>
      applyAction(createGame(), { type: 'placePolice', car: 0, intersection: 16 }),
    ).toThrow(IllegalActionError)
  })

  it('rejects runner moves before setup is complete', () => {
    expect(() => applyAction(createGame(), { type: 'runnerMove', building: 0 })).toThrow(
      IllegalActionError,
    )
  })
})

describe('runner phase', () => {
  it('lets the runner start in any of the 25 buildings in round 1', () => {
    expect(runnerMoveTargets(startedGame())).toHaveLength(25)
  })

  it('places the yellow trace at the start point and passes the turn to police', () => {
    const s = applyAction(startedGame(), { type: 'runnerMove', building: 12 })
    expect(s.runnerPosition).toBe(12)
    expect(s.traces).toEqual([{ round: 1, building: 12, found: false }])
    expect(s.phase).toBe('police')
    expect(currentRole(s)).toBe('police')
  })

  it('only allows orthogonally adjacent buildings after round 1', () => {
    let s = applyAction(startedGame(), { type: 'runnerMove', building: 12 })
    s = searchAll(s, IDLE_SEARCHES)
    expect([...runnerMoveTargets(s)].sort((a, b) => a - b)).toEqual([7, 11, 13, 17])
    expect(() => applyAction(s, { type: 'runnerMove', building: 6 })).toThrow(IllegalActionError) // 斜め
    expect(() => applyAction(s, { type: 'runnerMove', building: 14 })).toThrow(IllegalActionError) // 2マス先
  })

  it('never allows returning to a building with a trace', () => {
    let s = playRounds(startedGame(), [12, 13], IDLE_SEARCHES)
    expect(runnerMoveTargets(s)).not.toContain(12)
    expect(() => applyAction(s, { type: 'runnerMove', building: 12 })).toThrow(IllegalActionError)
    s = applyAction(s, { type: 'runnerMove', building: 14 })
    expect(s.traces.map((t) => t.building)).toEqual([12, 13, 14])
  })

  it('keeps earlier traces in place and numbers them by round', () => {
    const s = playRounds(startedGame(), [0, 1, 2, 7, 6, 5], IDLE_SEARCHES)
    expect(s.traces.map((t) => [t.round, t.building])).toEqual([
      [1, 0],
      [2, 1],
      [3, 2],
      [4, 7],
      [5, 6],
      [6, 5],
    ])
  })
})

describe('police phase', () => {
  function policePhase(): GameState {
    // パトカー: 0, 5, 10 / 逃亡者: ビル 24
    return applyAction(placeAll([0, 5, 10]), { type: 'runnerMove', building: 24 })
  }

  it('offers orthogonal moves to free intersections plus 4 searches per car', () => {
    const actions = getLegalActions(policePhase())
    const car0 = actions.filter((a) => 'car' in a && a.car === 0)
    // 交差点 0 の隣は 1 と 4（どちらも空き）+ 捜索 4棟
    expect(car0).toHaveLength(2 + 4)
    const car1 = actions.filter((a) => 'car' in a && a.car === 1)
    // 交差点 5 の隣は 1, 4, 6, 9（すべて空き）+ 捜索 4棟
    expect(car1).toHaveLength(4 + 4)
  })

  it('moves a car to an adjacent free intersection', () => {
    const s = applyAction(policePhase(), { type: 'policeMove', car: 0, intersection: 1 })
    expect(s.policeCars).toEqual([1, 5, 10])
    expect(s.actedCars).toEqual([true, false, false])
    expect(s.phase).toBe('police')
  })

  it('rejects diagonal moves, long moves and occupied intersections', () => {
    const s = policePhase()
    expect(() => applyAction(s, { type: 'policeMove', car: 1, intersection: 0 })).toThrow(
      IllegalActionError,
    ) // 斜め
    expect(() => applyAction(s, { type: 'policeMove', car: 0, intersection: 2 })).toThrow(
      IllegalActionError,
    ) // 2マス先
    const s2 = applyAction(s, { type: 'policeMove', car: 0, intersection: 4 })
    expect(() => applyAction(s2, { type: 'policeMove', car: 1, intersection: 4 })).toThrow(
      IllegalActionError,
    ) // 使用中
  })

  it('lets a car move into an intersection another car just left', () => {
    let s = applyAction(policePhase(), { type: 'policeMove', car: 1, intersection: 6 })
    s = applyAction(s, { type: 'policeMove', car: 0, intersection: 1 })
    s = applyAction(s, { type: 'policeMove', car: 2, intersection: 9 })
    expect(s.policeCars).toEqual([1, 6, 9])
  })

  it('rejects searching a building not around the car', () => {
    expect(() =>
      applyAction(policePhase(), { type: 'policeSearch', car: 0, building: 12 }),
    ).toThrow(IllegalActionError)
  })

  it('rejects a second action from the same car in one round', () => {
    const s = applyAction(policePhase(), { type: 'policeMove', car: 0, intersection: 1 })
    expect(() => applyAction(s, { type: 'policeSearch', car: 0, building: 1 })).toThrow(
      IllegalActionError,
    )
    expect(getLegalActions(s).some((a) => 'car' in a && a.car === 0)).toBe(false)
  })

  it('lets cars act in any order', () => {
    let s = applyAction(policePhase(), { type: 'policeSearch', car: 2, building: 12 })
    s = applyAction(s, { type: 'policeSearch', car: 0, building: 0 })
    expect(s.actedCars).toEqual([true, false, true])
  })

  it('starts the next round after all 3 cars act', () => {
    const s = searchAll(policePhase(), [0, 6, 12])
    expect(s.phase).toBe('runner')
    expect(s.round).toBe(2)
    expect(s.actedCars).toEqual([false, false, false])
  })

  it('rejects police actions during the runner phase', () => {
    expect(() =>
      applyAction(startedGame(), { type: 'policeMove', car: 0, intersection: 11 }),
    ).toThrow(IllegalActionError)
  })
})

describe('search', () => {
  it('finds nothing in an empty building', () => {
    const s = applyAction(applyAction(placeAll([0, 5, 10]), { type: 'runnerMove', building: 24 }), {
      type: 'policeSearch',
      car: 0,
      building: 0,
    })
    expect(s.searchLog).toEqual([{ round: 1, car: 0, building: 0, outcome: 'nothing' }])
    expect(s.phase).toBe('police')
  })

  it('reveals a trace left in an earlier round', () => {
    // 逃亡者: 6 → 7。パトカー0（交差点0）がビル6を捜索
    let s = placeAll([0, 3, 15])
    s = applyAction(s, { type: 'runnerMove', building: 6 })
    s = searchAll(s, [0, 3, 24])
    s = applyAction(s, { type: 'runnerMove', building: 7 })
    s = applyAction(s, { type: 'policeSearch', car: 0, building: 6 })
    expect(s.traces[0]).toEqual({ round: 1, building: 6, found: true })
    expect(s.traces[1].found).toBe(false)
    expect(s.searchLog.at(-1)?.outcome).toBe('trace')
  })

  it('reports a trace again when searching an already found trace', () => {
    let s = placeAll([0, 3, 15])
    s = applyAction(s, { type: 'runnerMove', building: 6 })
    s = searchAll(s, [0, 3, 24])
    s = applyAction(s, { type: 'runnerMove', building: 7 })
    s = applyAction(s, { type: 'policeSearch', car: 0, building: 6 })
    s = applyAction(s, { type: 'policeMove', car: 1, intersection: 2 })
    s = applyAction(s, { type: 'policeSearch', car: 2, building: 24 })
    s = applyAction(s, { type: 'runnerMove', building: 8 })
    s = applyAction(s, { type: 'policeSearch', car: 0, building: 6 })
    expect(s.searchLog.at(-1)?.outcome).toBe('trace')
    expect(s.traces[0].found).toBe(true)
  })

  it('arrests the runner when the car is found and ends the game immediately', () => {
    let s = placeAll([0, 3, 15])
    s = applyAction(s, { type: 'runnerMove', building: 6 })
    s = applyAction(s, { type: 'policeSearch', car: 0, building: 6 })
    expect(s.phase).toBe('ended')
    expect(s.winner).toBe('police')
    expect(s.endReason).toBe('arrested')
    expect(s.searchLog.at(-1)?.outcome).toBe('car')
    expect(currentRole(s)).toBeNull()
    expect(getLegalActions(s)).toEqual([])
    expect(() => applyAction(s, { type: 'policeSearch', car: 1, building: 3 })).toThrow(
      IllegalActionError,
    )
  })
})

describe('game end', () => {
  it('lets the runner escape after the round 11 police phase', () => {
    const path = [0, 1, 2, 7, 6, 5, 10, 11, 12, 13, 14]
    const beforeLastPolice = playRounds(startedGame(), path.slice(0, 10), IDLE_SEARCHES)
    expect(beforeLastPolice.round).toBe(11)
    const lastMove = applyAction(beforeLastPolice, { type: 'runnerMove', building: 14 })
    expect(lastMove.phase).toBe('police') // 11手目の後も警察の手番がある

    const s = searchAll(lastMove, IDLE_SEARCHES)
    expect(s.phase).toBe('ended')
    expect(s.winner).toBe('runner')
    expect(s.endReason).toBe('escaped')
    expect(s.traces).toHaveLength(11)
    expect(s.traces[5]).toMatchObject({ round: 6, building: 5 })
  })

  it('can still arrest the runner during the round 11 police phase', () => {
    let s = playRounds(startedGame(), [0, 1, 2, 7, 6, 5, 10, 11, 12, 13], IDLE_SEARCHES)
    s = applyAction(s, { type: 'runnerMove', building: 14 })
    s = applyAction(s, { type: 'policeMove', car: 2, intersection: 7 }) // 交差点7はビル8,9,13,14に接する
    s = applyAction(s, { type: 'policeSearch', car: 0, building: 24 })
    expect(s.phase).toBe('police')
    expect(() => applyAction(s, { type: 'policeSearch', car: 2, building: 14 })).toThrow(
      IllegalActionError,
    ) // 行動済み
    s = applyAction(s, { type: 'policeMove', car: 1, intersection: 13 })
    expect(s.winner).toBe('runner')
  })

  it('declares the runner surrounded when no move is possible', () => {
    // 5 → 6 → 1 → 0 と動くと、ビル0の隣（1, 5）はどちらも痕跡あり
    const s = playRounds(startedGame(), [5, 6, 1, 0], IDLE_SEARCHES)
    expect(s.phase).toBe('ended')
    expect(s.winner).toBe('police')
    expect(s.endReason).toBe('surrounded')
    expect(s.round).toBe(5)
  })
})

describe('immutability', () => {
  it('never mutates the given state', () => {
    const s0 = startedGame()
    const snapshot = structuredClone(s0)
    const s1 = applyAction(s0, { type: 'runnerMove', building: 3 })
    applyAction(s1, { type: 'policeMove', car: 0, intersection: 11 })
    expect(s0).toEqual(snapshot)
    expect(s1.traces).toHaveLength(1)
    expect(s1.actedCars).toEqual([false, false, false])
  })
})
