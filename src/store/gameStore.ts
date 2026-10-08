import { create } from 'zustand'
import {
  POLICE_CARS,
  applyAction,
  createGame,
  currentRole,
  placementTargets,
  policeMoveTargets,
  policeSearchTargets,
  runnerMoveTargets,
  type Action,
  type BuildingId,
  type GameState,
  type IntersectionId,
  type PoliceCarIndex,
  type Role,
  type SearchRecord,
} from '../core'

export type PoliceMode = 'move' | 'search'

export interface GameStoreState {
  game: GameState
  /** 警察フェーズで選択中のパトカー */
  selectedCar: PoliceCarIndex | null
  /** 選択中のパトカーの行動（未選択は null） */
  mode: PoliceMode | null
  /** 直前の捜索結果（次の行動まで表示する） */
  lastSearch: SearchRecord | null
  /** ホットシートで端末を渡す相手。null の間は盤面を表示する */
  handoffTo: Role | null
}

export interface GameStoreActions {
  newGame(): void
  tapBuilding(building: BuildingId): void
  tapIntersection(intersection: IntersectionId): void
  tapPoliceCar(car: PoliceCarIndex): void
  chooseMode(mode: PoliceMode): void
  cancelSelection(): void
  dismissHandoff(): void
}

export type GameStore = GameStoreState & GameStoreActions

export function initialStoreState(): GameStoreState {
  return { game: createGame(), selectedCar: null, mode: null, lastSearch: null, handoffTo: null }
}

/** 配置フェーズで次に置くパトカー */
export function nextCarToPlace(game: GameState): PoliceCarIndex | null {
  if (game.phase !== 'setup') return null
  return POLICE_CARS.find((car) => game.policeCars[car] === null) ?? null
}

/** 今光らせるビル */
export function highlightedBuildings(s: GameStoreState): BuildingId[] {
  if (s.handoffTo !== null) return []
  if (s.game.phase === 'runner') return runnerMoveTargets(s.game)
  if (s.game.phase === 'police' && s.selectedCar !== null && s.mode === 'search') {
    return policeSearchTargets(s.game, s.selectedCar)
  }
  return []
}

/** 今光らせる交差点 */
export function highlightedIntersections(s: GameStoreState): IntersectionId[] {
  if (s.handoffTo !== null) return []
  const car = nextCarToPlace(s.game)
  if (car !== null) return placementTargets(s.game, car)
  if (s.game.phase === 'police' && s.selectedCar !== null && s.mode === 'move') {
    return policeMoveTargets(s.game, s.selectedCar)
  }
  return []
}

export function selectableCars(s: GameStoreState): PoliceCarIndex[] {
  if (s.handoffTo !== null || s.game.phase !== 'police') return []
  return POLICE_CARS.filter((car) => !s.game.actedCars[car])
}

/** ストアの遷移ロジック（React 非依存。テストからも直接使う） */
export function reduceStore(s: GameStoreState, event: StoreEvent): GameStoreState {
  switch (event.type) {
    case 'newGame':
      return initialStoreState()

    case 'dismissHandoff':
      return { ...s, handoffTo: null }

    case 'cancelSelection':
      return s.mode !== null ? { ...s, mode: null } : { ...s, selectedCar: null }

    case 'tapPoliceCar':
      if (!selectableCars(s).includes(event.car)) return s
      if (s.selectedCar === event.car) return { ...s, selectedCar: null, mode: null }
      return { ...s, selectedCar: event.car, mode: null }

    case 'chooseMode':
      if (s.selectedCar === null || s.game.phase !== 'police') return s
      return { ...s, mode: event.mode }

    case 'tapIntersection': {
      if (!highlightedIntersections(s).includes(event.intersection)) return s
      const car = nextCarToPlace(s.game)
      if (car !== null) {
        return dispatch(s, { type: 'placePolice', car, intersection: event.intersection })
      }
      if (s.selectedCar === null) return s
      return dispatch(s, {
        type: 'policeMove',
        car: s.selectedCar,
        intersection: event.intersection,
      })
    }

    case 'tapBuilding': {
      if (!highlightedBuildings(s).includes(event.building)) return s
      if (s.game.phase === 'runner') {
        return dispatch(s, { type: 'runnerMove', building: event.building })
      }
      if (s.selectedCar === null) return s
      return dispatch(s, { type: 'policeSearch', car: s.selectedCar, building: event.building })
    }
  }
}

export type StoreEvent =
  | { type: 'newGame' }
  | { type: 'dismissHandoff' }
  | { type: 'cancelSelection' }
  | { type: 'tapPoliceCar'; car: PoliceCarIndex }
  | { type: 'chooseMode'; mode: PoliceMode }
  | { type: 'tapIntersection'; intersection: IntersectionId }
  | { type: 'tapBuilding'; building: BuildingId }

function dispatch(s: GameStoreState, action: Action): GameStoreState {
  const before = currentRole(s.game)
  const game = applyAction(s.game, action)
  const after = currentRole(game)
  const roleChanged = before !== null && after !== null && before !== after
  return {
    game,
    selectedCar: null,
    mode: null,
    lastSearch: action.type === 'policeSearch' ? (game.searchLog.at(-1) ?? null) : null,
    handoffTo: roleChanged ? after : null,
  }
}

export const useGameStore = create<GameStore>()((set) => {
  const send = (event: StoreEvent) => set((s) => reduceStore(s, event))
  return {
    ...initialStoreState(),
    newGame: () => send({ type: 'newGame' }),
    tapBuilding: (building) => send({ type: 'tapBuilding', building }),
    tapIntersection: (intersection) => send({ type: 'tapIntersection', intersection }),
    tapPoliceCar: (car) => send({ type: 'tapPoliceCar', car }),
    chooseMode: (mode) => send({ type: 'chooseMode', mode }),
    cancelSelection: () => send({ type: 'cancelSelection' }),
    dismissHandoff: () => send({ type: 'dismissHandoff' }),
  }
})
