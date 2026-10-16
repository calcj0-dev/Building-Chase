import { describe, expect, it } from 'vitest'
import { applyAction, createGame, type GameState } from '../core'
import { hideAt, placeAll, playRounds, searchAll } from '../core/testUtils'
import { createSynthEngine } from './engine'
import { soundsForTransition } from './gameSounds'

// ビル ID           交差点 ID
//  0  1  2  3  4      0  1  2  3
//  5  6  7  8  9      4  5  6  7
// 10 11 12 13 14      8  9 10 11
// 15 16 17 18 19     12 13 14 15
// 20 21 22 23 24

const IDLE_SEARCHES: [number, number, number] = [24, 20, 4]

/** ヘリコプター: 交差点5（ビル 6, 7, 11, 12）/ 6（7, 8, 12, 13）/ 10（12, 13, 17, 18）。逃亡者は 12 に隠れる */
const hidden = () => hideAt(placeAll([5, 6, 10]), 12)

function soundsOf(prev: GameState, action: Parameters<typeof applyAction>[1]) {
  return soundsForTransition(prev, applyAction(prev, action))
}

describe('soundsForTransition', () => {
  it('plays the helicopter sound when placing and moving', () => {
    expect(soundsOf(createGame(), { type: 'placePolice', helicopter: 0, intersection: 5 })).toEqual(
      ['helicopterMove'],
    )
    expect(soundsOf(hidden(), { type: 'policeMove', helicopter: 0, intersection: 4 })).toEqual([
      'helicopterMove',
    ])
  })

  it('plays footsteps when the runner hides and moves', () => {
    expect(soundsOf(placeAll([5, 6, 10]), { type: 'runnerMove', building: 12 })).toEqual([
      'runnerMove',
    ])
    const s = searchAll(hidden(), [6, 8, 18])
    expect(soundsOf(s, { type: 'runnerMove', building: 7 })).toEqual(['runnerMove'])
  })

  it('plays the search sound followed by its result', () => {
    expect(soundsOf(hidden(), { type: 'policeSearch', helicopter: 0, building: 6 })).toEqual([
      'search',
      'nothing',
    ])
    expect(soundsOf(hidden(), { type: 'policeSearch', helicopter: 0, building: 12 })).toEqual([
      'search',
      'arrest',
    ])
  })

  it('tells the yellow and red traces apart from the blue ones', () => {
    // 12 に隠れて 7 → 2 と動く（12 に黄、7 に青の痕跡）
    let s = searchAll(hidden(), [6, 8, 18])
    s = applyAction(s, { type: 'runnerMove', building: 7 })
    s = searchAll(s, [6, 8, 18])
    s = applyAction(s, { type: 'runnerMove', building: 2 })
    expect(soundsOf(s, { type: 'policeSearch', helicopter: 2, building: 12 })).toEqual([
      'search',
      'keyTrace',
    ])
    expect(soundsOf(s, { type: 'policeSearch', helicopter: 0, building: 7 })).toEqual([
      'search',
      'trace',
    ])
  })

  it('plays the arrest sound when the runner is surrounded', () => {
    // 5 に隠れて 6 → 1 → 0 と動くと、ビル0の隣（1, 5）はどちらも痕跡あり
    let s = playRounds(placeAll([15, 12, 3]), [5, 6, 1, 0], IDLE_SEARCHES)
    s = applyAction(s, { type: 'policeSearch', helicopter: 0, building: 24 })
    s = applyAction(s, { type: 'policeSearch', helicopter: 1, building: 20 })
    expect(soundsOf(s, { type: 'policeSearch', helicopter: 2, building: 4 })).toEqual([
      'search',
      'nothing',
      'arrest',
    ])
  })

  it('stays silent when a new game starts', () => {
    const ended = applyAction(hidden(), { type: 'policeSearch', helicopter: 0, building: 12 })
    expect(soundsForTransition(ended, createGame())).toEqual([])
  })
})

describe('createSynthEngine', () => {
  it('does nothing where Web Audio is not available', () => {
    const engine = createSynthEngine()
    expect(() => {
      engine.unlock()
      engine.setEnabled({ bgm: true, se: true })
      engine.setBgm('game')
      engine.play('tap')
      engine.setBgm(null)
    }).not.toThrow()
  })
})
