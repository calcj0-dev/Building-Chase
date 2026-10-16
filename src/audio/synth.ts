/** 音を組み立てる部品。時刻はすべて「鳴らし始める時刻」からの秒数 */
export interface Synth {
  /** 音程のある音。to を指定すると周波数をそこまで滑らせる */
  tone(o: {
    freq: number
    to?: number
    at?: number
    dur: number
    wave?: OscillatorType
    gain?: number
  }): void
  /** 雑音。フィルターの中心周波数（to で滑らせる）で音色を決める */
  noise(o: {
    at?: number
    dur: number
    gain?: number
    filter?: number
    to?: number
    type?: BiquadFilterType
  }): void
}

/** MIDI のノート番号（69 = A4 = 440Hz）を周波数にする */
export function midi(note: number): number {
  return 440 * 2 ** ((note - 69) / 12)
}

const ATTACK = 0.005
const SILENT = 0.0001

/** start（AudioContext の時刻）から鳴らす Synth を作る */
export function createSynth(ctx: AudioContext, out: AudioNode, start: number): Synth {
  /** 立ち上がり 5ms、そこから終わりまで指数的に消える音量の形 */
  const envelope = (at: number, dur: number, gain: number): GainNode => {
    const g = ctx.createGain()
    const t = start + at
    g.gain.setValueAtTime(SILENT, t)
    g.gain.linearRampToValueAtTime(gain, t + ATTACK)
    g.gain.exponentialRampToValueAtTime(SILENT, t + dur)
    g.connect(out)
    return g
  }

  return {
    tone({ freq, to, at = 0, dur, wave = 'triangle', gain = 0.2 }) {
      const t = start + at
      const osc = ctx.createOscillator()
      osc.type = wave
      osc.frequency.setValueAtTime(freq, t)
      if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(to, t + dur)
      osc.connect(envelope(at, dur, gain))
      osc.start(t)
      osc.stop(t + dur + 0.02)
    },

    noise({ at = 0, dur, gain = 0.2, filter = 1000, to, type = 'bandpass' }) {
      const t = start + at
      const src = ctx.createBufferSource()
      src.buffer = noiseBuffer(ctx)
      const f = ctx.createBiquadFilter()
      f.type = type
      f.frequency.setValueAtTime(filter, t)
      if (to !== undefined) f.frequency.exponentialRampToValueAtTime(to, t + dur)
      src.connect(f).connect(envelope(at, dur, gain))
      src.start(t)
      src.stop(t + dur + 0.02)
    },
  }
}

// 雑音の元（1秒分）は AudioContext ごとに1回だけ作る
const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>()

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(ctx)
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    noiseBuffers.set(ctx, buffer)
  }
  return buffer
}
