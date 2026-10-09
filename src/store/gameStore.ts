import { create } from 'zustand'
import { chooseCpuAction, type Rng } from '../ai'
import {
  HELICOPTERS,
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
  type HelicopterIndex,
  type Role,
  type SearchRecord,
} from '../core'

export type PoliceMode = 'move' | 'search'

/** 人が操作する陣営。both は1台の端末で2人が交代で遊ぶ（ホットシート） */
export type HumanSide = Role | 'both'

export interface GameStoreState {
  /** 人が操作する陣営。null の間は陣営選択を表示する */
  humanSide: HumanSide | null
  game: GameState
  /** 警察フェーズで選択中のヘリコプター */
  selectedHelicopter: HelicopterIndex | null
  /** 選択中のヘリコプターの行動（未選択は null） */
  mode: PoliceMode | null
  /** 直前の捜索結果（次の行動まで表示する） */
  lastSearch: SearchRecord | null
  /** ホットシートで端末を渡す相手。null の間は盤面を表示する */
  handoffTo: Role | null
}

export interface GameStoreActions {
  startGame(side: HumanSide): void
  newGame(): void
  backToSelect(): void
  cpuStep(): void
  tapBuilding(building: BuildingId): void
  tapIntersection(intersection: IntersectionId): void
  tapHelicopter(helicopter: HelicopterIndex): void
  chooseMode(mode: PoliceMode): void
  cancelSelection(): void
  dismissHandoff(): void
}

export type GameStore = GameStoreState & GameStoreActions

export function initialStoreState(humanSide: HumanSide | null = 'both'): GameStoreState {
  return {
    humanSide,
    game: createGame(),
    selectedHelicopter: null,
    mode: null,
    lastSearch: null,
    handoffTo: null,
  }
}

/** 今の手番を人が操作するか */
export function isHumanTurn(s: GameStoreState): boolean {
  const role = currentRole(s.game)
  if (role === null || s.humanSide === null) return false
  return s.humanSide === 'both' || s.humanSide === role
}

/** 今の手番を CPU が操作するか */
export function isCpuTurn(s: GameStoreState): boolean {
  return s.humanSide !== null && currentRole(s.game) !== null && !isHumanTurn(s)
}

/** 盤面をどちらの陣営の視点で表示するか */
export function viewRole(s: GameStoreState): Role {
  if (s.humanSide === 'runner' || s.humanSide === 'police') return s.humanSide
  return currentRole(s.game) ?? 'runner'
}

/** 配置フェーズで次に置くヘリコプター */
export function nextHelicopterToPlace(game: GameState): HelicopterIndex | null {
  if (game.phase !== 'setup') return null
  return HELICOPTERS.find((helicopter) => game.helicopters[helicopter] === null) ?? null
}

/** 今光らせるビル */
export function highlightedBuildings(s: GameStoreState): BuildingId[] {
  if (s.handoffTo !== null || !isHumanTurn(s)) return []
  if (s.game.phase === 'hide' || s.game.phase === 'runner') return runnerMoveTargets(s.game)
  if (s.game.phase === 'police' && s.selectedHelicopter !== null && s.mode === 'search') {
    return policeSearchTargets(s.game, s.selectedHelicopter)
  }
  return []
}

/** 今光らせる交差点 */
export function highlightedIntersections(s: GameStoreState): IntersectionId[] {
  if (s.handoffTo !== null || !isHumanTurn(s)) return []
  const helicopter = nextHelicopterToPlace(s.game)
  if (helicopter !== null) return placementTargets(s.game, helicopter)
  if (s.game.phase === 'police' && s.selectedHelicopter !== null && s.mode === 'move') {
    return policeMoveTargets(s.game, s.selectedHelicopter)
  }
  return []
}

export function selectableHelicopters(s: GameStoreState): HelicopterIndex[] {
  if (s.handoffTo !== null || !isHumanTurn(s) || s.game.phase !== 'police') return []
  return HELICOPTERS.filter((helicopter) => !s.game.actedHelicopters[helicopter])
}

/** ストアの遷移ロジック（React 非依存。テストからも直接使う） */
export function reduceStore(s: GameStoreState, event: StoreEvent): GameStoreState {
  switch (event.type) {
    case 'startGame':
      return initialStoreState(event.side)

    case 'newGame':
      return initialStoreState(s.humanSide)

    case 'backToSelect':
      return initialStoreState(null)

    case 'cpuStep':
      if (!isCpuTurn(s)) return s
      return dispatch(s, chooseCpuAction(s.game, event.rng))

    case 'dismissHandoff':
      return { ...s, handoffTo: null }

    case 'cancelSelection':
      return s.mode !== null ? { ...s, mode: null } : { ...s, selectedHelicopter: null }

    case 'tapHelicopter':
      if (!selectableHelicopters(s).includes(event.helicopter)) return s
      if (s.selectedHelicopter === event.helicopter)
        return { ...s, selectedHelicopter: null, mode: null }
      return { ...s, selectedHelicopter: event.helicopter, mode: null }

    case 'chooseMode':
      if (s.selectedHelicopter === null || s.game.phase !== 'police') return s
      return { ...s, mode: event.mode }

    case 'tapIntersection': {
      if (!highlightedIntersections(s).includes(event.intersection)) return s
      const helicopter = nextHelicopterToPlace(s.game)
      if (helicopter !== null) {
        return dispatch(s, { type: 'placePolice', helicopter, intersection: event.intersection })
      }
      if (s.selectedHelicopter === null) return s
      return dispatch(s, {
        type: 'policeMove',
        helicopter: s.selectedHelicopter,
        intersection: event.intersection,
      })
    }

    case 'tapBuilding': {
      if (!highlightedBuildings(s).includes(event.building)) return s
      if (s.game.phase === 'hide' || s.game.phase === 'runner') {
        return dispatch(s, { type: 'runnerMove', building: event.building })
      }
      if (s.selectedHelicopter === null) return s
      return dispatch(s, {
        type: 'policeSearch',
        helicopter: s.selectedHelicopter,
        building: event.building,
      })
    }
  }
}

export type StoreEvent =
  | { type: 'startGame'; side: HumanSide }
  | { type: 'newGame' }
  | { type: 'backToSelect' }
  | { type: 'cpuStep'; rng?: Rng }
  | { type: 'dismissHandoff' }
  | { type: 'cancelSelection' }
  | { type: 'tapHelicopter'; helicopter: HelicopterIndex }
  | { type: 'chooseMode'; mode: PoliceMode }
  | { type: 'tapIntersection'; intersection: IntersectionId }
  | { type: 'tapBuilding'; building: BuildingId }

function dispatch(s: GameStoreState, action: Action): GameStoreState {
  const before = currentRole(s.game)
  const game = applyAction(s.game, action)
  const after = currentRole(game)
  // 端末の受け渡しはホットシートのときだけ
  const roleChanged =
    s.humanSide === 'both' && before !== null && after !== null && before !== after
  return {
    humanSide: s.humanSide,
    game,
    selectedHelicopter: null,
    mode: null,
    lastSearch: action.type === 'policeSearch' ? (game.searchLog.at(-1) ?? null) : null,
    handoffTo: roleChanged ? after : null,
  }
}

export const useGameStore = create<GameStore>()((set) => {
  const send = (event: StoreEvent) => set((s) => reduceStore(s, event))
  return {
    ...initialStoreState(null),
    startGame: (side) => send({ type: 'startGame', side }),
    newGame: () => send({ type: 'newGame' }),
    backToSelect: () => send({ type: 'backToSelect' }),
    cpuStep: () => send({ type: 'cpuStep' }),
    tapBuilding: (building) => send({ type: 'tapBuilding', building }),
    tapIntersection: (intersection) => send({ type: 'tapIntersection', intersection }),
    tapHelicopter: (helicopter) => send({ type: 'tapHelicopter', helicopter }),
    chooseMode: (mode) => send({ type: 'chooseMode', mode }),
    cancelSelection: () => send({ type: 'cancelSelection' }),
    dismissHandoff: () => send({ type: 'dismissHandoff' }),
  }
})
