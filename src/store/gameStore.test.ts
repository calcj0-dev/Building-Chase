import { describe, expect, it } from 'vitest'
import { seededRng } from '../ai'
import { getView } from '../core'
import {
  highlightedBuildings,
  highlightedIntersections,
  initialStoreState,
  isCpuTurn,
  isHumanTurn,
  nextHelicopterToPlace,
  reduceStore,
  selectableHelicopters,
  viewRole,
  type GameStoreState,
  type StoreEvent,
} from './gameStore'

// ビル ID           交差点 ID
//  0  1  2  3  4      0  1  2  3
//  5  6  7  8  9      4  5  6  7
// 10 11 12 13 14      8  9 10 11
// 15 16 17 18 19     12 13 14 15
// 20 21 22 23 24

function run(events: StoreEvent[], s: GameStoreState = initialStoreState()): GameStoreState {
  return events.reduce(reduceStore, s)
}

const PLACE_ALL: StoreEvent[] = [
  { type: 'tapIntersection', intersection: 0 },
  { type: 'tapIntersection', intersection: 5 },
  { type: 'tapIntersection', intersection: 10 },
]

/** ヘリコプター配置 → 端末を逃亡者へ → 24 に隠れる → 23 へ移動（警察の番になる） */
const TO_POLICE_TURN: StoreEvent[] = [
  ...PLACE_ALL,
  { type: 'dismissHandoff' },
  { type: 'tapBuilding', building: 24 },
  { type: 'tapBuilding', building: 23 },
]

describe('setup', () => {
  it('places helicopters 1 → 2 → 3 on tapped intersections', () => {
    let s = initialStoreState()
    expect(nextHelicopterToPlace(s.game)).toBe(0)
    expect(highlightedIntersections(s)).toHaveLength(16)
    s = run([{ type: 'tapIntersection', intersection: 0 }], s)
    expect(nextHelicopterToPlace(s.game)).toBe(1)
    expect(highlightedIntersections(s)).not.toContain(0)
    s = run(PLACE_ALL.slice(1), s)
    expect(s.game.helicopters).toEqual([0, 5, 10])
    expect(s.game.phase).toBe('hide')
  })

  it('ignores taps on occupied intersections', () => {
    const s = run([
      { type: 'tapIntersection', intersection: 0 },
      { type: 'tapIntersection', intersection: 0 },
    ])
    expect(s.game.helicopters).toEqual([0, null, null])
  })

  it('asks to hand the device to the runner after setup', () => {
    const s = run(PLACE_ALL)
    expect(s.handoffTo).toBe('runner')
    expect(highlightedBuildings(s)).toEqual([]) // 渡すまで盤面は操作不可
    expect(highlightedBuildings(run([{ type: 'dismissHandoff' }], s))).toHaveLength(25)
  })
})

describe('runner turn', () => {
  it('hides at the start point and moves right away without a handoff', () => {
    let s = run([...PLACE_ALL, { type: 'dismissHandoff' }, { type: 'tapBuilding', building: 24 }])
    expect(s.game.runnerPosition).toBe(24)
    expect(s.game.phase).toBe('runner')
    expect(s.game.traces).toEqual([])
    expect(s.handoffTo).toBeNull() // 続けて逃亡者が移動する
    expect([...highlightedBuildings(s)].sort((a, b) => a - b)).toEqual([19, 23])
    s = run([{ type: 'tapBuilding', building: 23 }], s)
    expect(s.game.phase).toBe('police')
    expect(s.game.traces).toEqual([{ round: 1, building: 24, found: false }])
    expect(s.handoffTo).toBe('police')
  })

  it('ignores taps on buildings that are not highlighted', () => {
    let s = run([...TO_POLICE_TURN, { type: 'dismissHandoff' }, ...searchAllEvents([0, 6, 12])])
    s = run([{ type: 'dismissHandoff' }, { type: 'tapBuilding', building: 0 }], s) // 隣接していない
    expect(s.game.runnerPosition).toBe(23)
    expect(s.game.phase).toBe('runner')
  })
})

function searchAllEvents(buildings: [number, number, number]): StoreEvent[] {
  return buildings.flatMap((building, helicopter) => [
    { type: 'tapHelicopter', helicopter: helicopter as 0 | 1 | 2 },
    { type: 'chooseMode', mode: 'search' },
    { type: 'tapBuilding', building },
  ])
}

describe('police turn', () => {
  function policeTurn(): GameStoreState {
    return run([...TO_POLICE_TURN, { type: 'dismissHandoff' }])
  }

  it('highlights nothing until a helicopter and an action are chosen', () => {
    let s = policeTurn()
    expect(selectableHelicopters(s)).toEqual([0, 1, 2])
    expect(highlightedIntersections(s)).toEqual([])
    expect(highlightedBuildings(s)).toEqual([])

    s = run([{ type: 'tapHelicopter', helicopter: 0 }], s)
    expect(highlightedIntersections(s)).toEqual([])

    s = run([{ type: 'chooseMode', mode: 'move' }], s)
    expect([...highlightedIntersections(s)].sort((a, b) => a - b)).toEqual([1, 4])

    s = run([{ type: 'chooseMode', mode: 'search' }], s)
    expect(highlightedBuildings(s)).toEqual([0, 1, 5, 6])
    expect(highlightedIntersections(s)).toEqual([])
  })

  it('lets the player change the helicopter or action before the final tap', () => {
    let s = run(
      [
        { type: 'tapHelicopter', helicopter: 0 },
        { type: 'chooseMode', mode: 'move' },
        { type: 'tapHelicopter', helicopter: 1 },
      ],
      policeTurn(),
    )
    expect(s.selectedHelicopter).toBe(1)
    expect(s.mode).toBeNull()

    s = run([{ type: 'chooseMode', mode: 'search' }, { type: 'cancelSelection' }], s)
    expect(s.selectedHelicopter).toBe(1)
    expect(s.mode).toBeNull()
    s = run([{ type: 'cancelSelection' }], s)
    expect(s.selectedHelicopter).toBeNull()
  })

  it('confirms a move with the final tap and marks the helicopter as acted', () => {
    const s = run(
      [
        { type: 'tapHelicopter', helicopter: 0 },
        { type: 'chooseMode', mode: 'move' },
        { type: 'tapIntersection', intersection: 1 },
      ],
      policeTurn(),
    )
    expect(s.game.helicopters).toEqual([1, 5, 10])
    expect(s.game.actedHelicopters).toEqual([true, false, false])
    expect(s.selectedHelicopter).toBeNull()
    expect(selectableHelicopters(s)).toEqual([1, 2])
    expect(run([{ type: 'tapHelicopter', helicopter: 0 }], s).selectedHelicopter).toBeNull()
  })

  it('records the last search result until the next action', () => {
    let s = run(searchAllEvents([0, 6, 12]).slice(0, 3), policeTurn())
    expect(s.lastSearch).toEqual({ round: 1, helicopter: 0, building: 0, outcome: 'nothing' })
    s = run([{ type: 'tapHelicopter', helicopter: 1 }], s)
    expect(s.lastSearch).not.toBeNull()
    s = run(
      [
        { type: 'chooseMode', mode: 'move' },
        { type: 'tapIntersection', intersection: 6 },
      ],
      s,
    )
    expect(s.lastSearch).toBeNull()
  })

  it('hands the device back to the runner when the round ends', () => {
    const s = run(searchAllEvents([0, 6, 12]), policeTurn())
    expect(s.game.round).toBe(2)
    expect(s.handoffTo).toBe('runner')
  })

  it('ends the game without a handoff when the runner is found', () => {
    let s = run([
      ...PLACE_ALL,
      { type: 'dismissHandoff' },
      { type: 'tapBuilding', building: 1 },
      { type: 'tapBuilding', building: 6 },
      { type: 'dismissHandoff' },
      { type: 'tapHelicopter', helicopter: 0 },
      { type: 'chooseMode', mode: 'search' },
      { type: 'tapBuilding', building: 6 },
    ])
    expect(s.game.phase).toBe('ended')
    expect(s.game.winner).toBe('police')
    expect(s.lastSearch?.outcome).toBe('runner')
    expect(s.handoffTo).toBeNull()
    s = run([{ type: 'newGame' }], s)
    expect(s.game.phase).toBe('setup')
  })
})

describe('VS CPU', () => {
  const cpu = (rngSeed: number): StoreEvent => ({ type: 'cpuStep', rng: seededRng(rngSeed) })

  it('lets the CPU police place helicopters, then waits for the human runner', () => {
    let s = run([{ type: 'startGame', side: 'runner' }])
    expect(isCpuTurn(s)).toBe(true)
    expect(highlightedIntersections(s)).toEqual([]) // 人は警察を操作できない
    s = run([cpu(1), cpu(2), cpu(3)], s)
    expect(s.game.phase).toBe('hide')
    expect(isHumanTurn(s)).toBe(true)
    expect(s.handoffTo).toBeNull() // CPU 戦では端末の受け渡しなし
    expect(highlightedBuildings(s)).toHaveLength(25)
  })

  it('ignores CPU steps during the human turn', () => {
    const s = run([{ type: 'startGame', side: 'police' }])
    expect(isHumanTurn(s)).toBe(true)
    expect(run([cpu(1)], s)).toBe(s)
  })

  it('shows the human side view and hides the CPU runner', () => {
    let s = run([{ type: 'startGame', side: 'police' }, ...PLACE_ALL])
    expect(viewRole(s)).toBe('police')
    s = run([cpu(1)], s) // CPU 逃亡者がスタート地点に隠れる
    expect(s.game.phase).toBe('runner')
    expect(getView(s.game, viewRole(s)).runnerPosition).toBeNull()
    s = run([cpu(2)], s) // CPU 逃亡者が移動
    expect(s.game.phase).toBe('police')
    expect(getView(s.game, viewRole(s)).runnerPosition).toBeNull()
  })

  it('plays a whole game against the CPU', () => {
    let s = run([{ type: 'startGame', side: 'police' }, ...PLACE_ALL])
    const rng = seededRng(42)
    for (let guard = 0; s.game.phase !== 'ended' && guard < 100; guard++) {
      if (isCpuTurn(s)) {
        s = reduceStore(s, { type: 'cpuStep', rng })
      } else {
        // 人の警察: 毎回ヘリコプター1 から順にその場で捜索
        const helicopter = selectableHelicopters(s)[0]
        s = run(
          [
            { type: 'tapHelicopter', helicopter },
            { type: 'chooseMode', mode: 'search' },
          ],
          s,
        )
        s = run([{ type: 'tapBuilding', building: highlightedBuildings(s)[0] }], s)
      }
    }
    expect(s.game.phase).toBe('ended')
    s = run([{ type: 'newGame' }], s)
    expect(s.humanSide).toBe('police')
    expect(run([{ type: 'backToSelect' }], s).humanSide).toBeNull()
  })
})
