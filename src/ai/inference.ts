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

const NO_LIMIT = 0

/**
 * 警察の知識と矛盾しない逃亡者の移動ルート（自己回避のウォーク）をすべて数え上げる。
 * - 「何もない」捜索（ラウンド r, ビル b）: 1〜r 手目のどれも b ではない
 * - 発見した痕跡: 黄なら 1 手目、赤なら 6 手目、青なら発見より前の 1・6 手目以外のどこか
 */
export function inferRunner(knowledge: PoliceKnowledge): RunnerBelief {
  const n = knowledge.traceCount
  const here = new Array<number>(BUILDING_COUNT).fill(0)
  const visited = new Array<number>(BUILDING_COUNT).fill(0)
  const next = new Array<number>(BUILDING_COUNT).fill(0)
  if (n === 0) return { pathCount: 0, here, visited, next }

  // forbiddenThrough[b] = k: 1〜k 手目は b にいられない
  const forbiddenThrough = new Array<number>(BUILDING_COUNT).fill(NO_LIMIT)
  for (const s of knowledge.searchLog) {
    if (s.outcome === 'nothing') {
      forbiddenThrough[s.building] = Math.max(forbiddenThrough[s.building], s.round)
    }
  }

  // 発見済みの痕跡 → 何手目に通ったかの制約
  const fixedStep = new Map<number, BuildingId>() // 手番 → ビル（黄・赤）
  const fixedBuilding = new Map<BuildingId, number>() // ビル → 手番
  const blueBefore = new Map<BuildingId, number>() // 青: この手番より前に通った
  for (const t of knowledge.traces) {
    if (!t.found) continue
    if (t.color === 'blue') {
      const firstFound = knowledge.searchLog.find(
        (s) => s.building === t.building && s.outcome === 'trace',
      )
      blueBefore.set(t.building, firstFound?.round ?? n + 1)
    } else {
      const step = t.color === 'yellow' ? 1 : 6
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
    if (before !== undefined && (step >= before || step === 1 || step === 6)) return false
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
    const candidates = step === 1 ? null : BUILDING_NEIGHBORS[path[path.length - 1]]
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
  walk(1)

  if (pathCount > 0) {
    for (let b = 0; b < BUILDING_COUNT; b++) {
      here[b] /= pathCount
      visited[b] /= pathCount
      next[b] /= pathCount
    }
  }
  return { pathCount, here, visited, next }
}
