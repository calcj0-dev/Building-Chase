import { traceColorForRound, type GameState } from '../core'
import type { SoundId } from './sounds'

/**
 * 1手の前後の状態から、鳴らす効果音を決める（人の操作でも CPU の行動でも同じ）。
 * 新しいゲームが始まったとき（記録が減ったとき）は何も鳴らさない
 */
export function soundsForTransition(prev: GameState, next: GameState): SoundId[] {
  if (
    next.traces.length < prev.traces.length ||
    next.searchLog.length < prev.searchLog.length ||
    next.round < prev.round
  ) {
    return []
  }

  const sounds: SoundId[] = []
  const search = next.searchLog.length > prev.searchLog.length ? next.searchLog.at(-1) : undefined
  if (search) {
    sounds.push('search')
    if (search.outcome === 'runner') {
      sounds.push('arrest')
    } else if (search.outcome === 'nothing') {
      sounds.push('nothing')
    } else {
      const trace = next.traces.find((t) => t.building === search.building)
      const key = trace !== undefined && traceColorForRound(trace.round) !== 'blue'
      sounds.push(key ? 'keyTrace' : 'trace')
    }
  }
  if (next.helicopters.some((p, i) => p !== null && p !== prev.helicopters[i])) {
    sounds.push('helicopterMove')
  }
  if (next.runnerPosition !== null && next.runnerPosition !== prev.runnerPosition) {
    sounds.push('runnerMove')
  }
  // 包囲は警察の手番の終わりに決まる（逃亡者が動けない）
  if (next.endReason === 'surrounded' && prev.endReason === null) sounds.push('arrest')
  return sounds
}
