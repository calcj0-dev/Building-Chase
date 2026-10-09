import { BUILDING_COUNT, BUILDING_NEIGHBORS, type BuildingId, type GameView } from '../core'

/** 警察が知っている情報だけから推定した、逃亡者の居場所の分布 */
export interface RunnerBelief {
  /** 矛盾しない移動ルートの数 */
  pathCount: number
  /** 今そのビルに車がいる確率 */
  here: number[]
  /** そのビルに痕跡がある（過去に通った）確率 */
  visited: number[]
  /** 次の逃亡者フェーズの後にそのビルにいる確率 */
  next: number[]
}

/** 推理に使う情報。GameView のうち警察にも見えている部分だけ */
export type PoliceKnowledge = Pick<GameView, 'traceCount' | 'traces' | 'searchLog'>

/** 捜索による制限なし（位置の番号は 0 から始まるので -1） */
const NO_LIMIT = -1

/**
 * 警察の知識と矛盾しない逃亡者の移動ルート（自己回避のウォーク）をすべて数え上げる。
 * ルートは位置 p0（スタート地点）〜 pn（今いるビル）。n は移動した回数（= 置かれた痕跡の数）。
 * Round k の移動で、移動前のビル p(k-1) に k 番目の痕跡が残る。
 * - 「何もない」捜索（ラウンド r, ビル b）: p0〜pr のどれも b ではない
 * - 発見した痕跡: 黄（1番目）なら p0、赤（6番目）なら p5、青なら発見より前のそれ以外の位置
 */
export function inferRunner(knowledge: PoliceKnowledge): RunnerBelief {
  const n = knowledge.traceCount
  const here = new Array<number>(BUILDING_COUNT).fill(0)
  const visited = new Array<number>(BUILDING_COUNT).fill(0)
  const next = new Array<number>(BUILDING_COUNT).fill(0)
  // forbiddenThrough[b] = k: 位置 p0〜pk は b ではない
  const forbiddenThrough = new Array<number>(BUILDING_COUNT).fill(NO_LIMIT)
  for (const s of knowledge.searchLog) {
    if (s.outcome === 'nothing') {
      forbiddenThrough[s.building] = Math.max(forbiddenThrough[s.building], s.round)
    }
  }

  // 発見済みの痕跡 → 何手目に通ったかの制約
  const fixedStep = new Map<number, BuildingId>() // 位置の番号 → ビル（黄・赤）
  const fixedBuilding = new Map<BuildingId, number>() // ビル → 位置の番号
  const blueBefore = new Map<BuildingId, number>() // 青: この位置の番号より前にいた
  for (const t of knowledge.traces) {
    if (!t.found) continue
    if (t.color === 'blue') {
      const firstFound = knowledge.searchLog.find(
        (s) => s.building === t.building && s.outcome === 'trace',
      )
      // Round r の捜索で見つかった痕跡は p0〜p(r-1) のどこかに置かれたもの
      blueBefore.set(t.building, firstFound?.round ?? n)
    } else {
      const step = t.color === 'yellow' ? 0 : 5
      fixedStep.set(step, t.building)
      fixedBuilding.set(t.building, step)
    }
  }
  const blueBuildings = [...blueBefore.keys()]

  const path: BuildingId[] = []
  const onPath = new Array<boolean>(BUILDING_COUNT).fill(false)
  let pathCount = 0

  const allowed = (b: BuildingId, step: number): boolean => {
    if (onPath[b]) return false
    if (forbiddenThrough[b] >= step) return false
    const required = fixedStep.get(step)
    if (required !== undefined) return b === required
    if (fixedBuilding.has(b)) return false
    const before = blueBefore.get(b)
    if (before !== undefined && (step >= before || step >= n || step === 0 || step === 5)) {
      return false
    }
    return true
  }

  const record = () => {
    if (blueBuildings.some((b) => !onPath[b])) return
    pathCount++
    const end = path[path.length - 1]
    here[end]++
    for (let i = 0; i < path.length - 1; i++) visited[path[i]]++
    const moves = BUILDING_NEIGHBORS[end].filter((m) => !onPath[m])
    for (const m of moves) next[m] += 1 / moves.length
  }

  const walk = (step: number) => {
    const candidates = step === 0 ? null : BUILDING_NEIGHBORS[path[path.length - 1]]
    const count = candidates ? candidates.length : BUILDING_COUNT
    for (let i = 0; i < count; i++) {
      const b = candidates ? candidates[i] : i
      if (!allowed(b, step)) continue
      path.push(b)
      onPath[b] = true
      if (step === n) record()
      else walk(step + 1)
      onPath[b] = false
      path.pop()
    }
  }
  walk(0)

  if (pathCount > 0) {
    for (let b = 0; b < BUILDING_COUNT; b++) {
      here[b] /= pathCount
      visited[b] /= pathCount
      next[b] /= pathCount
    }
  }
  return { pathCount, here, visited, next }
}
