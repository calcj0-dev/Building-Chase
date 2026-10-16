import { createSynthEngine, type AudioEngine } from './engine'

export type { AudioEngine } from './engine'
export { soundsForTransition } from './gameSounds'
export type { TrackId } from './music'
export { SEARCH_SCAN_SEC, type SoundId } from './sounds'

/** アプリ全体で使う音のエンジン（音声ファイルを使わず、その場で合成する） */
export const audio: AudioEngine = createSynthEngine()
