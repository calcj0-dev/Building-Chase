import {
  ALL_BUILDINGS,
  ALL_INTERSECTIONS,
  BUILDING_NEIGHBORS,
  BUILDINGS_AROUND_INTERSECTION,
  INTERSECTION_NEIGHBORS,
  MAX_ROUNDS,
  POLICE_CAR_COUNT,
  type BuildingId,
  type IntersectionId,
} from './board'
import type { Action, GameState, PoliceCarIndex, Role, SearchOutcome, TraceColor } from './types'

export const POLICE_CARS: readonly PoliceCarIndex[] = [0, 1, 2]

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
    policeCars: Array<IntersectionId | null>(POLICE_CAR_COUNT).fill(null),
    actedCars: Array<boolean>(POLICE_CAR_COUNT).fill(false),
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
    case 'runner':
      return 'runner'
    case 'ended':
      return null
  }
}

/** 逃亡者が今移動できるビル */
export function runnerMoveTargets(state: GameState): BuildingId[] {
  if (state.phase !== 'runner') return []
  if (state.runnerPosition === null) return [...ALL_BUILDINGS]
  const visited = new Set(state.traces.map((t) => t.building))
  return BUILDING_NEIGHBORS[state.runnerPosition].filter((b) => !visited.has(b))
}

/** 配置フェーズで、そのパトカーを置ける交差点 */
export function placementTargets(state: GameState, car: PoliceCarIndex): IntersectionId[] {
  if (state.phase !== 'setup' || state.policeCars[car] !== null) return []
  return ALL_INTERSECTIONS.filter((i) => !state.policeCars.includes(i))
}

/** 警察フェーズで、そのパトカーが移動できる交差点 */
export function policeMoveTargets(state: GameState, car: PoliceCarIndex): IntersectionId[] {
  const from = activePoliceCarPosition(state, car)
  if (from === null) return []
  return INTERSECTION_NEIGHBORS[from].filter((i) => !state.policeCars.includes(i))
}

/** 警察フェーズで、そのパトカーが捜索できるビル */
export function policeSearchTargets(state: GameState, car: PoliceCarIndex): BuildingId[] {
  const at = activePoliceCarPosition(state, car)
  return at === null ? [] : [...BUILDINGS_AROUND_INTERSECTION[at]]
}

export function getLegalActions(state: GameState): Action[] {
  switch (state.phase) {
    case 'setup':
      return POLICE_CARS.flatMap((car) =>
        placementTargets(state, car).map((intersection): Action => ({
          type: 'placePolice',
          car,
          intersection,
        })),
      )
    case 'runner':
      return runnerMoveTargets(state).map((building): Action => ({ type: 'runnerMove', building }))
    case 'police':
      return POLICE_CARS.flatMap((car) => [
        ...policeMoveTargets(state, car).map((intersection): Action => ({
          type: 'policeMove',
          car,
          intersection,
        })),
        ...policeSearchTargets(state, car).map((building): Action => ({
          type: 'policeSearch',
          car,
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
      return placePolice(state, action.car, action.intersection)
    case 'runnerMove':
      return runnerMove(state, action.building)
    case 'policeMove':
      return policeMove(state, action.car, action.intersection)
    case 'policeSearch':
      return policeSearch(state, action.car, action.building)
  }
}

function placePolice(
  state: GameState,
  car: PoliceCarIndex,
  intersection: IntersectionId,
): GameState {
  if (state.phase !== 'setup') throw new IllegalActionError('Not in setup phase')
  if (state.policeCars[car] !== null) throw new IllegalActionError(`Car ${car} is already placed`)
  if (!placementTargets(state, car).includes(intersection)) {
    throw new IllegalActionError(`Cannot place car ${car} at intersection ${intersection}`)
  }
  const policeCars = state.policeCars.map((p, i) => (i === car ? intersection : p))
  const allPlaced = policeCars.every((p) => p !== null)
  return {
    ...state,
    policeCars,
    ...(allPlaced ? { phase: 'runner' as const, round: 1 } : {}),
  }
}

function runnerMove(state: GameState, building: BuildingId): GameState {
  if (state.phase !== 'runner') throw new IllegalActionError('Not in runner phase')
  if (!runnerMoveTargets(state).includes(building)) {
    throw new IllegalActionError(`Runner cannot move to building ${building}`)
  }
  return {
    ...state,
    phase: 'police',
    runnerPosition: building,
    traces: [...state.traces, { round: state.round, building, found: false }],
    actedCars: state.actedCars.map(() => false),
  }
}

function policeMove(
  state: GameState,
  car: PoliceCarIndex,
  intersection: IntersectionId,
): GameState {
  assertCarCanAct(state, car)
  if (!policeMoveTargets(state, car).includes(intersection)) {
    throw new IllegalActionError(`Car ${car} cannot move to intersection ${intersection}`)
  }
  const moved = {
    ...state,
    policeCars: state.policeCars.map((p, i) => (i === car ? intersection : p)),
  }
  return finishCarAction(moved, car)
}

function policeSearch(state: GameState, car: PoliceCarIndex, building: BuildingId): GameState {
  assertCarCanAct(state, car)
  if (!policeSearchTargets(state, car).includes(building)) {
    throw new IllegalActionError(`Car ${car} cannot search building ${building}`)
  }

  const outcome: SearchOutcome =
    state.runnerPosition === building
      ? 'car'
      : state.traces.some((t) => t.building === building)
        ? 'trace'
        : 'nothing'

  const searched: GameState = {
    ...state,
    traces:
      outcome === 'trace'
        ? state.traces.map((t) => (t.building === building ? { ...t, found: true } : t))
        : state.traces,
    searchLog: [...state.searchLog, { round: state.round, car, building, outcome }],
  }

  if (outcome === 'car') {
    return {
      ...searched,
      phase: 'ended',
      actedCars: searched.actedCars.map((a, i) => (i === car ? true : a)),
      winner: 'police',
      endReason: 'arrested',
    }
  }
  return finishCarAction(searched, car)
}

function finishCarAction(state: GameState, car: PoliceCarIndex): GameState {
  const actedCars = state.actedCars.map((a, i) => (i === car ? true : a))
  if (!actedCars.every(Boolean)) return { ...state, actedCars }

  if (state.round >= MAX_ROUNDS) {
    return { ...state, actedCars, phase: 'ended', winner: 'runner', endReason: 'escaped' }
  }

  const nextRound: GameState = {
    ...state,
    actedCars: actedCars.map(() => false),
    phase: 'runner',
    round: state.round + 1,
  }
  if (runnerMoveTargets(nextRound).length === 0) {
    return { ...nextRound, phase: 'ended', winner: 'police', endReason: 'surrounded' }
  }
  return nextRound
}

function activePoliceCarPosition(state: GameState, car: PoliceCarIndex): IntersectionId | null {
  if (state.phase !== 'police' || state.actedCars[car]) return null
  return state.policeCars[car]
}

function assertCarCanAct(state: GameState, car: PoliceCarIndex): void {
  if (state.phase !== 'police') throw new IllegalActionError('Not in police phase')
  if (!POLICE_CARS.includes(car)) throw new IllegalActionError(`Unknown car ${car}`)
  if (state.actedCars[car]) throw new IllegalActionError(`Car ${car} has already acted`)
}
