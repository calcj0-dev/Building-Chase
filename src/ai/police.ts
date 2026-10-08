import {
  BUILDINGS_AROUND_INTERSECTION,
  INTERSECTION_NEIGHBORS,
  POLICE_CARS,
  type Action,
  type BuildingId,
  type GameView,
  type IntersectionId,
  type PoliceCarIndex,
} from '../core'
import { inferRunner, type RunnerBelief } from './inference'
import { pickBest, type Rng } from './random'

// 中央の4交差点はそれぞれ内側のビル4棟に接し、序盤の捜索範囲が最も広い
const CENTRAL_INTERSECTIONS: IntersectionId[] = [5, 6, 9, 10]

export interface PoliceWeights {
  /** 次ラウンドに備えた位置取りの価値（今の捜索で見つかる確率との比較用） */
  future: number
  /** 捜索結果の不確かさ（推理が進む度合い）の価値 */
  info: number
  /** 次ラウンドの価値を、捜索できる4棟の最大値で測るか合計で測るか */
  futureMode: 'max' | 'sum'
}

// CPU同士の対戦で比較し、複数の逃亡者の戦略に対して安定して強かった値
export const DEFAULT_POLICE_WEIGHTS: PoliceWeights = { future: 1.5, info: 0.3, futureMode: 'sum' }

/**
 * CPU警察の行動を1つ選ぶ（パトカー1台分）。
 * 引数は警察視点の GameView のみ。逃亡者の位置は参照できない。
 */
export function choosePoliceAction(
  view: GameView,
  rng: Rng,
  weights: PoliceWeights = DEFAULT_POLICE_WEIGHTS,
): Action {
  if (view.role !== 'police') throw new Error('choosePoliceAction requires the police view')
  if (view.phase === 'setup') return choosePlacement(view, rng)
  if (view.phase !== 'police') throw new Error(`Police cannot act in phase ${view.phase}`)

  const belief = inferRunner(view)
  const options = POLICE_CARS.filter((car) => !view.actedCars[car]).flatMap((car) =>
    carOptions(view, car, belief, weights),
  )
  return pickBest(options, (o) => o.score, rng).action
}

/** 捜索結果（車 / 痕跡 / 何もない）のエントロピー。結果が読めないビルほど調べる価値がある */
function outcomeEntropy(here: number, visited: number): number {
  const nothing = Math.max(0, 1 - here - visited)
  return [here, visited, nothing].reduce((h, p) => (p > 0 ? h - p * Math.log2(p) : h), 0)
}

interface ScoredAction {
  action: Action
  score: number
}

function carOptions(
  view: GameView,
  car: PoliceCarIndex,
  belief: RunnerBelief,
  weights: PoliceWeights,
): ScoredAction[] {
  const at = view.policeCars[car]
  if (at === null) return []

  // 他のパトカーが次ラウンドに捜索できる範囲は、このパトカーが重ねて守る必要がない
  const coveredByOthers = new Set<BuildingId>(
    view.policeCars.flatMap((p, i) =>
      i === car || p === null ? [] : BUILDINGS_AROUND_INTERSECTION[p],
    ),
  )
  const future = (i: IntersectionId) => {
    const values = BUILDINGS_AROUND_INTERSECTION[i]
      .filter((b) => !coveredByOthers.has(b))
      .map((b) => belief.next[b])
    return weights.futureMode === 'max' ? Math.max(0, ...values) : values.reduce((a, b) => a + b, 0)
  }

  const searches = BUILDINGS_AROUND_INTERSECTION[at].map((building) => ({
    action: { type: 'policeSearch', car, building } as Action,
    score:
      belief.here[building] +
      weights.info * outcomeEntropy(belief.here[building], belief.visited[building]) +
      weights.future * future(at),
  }))

  const occupied = new Set(view.policeCars)
  const moves = INTERSECTION_NEIGHBORS[at]
    .filter((i) => !occupied.has(i))
    .map((intersection) => ({
      action: { type: 'policeMove', car, intersection } as Action,
      score: weights.future * future(intersection),
    }))

  return [...searches, ...moves]
}

function choosePlacement(view: GameView, rng: Rng): Action {
  const car = POLICE_CARS.find((c) => view.policeCars[c] === null)
  if (car === undefined) throw new Error('All police cars are already placed')
  const free = CENTRAL_INTERSECTIONS.filter((i) => !view.policeCars.includes(i))
  const intersection = free[Math.floor(rng() * free.length)]
  return { type: 'placePolice', car, intersection }
}
