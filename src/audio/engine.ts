import { TRACKS, type TrackId } from './music'
import { SOUNDS, type SoundId } from './sounds'
import { createSynth } from './synth'

/**
 * 音を鳴らすエンジン。画面からはこの形だけを使うので、
 * 合成音の代わりに音声ファイルを鳴らすエンジンを作れば丸ごと差し替えられる
 */
export interface AudioEngine {
  /** ユーザーの操作の中で呼ぶ。ブラウザの自動再生の制限で、これより前は音が鳴らない */
  unlock(): void
  play(id: SoundId): void
  /** 流したい BGM（null で止める）。BGM が OFF の間や unlock 前は覚えておくだけ */
  setBgm(id: TrackId | null): void
  setEnabled(enabled: { bgm: boolean; se: boolean }): void
}

/** 全体の音量（各音の音量は sounds.ts / music.ts で 0.1 前後にそろえている） */
export const MASTER_GAIN = 2.4
/** BGM は効果音より控えめにする */
export const BGM_GAIN = 0.35
/** BGM を何秒先まで予約しておくか */
const LOOKAHEAD_SEC = 0.15
const SCHEDULE_INTERVAL_MS = 25
const FADE_SEC = 0.3

interface PlayingTrack {
  id: TrackId
  bus: GainNode
  timer: ReturnType<typeof setInterval>
}

/** Web Audio API で合成した音を鳴らすエンジン。AudioContext がない環境では何もしない */
export function createSynthEngine(): AudioEngine {
  let ctx: AudioContext | null = null
  let seBus: GainNode | null = null
  let bgmBus: GainNode | null = null
  let enabled = { bgm: true, se: true }
  let wanted: TrackId | null = null
  let playing: PlayingTrack | null = null

  const startTrack = (id: TrackId) => {
    if (!ctx || !bgmBus) return
    const c = ctx
    const track = TRACKS[id]
    const bus = c.createGain()
    bus.gain.setValueAtTime(0.0001, c.currentTime)
    bus.gain.exponentialRampToValueAtTime(1, c.currentTime + FADE_SEC)
    bus.connect(bgmBus)
    let step = 0
    let next = c.currentTime + 0.05
    const schedule = () => {
      // バックグラウンドから戻ったときなどに遅れていたら、まとめて鳴らさず今から再開する
      if (next < c.currentTime) next = c.currentTime + 0.05
      while (next < c.currentTime + LOOKAHEAD_SEC) {
        track.play(step % track.length, createSynth(c, bus, next))
        step++
        next += track.stepSec
      }
    }
    schedule()
    playing = { id, bus, timer: setInterval(schedule, SCHEDULE_INTERVAL_MS) }
  }

  const stopTrack = () => {
    if (!playing || !ctx) return
    const { bus, timer } = playing
    clearInterval(timer)
    bus.gain.cancelScheduledValues(ctx.currentTime)
    bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime)
    bus.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_SEC)
    setTimeout(() => bus.disconnect(), FADE_SEC * 1000 + 100)
    playing = null
  }

  const syncBgm = () => {
    const target = ctx && enabled.bgm ? wanted : null
    if (playing?.id === target) return
    stopTrack()
    if (target) startTrack(target)
  }

  // 画面が隠れている間（別のタブ・アプリ）は音を止める
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return
      if (document.hidden) void ctx.suspend()
      else void ctx.resume()
    })
  }

  return {
    unlock() {
      if (!ctx) {
        const Ctor =
          globalThis.AudioContext ??
          (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!Ctor) return
        ctx = new Ctor()
        // 音が重なっても割れないように、最後にリミッター（コンプレッサー）を通す
        const limiter = ctx.createDynamicsCompressor()
        limiter.threshold.value = -6
        limiter.ratio.value = 12
        limiter.connect(ctx.destination)
        const master = ctx.createGain()
        master.gain.value = MASTER_GAIN
        master.connect(limiter)
        seBus = ctx.createGain()
        seBus.connect(master)
        bgmBus = ctx.createGain()
        bgmBus.gain.value = BGM_GAIN
        bgmBus.connect(master)
      }
      if (ctx.state === 'suspended') void ctx.resume()
      syncBgm()
    },

    play(id) {
      if (!ctx || !seBus || !enabled.se) return
      SOUNDS[id](createSynth(ctx, seBus, ctx.currentTime + 0.01))
    },

    setBgm(id) {
      wanted = id
      syncBgm()
    },

    setEnabled(next) {
      enabled = next
      syncBgm()
    },
  }
}
