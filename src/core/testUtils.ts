import type { BuildingId, IntersectionId } from './board'
import { applyAction, createGame } from './game'
import type { Action, GameState, HelicopterIndex } from './types'

export function applyAll(state: GameState, actions: Action[]): GameState {
  return actions.reduce(applyAction, state)
}

export function placeAll(
  intersections: [IntersectionId, IntersectionId, IntersectionId],
  state: GameState = createGame(),
): GameState {
  return applyAll(
    state,
    intersections.map((intersection, helicopter) => ({
      type: 'placePolice',
      helicopter: helicopter as HelicopterIndex,
      intersection,
    })),
  )
}

/** 3台がそれぞれ指定のビルを捜索する */
export function searchAll(
  state: GameState,
  buildings: [BuildingId, BuildingId, BuildingId],
): GameState {
  return applyAll(
    state,
    buildings.map((building, helicopter) => ({
      type: 'policeSearch',
      helicopter: helicopter as HelicopterIndex,
      building,
    })),
  )
}

/** 逃亡者がスタート地点に隠れる（ゲーム開始前。痕跡は使わない） */
export function hideAt(state: GameState, building: BuildingId): GameState {
  return applyAction(state, { type: 'runnerMove', building })
}

/**
 * 逃亡者が path の位置を順にたどる。各ラウンドは 警察 → 逃亡者 の順で、警察は idleSearches を捜索する。
 * スタート地点に隠れる前の状態から始めた場合、path の先頭はスタート地点。
 * 最後の移動の後は、次のラウンドの警察フェーズ（警察が行動する前）で止まる。決着した時点でも止まる。
 */
export function playRounds(
  state: GameState,
  path: BuildingId[],
  idleSearches: [BuildingId, BuildingId, BuildingId],
): GameState {
  let s = state
  for (const building of path) {
    if (s.phase === 'ended') break
    if (s.phase === 'hide') {
      s = hideAt(s, building)
      continue
    }
    if (s.phase === 'police') s = searchAll(s, idleSearches)
    if (s.phase === 'ended') break
    s = applyAction(s, { type: 'runnerMove', building })
  }
  return s
}
