/**
 * ストレージ層。設定と中断データの保存はすべてここを通す。
 * - ブラウザ / PWA: localStorage
 * - Capacitor（将来）: Capacitor Preferences に差し替える
 * localStorage が使えない環境（プライベートモード、容量超過など）でも例外を出さず、
 * その起動中だけメモリに保持して動き続ける。
 */
export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** すべてのキーにこの接頭辞を付ける（同じドメインの他アプリと衝突しないように） */
export const STORAGE_PREFIX = 'building-chase:'

export function createSafeStorage(
  backend: () => Storage | undefined = () => globalThis.localStorage,
): KeyValueStorage {
  const memory = new Map<string, string>()
  const tryBackend = <T>(fn: (s: Storage) => T): T | undefined => {
    try {
      const s = backend()
      return s ? fn(s) : undefined
    } catch {
      return undefined
    }
  }
  return {
    getItem(key) {
      const k = STORAGE_PREFIX + key
      const value = tryBackend((s) => s.getItem(k))
      return value ?? memory.get(k) ?? null
    },
    setItem(key, value) {
      const k = STORAGE_PREFIX + key
      memory.set(k, value)
      tryBackend((s) => s.setItem(k, value))
    },
    removeItem(key) {
      const k = STORAGE_PREFIX + key
      memory.delete(k)
      tryBackend((s) => s.removeItem(k))
    },
  }
}

export const storage: KeyValueStorage = createSafeStorage()
