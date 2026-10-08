import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/** 盤面の視点。top: 真上から / tilt: 正面から浅く傾ける */
export type ViewMode = 'top' | 'tilt'

interface SettingsState {
  viewMode: ViewMode
  setViewMode(mode: ViewMode): void
}

/**
 * 端末に保存する設定。Phase 4 で設定画面とストレージ層（src/storage）に統合する
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      viewMode: 'top',
      setViewMode: (viewMode) => set({ viewMode }),
    }),
    {
      name: 'building-chase-settings',
      // localStorage が使えない環境（プライベートモード等）でも既定値で動く
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ viewMode: s.viewMode }),
    },
  ),
)
