import { midi, type Synth } from './synth'

/** BGM の種類 */
export type TrackId = 'title' | 'game'

/** ループする BGM。step 番目の音を synth で鳴らす */
export interface Track {
  /** 1ステップの長さ（秒） */
  stepSec: number
  /** ループの長さ（ステップ数） */
  length: number
  play(step: number, s: Synth): void
}

/** 小節ごとの和音（MIDI のノート番号。根音・3度・5度） */
type Chord = [number, number, number]

// タイトル: Am → F → C → G の落ち着いた分散和音（92 BPM、8分音符）
const TITLE_CHORDS: Chord[] = [
  [57, 60, 64],
  [53, 57, 60],
  [60, 64, 67],
  [55, 59, 62],
]
// 1小節8音の分散和音（3 は根音の1オクターブ上）
const TITLE_ARPEGGIO = [0, 1, 2, 3, 2, 1, 2, 1]

const title: Track = {
  stepSec: 60 / 92 / 2,
  length: 32,
  play(step, s) {
    const chord = TITLE_CHORDS[Math.floor(step / 8)]
    const i = TITLE_ARPEGGIO[step % 8]
    const note = i === 3 ? chord[0] + 12 : chord[i]
    s.tone({ freq: midi(note + 12), dur: 0.3, wave: 'triangle', gain: 0.07 })
    if (step % 4 === 0) s.tone({ freq: midi(chord[0] - 12), dur: 1.1, wave: 'sine', gain: 0.12 })
  },
}

// ゲーム中: Dm の緊張感のあるベースと時計のような刻み（120 BPM、16分音符）
const GAME_ROOTS = [38, 38, 34, 36] // D2, D2, B♭1, C2
// 8分音符ごとのベース（根音からの音程）
const GAME_BASS = [0, 0, 12, 0, 0, 12, 10, 7]

const game: Track = {
  stepSec: 60 / 120 / 4,
  length: 64,
  play(step, s) {
    const root = GAME_ROOTS[Math.floor(step / 16)]
    const inBar = step % 16
    if (inBar % 2 === 0) {
      s.tone({ freq: midi(root + GAME_BASS[inBar / 2]), dur: 0.2, wave: 'triangle', gain: 0.13 })
    }
    // バスドラム（1・3拍目）
    if (inBar % 8 === 0) s.tone({ freq: 130, to: 45, dur: 0.16, wave: 'sine', gain: 0.22 })
    // ハイハット（裏拍）
    if (inBar % 4 === 2) s.noise({ dur: 0.04, filter: 7000, type: 'highpass', gain: 0.035 })
    // 時計の刻み（拍ごと）
    if (inBar % 4 === 0) s.tone({ freq: 1760, dur: 0.03, wave: 'sine', gain: 0.025 })
    // 2小節ごとに高い音で不安をあおる
    if (step % 32 === 28) s.tone({ freq: midi(root + 39), dur: 0.5, wave: 'sine', gain: 0.03 })
  },
}

export const TRACKS: Record<TrackId, Track> = { title, game }
