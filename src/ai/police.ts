import {
  ALL_INTERSECTIONS,
  BUILDINGS_AROUND_INTERSECTION,
  FINAL_SEARCH_ROUND,
  intersectionPoint,
  INTERSECTION_NEIGHBORS,
  HELICOPTERS,
  type Action,
  type BuildingId,
  type GameView,
  type IntersectionId,
  type HelicopterIndex,
} from '../core'
import { inferRunner, type RunnerBelief } from './inference'
import type { CpuLevel } from './level'
import { pickBest, type Rng } from './random'

// 中央の4交差点はそれぞれ内側のビル4棟に接し、序盤の捜索範囲が最も広い
const CENTRAL_INTERSECTIONS: IntersectionId[] = [5, 6, 9, 10]
const CORNER_INTERSECTIONS: IntersectionId[] = [0, 3, 12, 15]

/** 配置: ここまで中央に置いてきたとき、次も中央に置く確率（3機とも中央になるのは約 0.6³ ≈ 2割） */
export const PLACE_CENTRAL_PROBABILITY = 0.6
/** 配置で中央以外に置くときの交差点の重み（中央 / 辺 / 角） */
const PLACE_WEIGHT = { central: 3, edge: 2, corner: 1 }
/** 配置で、他のヘリコプターの隣の交差点の重みにかける値（ばらけさせる） */
const PLACE_NEIGHBOR_FACTOR = 0.25

export interface PoliceWeights {
  /** 次ラウンドに備えた位置取りの価値（今の捜索で見つかる確率との比較用） */
  future: number
  /** 捜索結果の不確かさ（推理が進む度合い）の価値 */
  info: number
  /** 次ラウンドの価値を、捜索できる4棟の最大値で測るか合計で測るか */
  futureMode: 'max' | 'sum'
  /**
   * 捜索の手間（捜索の点数から引く）。見つかる見込みが小さい捜索より移動を選ばせる。
   * いそうなビル（here が大きい）なら手間を上回るので捜索する
   */
  searchCost: number
  /** 来た交差点へすぐ戻る移動（前のラウンドの移動を取り消す動き）の点数から引く値 */
  backtrackPenalty: number
  /** 直近 REPEAT_SEARCH_ROUNDS ラウンドに「何もない」だったビルをまた捜索するときに引く値 */
  repeatSearchPenalty: number
}

/** 「何もない」だったビルの捜索を避ける期間（ラウンド数。今のラウンドを含む） */
const REPEAT_SEARCH_ROUNDS = 3

// 強い警察: CPU同士の対戦で比較し、複数の逃亡者の戦略に対して安定して強かった値。
// searchCost 0.3 で行動の約3割が移動になる（0 のときは約1割で、むしろ弱かった。0.35 を超えると急に弱くなる）。
// 「何もない」だったビルの再捜索は推理上は意味があることも多いので、点数は少しだけ下げる
export const DEFAULT_POLICE_WEIGHTS: PoliceWeights = {
  future: 1.5,
  info: 0.3,
  futureMode: 'sum',
  searchCost: 0.3,
  backtrackPenalty: 0.3,
  repeatSearchPenalty: 0.05,
}

// 普通の警察: 捜索の手間を大きくして移動を増やし（行動の約半分）、「何もない」だったビルの再捜索を避ける。
// 推理そのものは強い警察と同じ（以前の「忘れる」「ときどき適当に動く」手加減は、行ったり来たりや
// 同じビルの捜索の繰り返しに見えたのでやめた）
export const NORMAL_POLICE_WEIGHTS: PoliceWeights = {
  ...DEFAULT_POLICE_WEIGHTS,
  searchCost: 0.38,
  repeatSearchPenalty: 0.5,
}

const POLICE_WEIGHTS: Record<CpuLevel, PoliceWeights> = {
  normal: NORMAL_POLICE_WEIGHTS,
  strong: DEFAULT_POLICE_WEIGHTS,
}

/**
 * CPU警察の行動を1つ選ぶ（ヘリコプター1機分）。
 * 引数は警察視点の GameView のみ。逃亡者の位置は参照できない。
 * 強さの違いは weights（POLICE_WEIGHTS）だけで決まる。
 * 捜索は手間（searchCost）を引いて評価するので、逃亡者がいそうなビルを捜索できないときは移動して位置を取る。
 * 来た交差点へすぐ戻る移動と、最近「何もない」だったビルの捜索は点数を下げる（いそうなら上回るので行う）。
 */
export function choosePoliceAction(
  view: GameView,
  rng: Rng,
  level: CpuLevel = 'strong',
  weights: PoliceWeights = POLICE_WEIGHTS[level],
): Action {
  if (view.role !== 'police') throw new Error('choosePoliceAction requires the police view')
  if (view.phase === 'setup') return choosePlacement(view, rng)
  if (view.phase !== 'police') throw new Error(`Police cannot act in phase ${view.phase}`)

  const belief = inferRunner(view)
  const waiting = HELICOPTERS.filter((helicopter) => !view.actedHelicopters[helicopter])
  let options = waiting.flatMap((helicopter) =>
    helicopterOptions(view, helicopter, belief, weights),
  )
  // 移動ばかりで推理が進まなくならないよう、各ラウンドで最低1回は捜索する
  const searchedThisRound = view.searchLog.some((s) => s.round === view.round)
  // （痕跡を見つけたビルばかりで捜索できるビルがないときは除く）
  if (waiting.length === 1 && !searchedThisRound) {
    const searches = options.filter((o) => o.action.type === 'policeSearch')
    if (searches.length > 0) options = searches
  }
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

function helicopterOptions(
  view: GameView,
  helicopter: HelicopterIndex,
  belief: RunnerBelief,
  weights: PoliceWeights,
): ScoredAction[] {
  const at = view.helicopters[helicopter]
  if (at === null) return []

  // 他のヘリコプターが次ラウンドに捜索できる範囲は、このヘリコプターが重ねて守る必要がない
  const coveredByOthers = new Set<BuildingId>(
    view.helicopters.flatMap((p, i) =>
      i === helicopter || p === null ? [] : BUILDINGS_AROUND_INTERSECTION[p],
    ),
  )
  const future = (i: IntersectionId) => {
    const values = BUILDINGS_AROUND_INTERSECTION[i]
      .filter((b) => !coveredByOthers.has(b))
      .map((b) => belief.next[b])
    return weights.futureMode === 'max' ? Math.max(0, ...values) : values.reduce((a, b) => a + b, 0)
  }

  // 痕跡を見つけたビルは、もう捜索できない
  const found = new Set(view.traces.filter((t) => t.found).map((t) => t.building))
  // 最近「何もない」だったビル（いそうなら手間を上回るので、また捜索する）
  const recentlyEmpty = new Set(
    view.searchLog
      .filter((s) => s.outcome === 'nothing' && s.round > view.round - REPEAT_SEARCH_ROUNDS)
      .map((s) => s.building),
  )
  // 前のラウンドにこのヘリコプターが来た交差点（すぐ戻ると、行ったり来たりになる）
  const lastMove = view.moveLog.findLast((m) => m.helicopter === helicopter)
  const cameFrom = lastMove && lastMove.round === view.round - 1 ? lastMove.from : null
  const searches = BUILDINGS_AROUND_INTERSECTION[at]
    .filter((building) => !found.has(building))
    .map((building) => ({
      action: { type: 'policeSearch', helicopter, building } as Action,
      score:
        belief.here[building] +
        weights.info * outcomeEntropy(belief.here[building], belief.visited[building]) +
        weights.future * future(at) -
        weights.searchCost -
        (recentlyEmpty.has(building) ? weights.repeatSearchPenalty : 0),
    }))

  // 最後の捜索では移動しても意味がない（捜索できるビルがなければ、移動して手番を終える）
  if (view.round >= FINAL_SEARCH_ROUND && searches.length > 0) return searches

  const occupied = new Set(view.helicopters)
  const moves = INTERSECTION_NEIGHBORS[at]
    .filter((i) => !occupied.has(i))
    .map((intersection) => ({
      action: { type: 'policeMove', helicopter, intersection } as Action,
      score:
        weights.future * future(intersection) -
        (intersection === cameFrom ? weights.backtrackPenalty : 0),
    }))

  return [...searches, ...moves]
}

/**
 * 配置。毎回同じ形にならないようにランダムに選ぶ。
 * - ここまで中央に置いてきたなら、確率 PLACE_CENTRAL_PROBABILITY で次も中央（中央に固まる形）
 * - それ以外は盤面全体から重み付きで選ぶ。中央ほど選ばれやすく、他のヘリコプターの隣は選ばれにくい（ばらける形）
 */
function choosePlacement(view: GameView, rng: Rng): Action {
  const helicopter = HELICOPTERS.find((c) => view.helicopters[c] === null)
  if (helicopter === undefined) throw new Error('All police cars are already placed')
  const placed = view.helicopters.filter((p): p is IntersectionId => p !== null)
  const free = ALL_INTERSECTIONS.filter((i) => !placed.includes(i))

  const freeCentral = CENTRAL_INTERSECTIONS.filter((i) => free.includes(i))
  const allCentral = placed.every((p) => CENTRAL_INTERSECTIONS.includes(p))
  if (allCentral && freeCentral.length > 0 && rng() < PLACE_CENTRAL_PROBABILITY) {
    return { type: 'placePolice', helicopter, intersection: pickOne(freeCentral, rng) }
  }

  const weight = (i: IntersectionId) => {
    const base = CENTRAL_INTERSECTIONS.includes(i)
      ? PLACE_WEIGHT.central
      : CORNER_INTERSECTIONS.includes(i)
        ? PLACE_WEIGHT.corner
        : PLACE_WEIGHT.edge
    const nextToOther = placed.some((p) => gridDistance(p, i) === 1)
    return base * (nextToOther ? PLACE_NEIGHBOR_FACTOR : 1)
  }
  return { type: 'placePolice', helicopter, intersection: pickWeighted(free, weight, rng) }
}

function gridDistance(a: IntersectionId, b: IntersectionId): number {
  const p = intersectionPoint(a)
  const q = intersectionPoint(b)
  return Math.abs(p.row - q.row) + Math.abs(p.col - q.col)
}

function pickOne<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)]
}

function pickWeighted<T>(items: T[], weight: (item: T) => number, rng: Rng): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0)
  let r = rng() * total
  for (const item of items) {
    r -= weight(item)
    if (r < 0) return item
  }
  return items[items.length - 1]
}
