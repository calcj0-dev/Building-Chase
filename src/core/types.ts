import type { BuildingId, IntersectionId } from './board'

export type Role = 'runner' | 'police'

/** setup: 警察の配置 / runner: 逃亡者フェーズ / police: 警察フェーズ / ended: 決着 */
export type Phase = 'setup' | 'runner' | 'police' | 'ended'

export type EndReason = 'arrested' | 'surrounded' | 'escaped'

/** 1番目は黄、6番目は赤、その他は青（何手目か分からない） */
export type TraceColor = 'yellow' | 'red' | 'blue'

export type PoliceCarIndex = 0 | 1 | 2

export interface Trace {
  round: number
  building: BuildingId
  found: boolean
}

export type SearchOutcome = 'nothing' | 'trace' | 'car'

export interface SearchRecord {
  round: number
  car: PoliceCarIndex
  building: BuildingId
  outcome: SearchOutcome
}

export interface GameState {
  phase: Phase
  /** 現在のラウンド（1〜11）。配置フェーズ中は 0 */
  round: number
  /** パトカーの位置。配置前は null */
  policeCars: (IntersectionId | null)[]
  /** 警察フェーズ中に行動済みのパトカー */
  actedCars: boolean[]
  /** 逃亡者の車の位置。Round 1 の移動前は null */
  runnerPosition: BuildingId | null
  /** ラウンド順の痕跡 */
  traces: Trace[]
  searchLog: SearchRecord[]
  winner: Role | null
  endReason: EndReason | null
}

export type Action =
  | { type: 'placePolice'; car: PoliceCarIndex; intersection: IntersectionId }
  | { type: 'runnerMove'; building: BuildingId }
  | { type: 'policeMove'; car: PoliceCarIndex; intersection: IntersectionId }
  | { type: 'policeSearch'; car: PoliceCarIndex; building: BuildingId }
