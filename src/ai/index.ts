import { currentRole, getView, type Action, type GameState } from '../core'
import type { CpuLevel } from './level'
import { choosePoliceAction } from './police'
import type { Rng } from './random'
import { chooseRunnerAction } from './runner'

export { inferRunner } from './inference'
export { CPU_LEVELS, type CpuLevel } from './level'
export { choosePoliceAction } from './police'
export { seededRng, type Rng } from './random'
export { chooseRunnerAction } from './runner'

/** 今の手番の陣営として CPU の行動を1つ選ぶ。警察には警察視点の情報だけを渡す */
export function chooseCpuAction(
  state: GameState,
  rng: Rng = Math.random,
  level: CpuLevel = 'strong',
): Action {
  const role = currentRole(state)
  if (role === 'police') return choosePoliceAction(getView(state, 'police'), rng, level)
  if (role === 'runner') return chooseRunnerAction(state, rng, level)
  throw new Error('The game has ended')
}
