import { currentRole, getView, type Action, type GameState } from '../core'
import { choosePoliceAction } from './police'
import type { Rng } from './random'
import { chooseRunnerAction } from './runner'

export { inferRunner } from './inference'
export { choosePoliceAction } from './police'
export { seededRng, type Rng } from './random'
export { chooseRunnerAction } from './runner'

/** 今の手番の陣営として CPU の行動を1つ選ぶ。警察には警察視点の情報だけを渡す */
export function chooseCpuAction(state: GameState, rng: Rng = Math.random): Action {
  const role = currentRole(state)
  if (role === 'police') return choosePoliceAction(getView(state, 'police'), rng)
  if (role === 'runner') return chooseRunnerAction(state, rng)
  throw new Error('The game has ended')
}
