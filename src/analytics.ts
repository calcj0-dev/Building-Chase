import { inject, track } from '@vercel/analytics'
import type { CpuLevel } from './ai'
import type { EndReason, Role } from './core'
import type { HumanSide } from './store/gameStore'

/**
 * アクセス解析（Vercel Web Analytics）。個人を特定せず、Cookie も使わない。
 * ページの閲覧と再訪は自動で数える。ゲームの開始と決着はイベントとして送る
 * （イベントは Vercel の有料プランで表示される。無料プランでは送っても表示されないだけ）
 */
export function startAnalytics() {
  inject()
}

export function trackGameStart(side: HumanSide, cpuLevel: CpuLevel) {
  track('game_start', { side, cpuLevel: side === 'both' ? 'none' : cpuLevel })
}

export function trackGameEnd(side: HumanSide, cpuLevel: CpuLevel, winner: Role, reason: EndReason) {
  track('game_end', {
    side,
    cpuLevel: side === 'both' ? 'none' : cpuLevel,
    winner,
    reason,
    // VS CPU で人が勝ったか
    humanWon: side === 'both' ? 'none' : String(side === winner),
  })
}
