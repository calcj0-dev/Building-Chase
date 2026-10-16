import { midi, type Synth } from './synth'

/** 捜索でビルの中を探す時間（秒）。画面の演出も同じ長さで、結果の音はその後に鳴らす */
export const SEARCH_SCAN_SEC = 0.9
const R = SEARCH_SCAN_SEC

/** 効果音の種類 */
export type SoundId =
  | 'tap'
  | 'helicopterMove'
  | 'runnerMove'
  | 'search'
  | 'nothing'
  | 'trace'
  | 'keyTrace'
  | 'arrest'
  | 'yourTurn'
  | 'enemyTurn'
  | 'victory'
  | 'defeat'

/**
 * 効果音の作り方。音声ファイルは使わず、その場で合成する。
 * 素材の音声ファイルに替えるときは、この表の代わりにファイルを鳴らすエンジンを作る（engine.ts）
 */
export const SOUNDS: Record<SoundId, (s: Synth) => void> = {
  // ボタン: 短い「ピッ」
  tap: (s) => s.tone({ freq: 1320, dur: 0.05, gain: 0.12 }),

  // ヘリコプターの配置・移動: 「ヒュン」と風切り音
  helicopterMove: (s) => {
    s.tone({ freq: 260, to: 520, dur: 0.18, gain: 0.12 })
    s.noise({ dur: 0.22, filter: 600, to: 1800, gain: 0.12 })
  },

  // 逃亡者の移動: 足音2歩
  runnerMove: (s) => {
    s.tone({ freq: 190, to: 110, dur: 0.07, wave: 'square', gain: 0.07 })
    s.tone({ freq: 170, to: 100, at: 0.12, dur: 0.07, wave: 'square', gain: 0.07 })
  },

  // 捜索: サーチライトで探し回る「ウィーン…ウィーン」とスキャナーの「ピッ」
  search: (s) => {
    s.noise({ dur: 0.45, filter: 500, to: 1800, gain: 0.12 })
    s.noise({ at: 0.45, dur: 0.45, filter: 1800, to: 500, gain: 0.12 })
    for (const at of [0.1, 0.4, 0.7])
      s.tone({ freq: 1500, at, dur: 0.05, wave: 'sine', gain: 0.06 })
  },

  // 何もなかった: 下がる2音
  nothing: (s) => {
    s.tone({ freq: midi(69), at: R, dur: 0.12, gain: 0.14 })
    s.tone({ freq: midi(64), at: R + 0.12, dur: 0.18, gain: 0.14 })
  },

  // 痕跡を発見: 上がる2音「ピロッ」
  trace: (s) => {
    s.tone({ freq: midi(76), at: R, dur: 0.1, wave: 'square', gain: 0.07 })
    s.tone({ freq: midi(81), at: R + 0.08, dur: 0.22, wave: 'square', gain: 0.07 })
  },

  // 重要な痕跡（黄・赤）: ドミソドの分散和音
  keyTrace: (s) => {
    ;[72, 76, 79, 84].forEach((note, i) =>
      s.tone({
        freq: midi(note),
        at: R + i * 0.08,
        dur: i === 3 ? 0.45 : 0.12,
        wave: 'square',
        gain: 0.07,
      }),
    )
  },

  // 逮捕: サイレン（高い音と低い音を交互に）
  arrest: (s) => {
    for (let i = 0; i < 6; i++) {
      s.tone({
        freq: i % 2 === 0 ? 960 : 720,
        at: R + i * 0.22,
        dur: 0.21,
        wave: 'square',
        gain: 0.06,
      })
    }
  },

  // 自分の番: 明るく上がる2音
  yourTurn: (s) => {
    s.tone({ freq: midi(72), dur: 0.1, gain: 0.15 })
    s.tone({ freq: midi(79), at: 0.1, dur: 0.25, gain: 0.15 })
  },

  // 相手の番: 低く不穏な2音
  enemyTurn: (s) => {
    s.tone({ freq: midi(50), dur: 0.14, wave: 'sawtooth', gain: 0.06 })
    s.tone({ freq: midi(49), at: 0.14, dur: 0.3, wave: 'sawtooth', gain: 0.06 })
  },

  // 勝ち: ファンファーレ
  victory: (s) => {
    const notes: [number, number, number][] = [
      [72, 0, 0.12],
      [76, 0.12, 0.12],
      [79, 0.24, 0.12],
      [84, 0.36, 0.5],
    ]
    for (const [note, at, dur] of notes) {
      s.tone({ freq: midi(note), at, dur, wave: 'square', gain: 0.07 })
      s.tone({ freq: midi(note - 12), at, dur, gain: 0.1 })
    }
  },

  // 負け: ゆっくり下がる音
  defeat: (s) => {
    ;[67, 66, 65, 64].forEach((note, i) =>
      s.tone({ freq: midi(note), at: i * 0.22, dur: i === 3 ? 0.6 : 0.2, gain: 0.14 }),
    )
  },
}
