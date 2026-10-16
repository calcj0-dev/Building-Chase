/** CPU の強さ。normal は手加減した CPU、strong は推理を最後まで使う CPU */
export const CPU_LEVELS = ['normal', 'strong'] as const
export type CpuLevel = (typeof CPU_LEVELS)[number]

/** 普通の逃亡者が危険を読まずに適当に移動する割合（行き止まりは避ける） */
export const NORMAL_RUNNER_MISTAKE_RATE = 0.3
