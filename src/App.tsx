import { Analytics } from '@vercel/analytics/react'
import { useGameStore } from './store/gameStore'
import { GameScreen } from './ui/game/GameScreen'
import { SideChooser } from './ui/SideChooser'

function App() {
  const humanSide = useGameStore((s) => s.humanSide)
  return (
    <>
      {humanSide === null ? <SideChooser /> : <GameScreen />}
      <Analytics />
    </>
  )
}

export default App
