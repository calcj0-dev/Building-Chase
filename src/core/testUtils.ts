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

/**
 * 逃亡者が path の順に移動し、毎ラウンド警察は idleSearches を捜索する。
 * 決着した時点で止まる。
 */
export function playRounds(
  state: GameState,
  path: BuildingId[],
  idleSearches: [BuildingId, BuildingId, BuildingId],
): GameState {
  let s = state
  for (const building of path) {
    if (s.phase === 'ended') break
    s = applyAction(s, { type: 'runnerMove', building })
    s = searchAll(s, idleSearches)
  }
  return s
}
