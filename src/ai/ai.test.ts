import { describe, expect, it } from 'vitest'
import {
  applyAction,
  createGame,
  currentRole,
  getLegalActions,
  getView,
  policeSearchTargets,
  type Action,
  type GameState,
  type Role,
} from '../core'
import { hideAt, placeAll, playRounds, searchAll } from '../core/testUtils'
import {
  CPU_LEVELS,
  chooseCpuAction,
  choosePoliceAction,
  chooseRunnerAction,
  inferRunner,
  seededRng,
  type CpuLevel,
} from '.'
import { canKeepMoving } from './runner'

// ビル ID           交差点 ID
//  0  1  2  3  4      0  1  2  3
//  5  6  7  8  9      4  5  6  7
// 10 11 12 13 14      8  9 10 11
// 15 16 17 18 19     12 13 14 15
// 20 21 22 23 24

const IDLE_SEARCHES: [number, number, number] = [24, 20, 4]

function isLegal(state: GameState, action: ReturnType<typeof chooseCpuAction>): boolean {
  return getLegalActions(state).some((a) => JSON.stringify(a) === JSON.stringify(action))
}

/** CPU 同士で1ゲーム。各手で合法性と推理の整合性を確認する */
function playCpuGame(
  seed: number,
  onState?: (s: GameState) => void,
  levels: Record<Role, CpuLevel> = { police: 'strong', runner: 'strong' },
): GameState {
  const rng = seededRng(seed)
  let s = createGame()
  for (let guard = 0; s.phase !== 'ended' && guard < 200; guard++) {
    onState?.(s)
    const action = chooseCpuAction(s, rng, levels[currentRole(s)!])
    expect(isLegal(s, action)).toBe(true)
    s = applyAction(s, action)
  }
  return s
}

describe('inferRunner', () => {
  it('spreads evenly over all buildings before the first move', () => {
    const b = inferRunner({ traceCount: 0, traces: [], searchLog: [] })
    expect(b.pathCount).toBe(25)
    expect(b.here.every((p) => Math.abs(p - 1 / 25) < 1e-9)).toBe(true)
  })

  it('rules out buildings where a search found nothing', () => {
    // 1回移動した後（位置 p0, p1）。Round 2 の捜索でビル12は空 → p0 も p1 も 12 ではない
    const b = inferRunner({
      traceCount: 1,
      traces: [],
      searchLog: [{ round: 2, helicopter: 0, building: 12, outcome: 'nothing' }],
    })
    expect(b.pathCount).toBe(80 - 8) // 2マスの移動 80 通りから 12 を通る 8 通りを除く
    expect(b.here[12]).toBe(0)
    expect(b.visited[12]).toBe(0)
  })

  it('allows a building again after the round in which it was searched', () => {
    // Round 2 の捜索（1回移動した時点）でビル12は空
    const b = inferRunner({
      traceCount: 2,
      traces: [],
      searchLog: [{ round: 2, helicopter: 0, building: 12, outcome: 'nothing' }],
    })
    expect(b.here[12]).toBeGreaterThan(0) // 2回目の移動で入った可能性はある
    expect(b.visited[12]).toBe(0) // スタート地点や1回目の移動先だった可能性はない
  })

  it('pins the start point once the yellow trace is found', () => {
    const b = inferRunner({
      traceCount: 1,
      traces: [{ building: 12, color: 'yellow', round: 1, found: true }],
      searchLog: [{ round: 2, helicopter: 0, building: 12, outcome: 'trace' }],
    })
    expect(b.pathCount).toBe(4)
    expect([7, 11, 13, 17].every((x) => b.here[x] === 0.25)).toBe(true)
  })

  it('never excludes the real runner position (CPU vs CPU, 40 games)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      playCpuGame(seed, (s) => {
        if (s.phase !== 'police' || s.runnerPosition === null) return
        const belief = inferRunner(getView(s, 'police'))
        expect(belief.here[s.runnerPosition]).toBeGreaterThan(0)
        for (const t of s.traces.slice(0, -1)) expect(belief.visited[t.building]).toBeGreaterThan(0)
      })
    }
  })
})

describe('police AI', () => {
  it('places the helicopters in varied patterns: sometimes all central, often spread out', () => {
    const patterns = new Set<string>()
    let allCentral = 0
    for (let seed = 1; seed <= 100; seed++) {
      const rng = seededRng(seed)
      let s = createGame()
      while (s.phase === 'setup') s = applyAction(s, choosePoliceAction(getView(s, 'police'), rng))
      expect(new Set(s.helicopters).size).toBe(3)
      patterns.add([...s.helicopters].sort().join(','))
      if (s.helicopters.every((p) => p !== null && [5, 6, 9, 10].includes(p))) allCentral++
    }
    expect(allCentral).toBeGreaterThan(10)
    expect(allCentral).toBeLessThan(60)
    expect(patterns.size).toBeGreaterThan(30)
  })

  it.each(CPU_LEVELS)(
    'decides the same way whatever the hidden runner position is (%s)',
    (level) => {
      // 警察から見て区別できない2つの状態（逃亡者のスタート地点だけが違う）
      const a = hideAt(placeAll([5, 6, 9]), 0)
      const b = hideAt(placeAll([5, 6, 9]), 24)
      expect(getView(a, 'police')).toEqual(getView(b, 'police'))
      for (let seed = 1; seed <= 10; seed++) {
        expect(choosePoliceAction(getView(a, 'police'), seededRng(seed), level)).toEqual(
          choosePoliceAction(getView(b, 'police'), seededRng(seed), level),
        )
      }
    },
  )

  it('refuses to work from the runner view', () => {
    const s = hideAt(placeAll([5, 6, 9]), 0)
    expect(() => choosePoliceAction(getView(s, 'runner'), seededRng(1))).toThrow()
  })

  it('searches where the runner can be once the start point is known', () => {
    // ヘリコプター: 交差点5（ビル 6, 7, 11, 12）/ 6（7, 8, 12, 13）/ 10（12, 13, 17, 18）
    // 逃亡者は 12 に隠れる。Round 1 の警察は 6・8・18 を捜索して空振り
    let s = hideAt(placeAll([5, 6, 10]), 12)
    s = applyAction(s, { type: 'policeSearch', helicopter: 0, building: 6 })
    s = applyAction(s, { type: 'policeSearch', helicopter: 1, building: 8 })
    s = applyAction(s, { type: 'policeSearch', helicopter: 2, building: 18 })
    // Round 1 の逃亡者: 12 → 7（12 に黄の痕跡）
    s = applyAction(s, { type: 'runnerMove', building: 7 })
    // Round 2 の警察: 黄の痕跡（ビル12）を発見し、17 は空振り
    s = applyAction(s, { type: 'policeSearch', helicopter: 1, building: 12 })
    s = applyAction(s, { type: 'policeSearch', helicopter: 2, building: 17 })
    // 警察の推理: スタート地点は 12、今いるのはその隣（7 / 11 / 13）のどれか
    const belief = inferRunner(getView(s, 'police'))
    expect(belief.pathCount).toBe(3)
    // 残るヘリコプター0（ビル 6, 7, 11, 12 に接する）は 7 か 11 を捜索するはず
    for (let seed = 1; seed <= 10; seed++) {
      const action = choosePoliceAction(getView(s, 'police'), seededRng(seed))
      expect(action.type).toBe('policeSearch')
      expect([7, 11]).toContain(action.type === 'policeSearch' ? action.building : -1)
    }
  })
})

describe('police AI: moving and searching', () => {
  /** CPU 同士の対戦で、警察の行動（配置を除く）のうち移動の割合 */
  function moveShare(level: CpuLevel): number {
    let moves = 0
    let searches = 0
    for (let seed = 400; seed < 440; seed++) {
      const rng = seededRng(seed)
      let s = createGame()
      while (s.phase !== 'ended') {
        const action = chooseCpuAction(s, rng, currentRole(s) === 'police' ? level : 'strong')
        if (action.type === 'policeMove') moves++
        if (action.type === 'policeSearch') searches++
        s = applyAction(s, action)
      }
    }
    return moves / (moves + searches)
  }

  it('moves as well as searches (strong: about a third, normal: about half)', () => {
    const strong = moveShare('strong')
    const normal = moveShare('normal')
    console.info('Police move share:', { strong, normal })
    expect(strong).toBeGreaterThan(0.2)
    expect(strong).toBeLessThan(0.45)
    expect(normal).toBeGreaterThan(0.35)
    expect(normal).toBeLessThan(0.65)
  })

  it.each(CPU_LEVELS)(
    'hardly moves straight back or re-searches a building that was just empty (%s)',
    (level) => {
      let moves = 0
      let backs = 0
      let searches = 0
      let repeats = 0
      for (let seed = 500; seed < 530; seed++) {
        const rng = seededRng(seed)
        let s = createGame()
        while (s.phase !== 'ended') {
          const action = chooseCpuAction(s, rng, currentRole(s) === 'police' ? level : 'strong')
          if (action.type === 'policeMove') {
            moves++
            const last = s.moveLog.findLast((m) => m.helicopter === action.helicopter)
            if (last && last.round === s.round - 1 && last.from === action.intersection) backs++
          }
          if (action.type === 'policeSearch') {
            searches++
            const empty = s.searchLog.some(
              (r) =>
                r.building === action.building && r.outcome === 'nothing' && r.round >= s.round - 2,
            )
            if (empty) repeats++
          }
          s = applyAction(s, action)
        }
      }
      console.info(`Police (${level}):`, { backs: backs / moves, repeats: repeats / searches })
      expect(backs / moves).toBeLessThan(0.03)
      expect(repeats / searches).toBeLessThan(level === 'normal' ? 0.05 : 0.15)
    },
  )

  it.each(CPU_LEVELS)(
    'moves when the last helicopter has only buildings with found traces to search (%s)',
    (level) => {
      // ヘリコプター0 は角の交差点0（ビル 0, 1, 5, 6）。逃亡者は 0 → 1 → 6 → 5 → 10 → 15 と動き、
      // ヘリコプター0 が 0・1・6・5 の痕跡を順に見つける
      const idle = (h0: number): Action[] => [
        { type: 'policeSearch', helicopter: 0, building: h0 },
        { type: 'policeSearch', helicopter: 1, building: 2 },
        { type: 'policeSearch', helicopter: 2, building: 9 },
      ]
      const run = (building: number): Action => ({ type: 'runnerMove', building })
      let s = [
        run(0),
        ...idle(1),
        run(1),
        ...idle(0),
        run(6),
        ...idle(1),
        run(5),
        ...idle(6),
        run(10),
        ...idle(5),
        run(15),
        // このラウンドは他の2機が先に移動し、まだ誰も捜索していない
        { type: 'policeMove', helicopter: 1, intersection: 3 } as Action,
        { type: 'policeMove', helicopter: 2, intersection: 11 } as Action,
      ].reduce(applyAction, placeAll([0, 2, 7]))
      expect(s.phase).toBe('police')
      expect(policeSearchTargets(s, 0)).toEqual([])
      for (let seed = 1; seed <= 10; seed++) {
        const action = choosePoliceAction(getView(s, 'police'), seededRng(seed), level)
        expect(action.type).toBe('policeMove')
        expect(isLegal(s, action)).toBe(true)
      }
      s = applyAction(s, choosePoliceAction(getView(s, 'police'), seededRng(1), level))
      expect(s.phase).toBe('runner')
    },
  )

  it.each(CPU_LEVELS)('only searches in the final search (%s)', (level) => {
    // 5 に隠れて 6 → 7 → 8 → 9 → 14 → 13 → 12 → 11 → 10 → 15 → 16 と11回動く
    const path = [5, 6, 7, 8, 9, 14, 13, 12, 11, 10, 15, 16]
    let s = playRounds(placeAll([0, 3, 15]), path, [0, 4, 24])
    expect(s.round).toBe(12)
    for (let seed = 1; seed <= 20; seed++) {
      expect(choosePoliceAction(getView(s, 'police'), seededRng(seed), level).type).toBe(
        'policeSearch',
      )
    }
    s = applyAction(s, { type: 'policeSearch', helicopter: 0, building: 0 })
    expect(choosePoliceAction(getView(s, 'police'), seededRng(1), level).type).toBe('policeSearch')
  })
})

describe('runner AI', () => {
  it('avoids buildings next to helicopters when choosing the start point', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = placeAll([5, 6, 9])
      const action = chooseRunnerAction(s, seededRng(seed))
      if (action.type !== 'runnerMove') throw new Error('unexpected action')
      // 交差点 5, 6, 9 に接するビル
      expect([6, 7, 8, 11, 12, 13, 16, 17]).not.toContain(action.building)
    }
  })

  it('does not walk into a dead end when another way exists', () => {
    // 5 に隠れて 6 → 1 と動いた後、0 に入ると包囲される。2 なら逃げ続けられる
    const s = searchAll(playRounds(placeAll([15, 12, 3]), [5, 6, 1], IDLE_SEARCHES), IDLE_SEARCHES)
    for (let seed = 1; seed <= 20; seed++) {
      expect(chooseRunnerAction(s, seededRng(seed))).toEqual({ type: 'runnerMove', building: 2 })
    }
  })

  it('never walks into a dead end at the normal strength either', () => {
    const s = searchAll(playRounds(placeAll([15, 12, 3]), [5, 6, 1], IDLE_SEARCHES), IDLE_SEARCHES)
    for (let seed = 1; seed <= 40; seed++) {
      expect(chooseRunnerAction(s, seededRng(seed), 'normal')).toEqual({
        type: 'runnerMove',
        building: 2,
      })
    }
  })

  it('checks whether a route long enough exists', () => {
    expect(canKeepMoving(0, new Set([0, 1, 5]), 1)).toBe(false)
    expect(canKeepMoving(12, new Set([12]), 10)).toBe(true)
  })
})

describe('CPU vs CPU', () => {
  it('finishes every game with legal moves only', () => {
    const results = { runner: 0, police: 0 }
    const reasons: Record<string, number> = {}
    for (let seed = 100; seed < 160; seed++) {
      const end = playCpuGame(seed)
      expect(end.phase).toBe('ended')
      expect(currentRole(end)).toBeNull()
      results[end.winner!]++
      reasons[end.endReason!] = (reasons[end.endReason!] ?? 0) + 1
    }
    // 勝率の目安（調整の参考としてログに出す）
    console.info('CPU vs CPU (60 games):', results, reasons)
    expect(results.runner + results.police).toBe(60)
  })

  it('gives the runner more wins against the normal police, and fewer as the normal runner', () => {
    const runnerWins = (levels: Record<Role, CpuLevel>) => {
      let wins = 0
      for (let seed = 200; seed < 300; seed++) {
        if (playCpuGame(seed, undefined, levels).winner === 'runner') wins++
      }
      return wins
    }
    const strong = runnerWins({ police: 'strong', runner: 'strong' })
    const normalPolice = runnerWins({ police: 'normal', runner: 'strong' })
    const normalRunner = runnerWins({ police: 'strong', runner: 'normal' })
    console.info('Runner wins / 100:', { strong, normalPolice, normalRunner })
    expect(normalPolice).toBeGreaterThan(strong + 15)
    expect(normalRunner).toBeLessThan(strong)
  })
})
