import { create } from 'zustand'

/** 画面（要件定義書 2章の画面遷移） */
export type Screen = 'title' | 'help' | 'select' | 'game' | 'result'

interface AppState {
  screen: Screen
  /** 設定画面（モーダル）を開いているか。ゲーム中に開くと CPU と演出を止める */
  settingsOpen: boolean
  go(screen: Screen): void
  openSettings(): void
  closeSettings(): void
}

export const useAppStore = create<AppState>()((set) => ({
  screen: 'title',
  settingsOpen: false,
  go: (screen) => set({ screen, settingsOpen: false }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
}))
