/** 0 以上 1 未満を返す乱数。テストでは固定シードのものを渡す */
export type Rng = () => number

/** 再現可能な乱数（mulberry32） */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** スコア最大の要素を返す。同点に近いものは乱数のゆらぎで選ぶ */
export function pickBest<T>(items: T[], score: (item: T) => number, rng: Rng, noise = 1e-6): T {
  let best = items[0]
  let bestScore = -Infinity
  for (const item of items) {
    const s = score(item) + rng() * noise
    if (s > bestScore) {
      bestScore = s
      best = item
    }
  }
  return best
}
