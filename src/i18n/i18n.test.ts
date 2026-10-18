import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import ja from './locales/ja.json'

/** ネストした翻訳ファイルのキーを "a.b.c" の形で列挙する */
function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

/** 文中の {{name}} の一覧 */
function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort()
}

function lookup(obj: object, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], obj)
}

describe('translations', () => {
  it('has the same keys in Japanese and English', () => {
    expect(keys(en).sort()).toEqual(keys(ja).sort())
  })

  it('uses the same placeholders in both languages', () => {
    for (const key of keys(ja)) {
      expect(placeholders(String(lookup(en, key))), key).toEqual(
        placeholders(String(lookup(ja, key))),
      )
    }
  })

  it('never mentions the original board game by name', () => {
    const text = JSON.stringify([ja, en])
    // 原作名そのものをリポジトリに書かないよう、文字コードで表す（仕様書 5.7）
    expect(text).not.toMatch(
      /\u30b7\u30c6\u30a3\u30c1\u30a7\u30a4\u30b9|\x43\x69\x74\x79\s*\x43\x68\x61\x73\x65/i,
    )
  })
})
