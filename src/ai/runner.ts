import {
  BUILDING_NEIGHBORS,
  BUILDINGS_AROUND_INTERSECTION,
  INTERSECTION_NEIGHBORS,
  INTERSECTIONS_AROUND_BUILDING,
  MAX_ROUNDS,
  getView,
  runnerMoveTargets,
  type Action,
  type BuildingId,
  type GameState,
} from '../core'
import { inferRunner } from './inference'
import { pickBest, type Rng } from './random'

export interface RunnerWeights {
  /**
   * パトカーが捜索できるビルの危険度の下限（0〜1）。
   * 0 なら「警察から見ていそうなビル」だけを危険とみなし、1 なら推理に関係なく隣接するだけで危険とみなす
   */
  adjacencyFloor: number
  /** 次ラウンドにパトカーが寄って捜索できるビルを避ける重み */
  nextRound: number
  /** 読まれにくさのためのランダム性の強さ */
  randomness: number
}

export const DEFAULT_RUNNER_WEIGHTS: RunnerWeights = {
  adjacencyFloor: 0,
  nextRound: 1,
  randomness: 0.3,
}

/**
 * CPU逃亡者の移動先を選ぶ。逃亡者は全情報を見られるので GameState を受け取る。
 * - パトカーが今すぐ捜索できるビル（特に警察から見て「いそう」なビル）を避ける
 * - 最終ラウンドまで動き続けられない（包囲される）ビルを避ける
 * - 移動先の選択肢が多いビルを好む
 */
export function chooseRunnerAction(
  state: GameState,
  rng: Rng,
  weights: RunnerWeights = DEFAULT_RUNNER_WEIGHTS,
): Action {
  if (state.phase !== 'runner') throw new Error(`Runner cannot act in phase ${state.phase}`)
  const targets = runnerMoveTargets(state)

  // この移動の後に警察が持つ推理（移動先によらず共通）
  const policeView = getView(state, 'police')
  const belief = inferRunner({ ...policeView, traceCount: policeView.traceCount + 1 })

  const visited = new Set(state.traces.map((t) => t.building))
  const movesLeftAfter = MAX_ROUNDS - state.round

  // パトカーが今いる交差点と、1手で移動できる交差点（次ラウンドに捜索できる位置）
  const carSpots = state.policeCars.filter((c): c is number => c !== null)
  const reachableSpots = new Set(carSpots.flatMap((c) => [c, ...INTERSECTION_NEIGHBORS[c]]))

  const score = (b: BuildingId) => {
    let danger = 0
    for (const car of carSpots) {
      if (!BUILDINGS_AROUND_INTERSECTION[car].includes(b)) continue
      // パトカーは周囲4棟のうち、いそうなビルほど調べやすい
      const best = Math.max(...BUILDINGS_AROUND_INTERSECTION[car].map((x) => belief.here[x]))
      const likely = best > 0 ? (belief.here[b] / best) ** 2 : 0
      danger += weights.adjacencyFloor + (1 - weights.adjacencyFloor) * likely
    }
    const nextRoundExposure =
      INTERSECTIONS_AROUND_BUILDING[b].filter((i) => reachableSpots.has(i)).length /
      INTERSECTIONS_AROUND_BUILDING[b].length
    const blocked = new Set(visited).add(b)
    const survives = canKeepMoving(b, blocked, movesLeftAfter)
    const mobility = reachableCount(b, blocked) / 25

    return (
      -5 * danger -
      weights.nextRound * nextRoundExposure -
      belief.here[b] +
      mobility +
      (survives ? 0 : -100) +
      rng() * weights.randomness
    )
  }

  const building = pickBest(targets, score, rng)
  return { type: 'runnerMove', building }
}

/** from から、blocked を通らずに moves 回移動し続けられるか */
export function canKeepMoving(from: BuildingId, blocked: Set<BuildingId>, moves: number): boolean {
  if (moves <= 0) return true
  for (const n of BUILDING_NEIGHBORS[from]) {
    if (blocked.has(n)) continue
    blocked.add(n)
    const ok = canKeepMoving(n, blocked, moves - 1)
    blocked.delete(n)
    if (ok) return true
  }
  return false
}

function reachableCount(from: BuildingId, blocked: Set<BuildingId>): number {
  const seen = new Set<BuildingId>([from])
  const queue = [from]
  while (queue.length > 0) {
    const b = queue.pop()!
    for (const n of BUILDING_NEIGHBORS[b]) {
      if (!seen.has(n) && !blocked.has(n)) {
        seen.add(n)
        queue.push(n)
      }
    }
  }
  return seen.size - 1
}
