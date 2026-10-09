import {
  ALL_BUILDINGS,
  ALL_INTERSECTIONS,
  BUILDING_NEIGHBORS,
  BUILDINGS_AROUND_INTERSECTION,
  INTERSECTION_NEIGHBORS,
  FINAL_SEARCH_ROUND,
  HELICOPTER_COUNT,
  type BuildingId,
  type IntersectionId,
} from './board'
import type { Action, GameState, HelicopterIndex, Role, SearchOutcome, TraceColor } from './types'

export const HELICOPTERS: readonly HelicopterIndex[] = [0, 1, 2]

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IllegalActionError'
  }
}

export function createGame(): GameState {
  return {
    phase: 'setup',
    round: 0,
    helicopters: Array<IntersectionId | null>(HELICOPTER_COUNT).fill(null),
    actedHelicopters: Array<boolean>(HELICOPTER_COUNT).fill(false),
    runnerPosition: null,
    traces: [],
    searchLog: [],
    winner: null,
    endReason: null,
  }
}

export function traceColorForRound(round: number): TraceColor {
  if (round === 1) return 'yellow'
  if (round === 6) return 'red'
  return 'blue'
}

/** 今どちらの陣営が操作する番か。決着後は null */
export function currentRole(state: GameState): Role | null {
  switch (state.phase) {
    case 'setup':
    case 'police':
      return 'police'
    case 'hide':
    case 'runner':
      return 'runner'
    case 'ended':
      return null
  }
}

/** 逃亡者が今選べるビル（スタート地点は全ビル、以降は縦横に隣接し痕跡のないビル） */
export function runnerMoveTargets(state: GameState): BuildingId[] {
  if (state.phase === 'hide') return [...ALL_BUILDINGS]
  if (state.phase !== 'runner' || state.runnerPosition === null) return []
  const visited = new Set(state.traces.map((t) => t.building))
  return BUILDING_NEIGHBORS[state.runnerPosition].filter((b) => !visited.has(b))
}

/** 配置フェーズで、そのヘリコプターを置ける交差点 */
export function placementTargets(state: GameState, helicopter: HelicopterIndex): IntersectionId[] {
  if (state.phase !== 'setup' || state.helicopters[helicopter] !== null) return []
  return ALL_INTERSECTIONS.filter((i) => !state.helicopters.includes(i))
}

/** 警察フェーズで、そのヘリコプターが移動できる交差点 */
export function policeMoveTargets(state: GameState, helicopter: HelicopterIndex): IntersectionId[] {
  const from = activeHelicopterPosition(state, helicopter)
  if (from === null) return []
  return INTERSECTION_NEIGHBORS[from].filter((i) => !state.helicopters.includes(i))
}

/** 警察フェーズで、そのヘリコプターが捜索できるビル */
export function policeSearchTargets(state: GameState, helicopter: HelicopterIndex): BuildingId[] {
  const at = activeHelicopterPosition(state, helicopter)
  return at === null ? [] : [...BUILDINGS_AROUND_INTERSECTION[at]]
}

export function getLegalActions(state: GameState): Action[] {
  switch (state.phase) {
    case 'setup':
      return HELICOPTERS.flatMap((helicopter) =>
        placementTargets(state, helicopter).map((intersection): Action => ({
          type: 'placePolice',
          helicopter,
          intersection,
        })),
      )
    case 'hide':
    case 'runner':
      return runnerMoveTargets(state).map((building): Action => ({ type: 'runnerMove', building }))
    case 'police':
      return HELICOPTERS.flatMap((helicopter) => [
        ...policeMoveTargets(state, helicopter).map((intersection): Action => ({
          type: 'policeMove',
          helicopter,
          intersection,
        })),
        ...policeSearchTargets(state, helicopter).map((building): Action => ({
          type: 'policeSearch',
          helicopter,
          building,
        })),
      ])
    case 'ended':
      return []
  }
}

/** 行動を適用した新しい状態を返す。元の状態は変更しない。不正な行動は IllegalActionError */
export function applyAction(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'placePolice':
      return placePolice(state, action.helicopter, action.intersection)
    case 'runnerMove':
      return runnerMove(state, action.building)
    case 'policeMove':
      return policeMove(state, action.helicopter, action.intersection)
    case 'policeSearch':
      return policeSearch(state, action.helicopter, action.building)
  }
}

function placePolice(
  state: GameState,
  helicopter: HelicopterIndex,
  intersection: IntersectionId,
): GameState {
  if (state.phase !== 'setup') throw new IllegalActionError('Not in setup phase')
  if (state.helicopters[helicopter] !== null)
    throw new IllegalActionError(`Helicopter ${helicopter} is already placed`)
  if (!placementTargets(state, helicopter).includes(intersection)) {
    throw new IllegalActionError(
      `Cannot place helicopter ${helicopter} at intersection ${intersection}`,
    )
  }
  const helicopters = state.helicopters.map((p, i) => (i === helicopter ? intersection : p))
  const allPlaced = helicopters.every((p) => p !== null)
  return {
    ...state,
    helicopters,
    ...(allPlaced ? { phase: 'hide' as const } : {}),
  }
}

/**
 * hide: スタート地点に隠れる（痕跡は使わない）。続けて Round 1 の警察フェーズへ
 * runner: 隣のビルへ移動し、元いたビルにそのラウンドの痕跡を残す。次のラウンドの警察フェーズへ
 *         （Round 11 の移動の後は、警察の最後の捜索）
 */
function runnerMove(state: GameState, building: BuildingId): GameState {
  if (state.phase !== 'hide' && state.phase !== 'runner') {
    throw new IllegalActionError('Not in runner phase')
  }
  if (!runnerMoveTargets(state).includes(building)) {
    throw new IllegalActionError(`Runner cannot move to building ${building}`)
  }
  if (state.phase === 'hide') {
    return {
      ...state,
      phase: 'police',
      round: 1,
      runnerPosition: building,
      actedHelicopters: state.actedHelicopters.map(() => false),
    }
  }
  const from = state.runnerPosition as BuildingId
  return {
    ...state,
    phase: 'police',
    round: state.round + 1,
    runnerPosition: building,
    traces: [...state.traces, { round: state.round, building: from, found: false }],
    actedHelicopters: state.actedHelicopters.map(() => false),
  }
}

function policeMove(
  state: GameState,
  helicopter: HelicopterIndex,
  intersection: IntersectionId,
): GameState {
  assertHelicopterCanAct(state, helicopter)
  if (!policeMoveTargets(state, helicopter).includes(intersection)) {
    throw new IllegalActionError(
      `Helicopter ${helicopter} cannot move to intersection ${intersection}`,
    )
  }
  const moved = {
    ...state,
    helicopters: state.helicopters.map((p, i) => (i === helicopter ? intersection : p)),
  }
  return finishHelicopterAction(moved, helicopter)
}

function policeSearch(
  state: GameState,
  helicopter: HelicopterIndex,
  building: BuildingId,
): GameState {
  assertHelicopterCanAct(state, helicopter)
  if (!policeSearchTargets(state, helicopter).includes(building)) {
    throw new IllegalActionError(`Helicopter ${helicopter} cannot search building ${building}`)
  }

  const outcome: SearchOutcome =
    state.runnerPosition === building
      ? 'runner'
      : state.traces.some((t) => t.building === building)
        ? 'trace'
        : 'nothing'

  const searched: GameState = {
    ...state,
    traces:
      outcome === 'trace'
        ? state.traces.map((t) => (t.building === building ? { ...t, found: true } : t))
        : state.traces,
    searchLog: [...state.searchLog, { round: state.round, helicopter, building, outcome }],
  }

  if (outcome === 'runner') {
    return {
      ...searched,
      phase: 'ended',
      actedHelicopters: searched.actedHelicopters.map((a, i) => (i === helicopter ? true : a)),
      winner: 'police',
      endReason: 'arrested',
    }
  }
  return finishHelicopterAction(searched, helicopter)
}

function finishHelicopterAction(state: GameState, helicopter: HelicopterIndex): GameState {
  const actedHelicopters = state.actedHelicopters.map((a, i) => (i === helicopter ? true : a))
  if (!actedHelicopters.every(Boolean)) return { ...state, actedHelicopters }

  // 最後の捜索で見つからなければ逃亡者の勝ち
  if (state.round >= FINAL_SEARCH_ROUND) {
    return { ...state, actedHelicopters, phase: 'ended', winner: 'runner', endReason: 'escaped' }
  }

  // 同じラウンドの逃亡者フェーズへ。動けるビルがなければ包囲
  const runnerTurn: GameState = { ...state, actedHelicopters, phase: 'runner' }
  if (runnerMoveTargets(runnerTurn).length === 0) {
    return { ...runnerTurn, phase: 'ended', winner: 'police', endReason: 'surrounded' }
  }
  return runnerTurn
}

function activeHelicopterPosition(
  state: GameState,
  helicopter: HelicopterIndex,
): IntersectionId | null {
  if (state.phase !== 'police' || state.actedHelicopters[helicopter]) return null
  return state.helicopters[helicopter]
}

function assertHelicopterCanAct(state: GameState, helicopter: HelicopterIndex): void {
  if (state.phase !== 'police') throw new IllegalActionError('Not in police phase')
  if (!HELICOPTERS.includes(helicopter))
    throw new IllegalActionError(`Unknown helicopter ${helicopter}`)
  if (state.actedHelicopters[helicopter])
    throw new IllegalActionError(`Helicopter ${helicopter} has already acted`)
}
