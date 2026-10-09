import { describe, expect, it } from 'vitest'
import { STORAGE_PREFIX, createSafeStorage } from '.'

function fakeLocalStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  }
}

describe('createSafeStorage', () => {
  it('stores values under a prefixed key', () => {
    const ls = fakeLocalStorage()
    const s = createSafeStorage(() => ls)
    s.setItem('settings', '{"a":1}')
    expect(ls.getItem(STORAGE_PREFIX + 'settings')).toBe('{"a":1}')
    expect(s.getItem('settings')).toBe('{"a":1}')
    s.removeItem('settings')
    expect(s.getItem('settings')).toBeNull()
  })

  it('keeps working in memory when localStorage throws', () => {
    const broken = () => {
      throw new Error('SecurityError')
    }
    const s = createSafeStorage(broken)
    expect(s.getItem('x')).toBeNull()
    expect(() => s.setItem('x', '1')).not.toThrow()
    expect(s.getItem('x')).toBe('1')
  })

  it('keeps working when localStorage is missing', () => {
    const s = createSafeStorage(() => undefined)
    s.setItem('x', '1')
    expect(s.getItem('x')).toBe('1')
  })
})
