import type { BuildingId, IntersectionId } from './board'

export type Role = 'runner' | 'police'

/**
 * setup: 警察がヘリコプターを配置 / hide: 逃亡者がスタート地点に隠れる（ゲーム開始前）/
 * runner: 逃亡者フェーズ / police: 警察フェーズ / ended: 決着
 */
export type Phase = 'setup' | 'hide' | 'runner' | 'police' | 'ended'

export type EndReason = 'arrested' | 'surrounded' | 'escaped'

/** 1番目は黄、6番目は赤、その他は青（何手目か分からない） */
export type TraceColor = 'yellow' | 'red' | 'blue'

export type HelicopterIndex = 0 | 1 | 2

/** 逃亡者が移動したときに、元いたビルに残す痕跡 */
export interface Trace {
  round: number
  building: BuildingId
  found: boolean
}

export type SearchOutcome = 'nothing' | 'trace' | 'runner'

export interface SearchRecord {
  round: number
  helicopter: HelicopterIndex
  building: BuildingId
  outcome: SearchOutcome
}

export interface GameState {
  phase: Phase
  /** 現在のラウンド（1〜11、12 は最後の捜索）。ゲーム開始前（setup / hide）は 0 */
  round: number
  /** ヘリコプターの位置。配置前は null */
  helicopters: (IntersectionId | null)[]
  /** 警察フェーズ中に行動済みのヘリコプター */
  actedHelicopters: boolean[]
  /** 逃亡者の位置。スタート地点に隠れる前は null */
  runnerPosition: BuildingId | null
  /** ラウンド順の痕跡（Round n の移動で、移動前のビルに n 番目の痕跡を残す） */
  traces: Trace[]
  searchLog: SearchRecord[]
  winner: Role | null
  endReason: EndReason | null
}

export type Action =
  | { type: 'placePolice'; helicopter: HelicopterIndex; intersection: IntersectionId }
  | { type: 'runnerMove'; building: BuildingId }
  | { type: 'policeMove'; helicopter: HelicopterIndex; intersection: IntersectionId }
  | { type: 'policeSearch'; helicopter: HelicopterIndex; building: BuildingId }
