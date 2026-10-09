import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { storage } from '../storage'

/** 盤面の視点。top: 真上から / tilt: 正面から浅く傾ける */
export type ViewMode = 'top' | 'tilt'

export const LANGUAGES = ['ja', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

interface SettingsState {
  language: Language
  viewMode: ViewMode
  setLanguage(language: Language): void
  setViewMode(mode: ViewMode): void
}

/** 端末に保存する設定（ストレージ層経由） */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'ja',
      viewMode: 'top',
      setLanguage: (language) => set({ language }),
      setViewMode: (viewMode) => set({ viewMode }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => storage),
      partialize: (s) => ({ language: s.language, viewMode: s.viewMode }),
      // 保存された値が壊れていても既定値で起動する
      merge: (saved, current) => {
        const s = (saved ?? {}) as Partial<SettingsState>
        return {
          ...current,
          language: LANGUAGES.includes(s.language as Language) ? (s.language as Language) : 'ja',
          viewMode: s.viewMode === 'tilt' ? 'tilt' : 'top',
        }
      },
    },
  ),
)
