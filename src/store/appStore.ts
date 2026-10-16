import { create } from 'zustand'

/** 画面（要件定義書 2章の画面遷移）。遊び方と設定はモーダル */
export type Screen = 'title' | 'select' | 'game' | 'result'

interface AppState {
  screen: Screen
  /** 設定画面（モーダル）を開いているか。ゲーム中に開くと CPU と演出を止める */
  settingsOpen: boolean
  /** 遊び方（スライド）を開いているか */
  helpOpen: boolean
  go(screen: Screen): void
  openSettings(): void
  closeSettings(): void
  openHelp(): void
  closeHelp(): void
}

export const useAppStore = create<AppState>()((set) => ({
  screen: 'title',
  settingsOpen: false,
  helpOpen: false,
  go: (screen) => set({ screen, settingsOpen: false, helpOpen: false }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  openHelp: () => set({ helpOpen: true }),
  closeHelp: () => set({ helpOpen: false }),
}))
