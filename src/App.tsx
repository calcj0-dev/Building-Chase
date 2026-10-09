import { useAppStore } from './store/appStore'
import { GameScreen } from './ui/game/GameScreen'
import { HelpScreen } from './ui/screens/HelpScreen'
import { ResultScreen } from './ui/screens/ResultScreen'
import { SelectScreen } from './ui/screens/SelectScreen'
import { TitleScreen } from './ui/screens/TitleScreen'
import { SettingsModal } from './ui/SettingsModal'

const SCREENS = {
  title: TitleScreen,
  help: HelpScreen,
  select: SelectScreen,
  game: GameScreen,
  result: ResultScreen,
}

function App() {
  const screen = useAppStore((s) => s.screen)
  const settingsOpen = useAppStore((s) => s.settingsOpen)
  const Screen = SCREENS[screen]
  return (
    <>
      <Screen />
      {settingsOpen && <SettingsModal />}
    </>
  )
}

export default App
