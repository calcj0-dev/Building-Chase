import type { BuildingId, IntersectionId } from './board'
import { traceColorForRound } from './game'
import type { EndReason, GameState, Phase, Role, SearchRecord, TraceColor } from './types'

export interface VisibleTrace {
  building: BuildingId
  color: TraceColor
  /** 何手目の痕跡か。警察視点では黄（1）と赤（6）以外は null */
  round: number | null
  found: boolean
}

/** 陣営ごとに見えている情報。UI と CPU はこれだけを参照する */
export interface GameView {
  role: Role
  phase: Phase
  round: number
  policeCars: (IntersectionId | null)[]
  actedCars: boolean[]
  /** 警察視点では決着まで常に null */
  runnerPosition: BuildingId | null
  traces: VisibleTrace[]
  /** 置かれた痕跡の数（ラウンドボードの進行表示用。警察にも分かる情報） */
  traceCount: number
  searchLog: SearchRecord[]
  winner: Role | null
  endReason: EndReason | null
}

export function getView(state: GameState, role: Role): GameView {
  // 決着後はリザルト画面の答え合わせのため、どちらの陣営にも全情報を公開する
  const revealAll = role === 'runner' || state.phase === 'ended'

  const traces: VisibleTrace[] = state.traces
    .filter((t) => revealAll || t.found)
    .map((t) => {
      const color = traceColorForRound(t.round)
      return {
        building: t.building,
        color,
        round: revealAll || color !== 'blue' ? t.round : null,
        found: t.found,
      }
    })

  return {
    role,
    phase: state.phase,
    round: state.round,
    policeCars: [...state.policeCars],
    actedCars: [...state.actedCars],
    runnerPosition: revealAll ? state.runnerPosition : null,
    traces,
    traceCount: state.traces.length,
    searchLog: state.searchLog.map((s) => ({ ...s })),
    winner: state.winner,
    endReason: state.endReason,
  }
}
