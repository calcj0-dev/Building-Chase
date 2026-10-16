import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { CPU_LEVELS, type CpuLevel } from '../ai'
import { storage } from '../storage'

/** 盤面の視点。front: 正面から浅く傾ける / angle: そこから右へ回り込む */
export type ViewMode = 'front' | 'angle'

export const LANGUAGES = ['ja', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

interface SettingsState {
  language: Language
  viewMode: ViewMode
  /** 前回選んだ CPU の強さ */
  cpuLevel: CpuLevel
  /** BGM / 効果音を鳴らすか */
  bgm: boolean
  se: boolean
  setLanguage(language: Language): void
  setViewMode(mode: ViewMode): void
  setCpuLevel(level: CpuLevel): void
  setBgm(on: boolean): void
  setSe(on: boolean): void
}

/** 端末に保存する設定（ストレージ層経由） */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'ja',
      viewMode: 'front',
      cpuLevel: 'normal',
      bgm: true,
      se: true,
      setLanguage: (language) => set({ language }),
      setViewMode: (viewMode) => set({ viewMode }),
      setCpuLevel: (cpuLevel) => set({ cpuLevel }),
      setBgm: (bgm) => set({ bgm }),
      setSe: (se) => set({ se }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => storage),
      partialize: (s) => ({
        language: s.language,
        viewMode: s.viewMode,
        cpuLevel: s.cpuLevel,
        bgm: s.bgm,
        se: s.se,
      }),
      // 保存された値が壊れていても既定値で起動する
      merge: (saved, current) => {
        const s = (saved ?? {}) as Partial<SettingsState>
        return {
          ...current,
          language: LANGUAGES.includes(s.language as Language) ? (s.language as Language) : 'ja',
          // 以前の視点（真上 top / 斜め tilt）は、どちらも正面として読む
          viewMode: s.viewMode === 'angle' ? 'angle' : 'front',
          cpuLevel: CPU_LEVELS.includes(s.cpuLevel as CpuLevel)
            ? (s.cpuLevel as CpuLevel)
            : 'normal',
          bgm: typeof s.bgm === 'boolean' ? s.bgm : true,
          se: typeof s.se === 'boolean' ? s.se : true,
        }
      },
    },
  ),
)
