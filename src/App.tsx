import { useEffect } from 'react'
import { audio } from './audio'
import { useAppStore, type Screen } from './store/appStore'
import { useSettingsStore } from './store/settingsStore'
import { GameScreen } from './ui/game/GameScreen'
import { HelpModal } from './ui/help/HelpModal'
import { ResultScreen } from './ui/screens/ResultScreen'
import { SelectScreen } from './ui/screens/SelectScreen'
import { TitleScreen } from './ui/screens/TitleScreen'
import { SettingsModal } from './ui/SettingsModal'

const SCREENS = {
  title: TitleScreen,
  select: SelectScreen,
  game: GameScreen,
  result: ResultScreen,
}

/** 画面ごとの BGM。リザルト画面は勝敗の効果音を聞かせるため止める */
const SCREEN_BGM = {
  title: 'title',
  select: 'title',
  game: 'game',
  result: null,
} as const satisfies Record<Screen, 'title' | 'game' | null>

// ブラウザの自動再生の制限: 最初のユーザー操作で音を有効にする
const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const

/** 音の設定と画面に合わせて BGM を切り替え、ボタンを押したときにタップ音を鳴らす */
function useAudio(screen: Screen) {
  const bgm = useSettingsStore((s) => s.bgm)
  const se = useSettingsStore((s) => s.se)

  useEffect(() => audio.setEnabled({ bgm, se }), [bgm, se])
  useEffect(() => audio.setBgm(SCREEN_BGM[screen]), [screen])

  useEffect(() => {
    const unlock = () => audio.unlock()
    const tap = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest('button')) audio.play('tap')
    }
    for (const type of UNLOCK_EVENTS) window.addEventListener(type, unlock)
    document.addEventListener('click', tap)
    return () => {
      for (const type of UNLOCK_EVENTS) window.removeEventListener(type, unlock)
      document.removeEventListener('click', tap)
    }
  }, [])
}

function App() {
  const screen = useAppStore((s) => s.screen)
  const settingsOpen = useAppStore((s) => s.settingsOpen)
  const helpOpen = useAppStore((s) => s.helpOpen)
  useAudio(screen)
  const Screen = SCREENS[screen]
  return (
    <>
      <Screen />
      {helpOpen && <HelpModal />}
      {settingsOpen && <SettingsModal />}
    </>
  )
}

export default App
