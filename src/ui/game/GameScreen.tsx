import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_ROUNDS, currentRole, getView } from '../../core'
import {
  highlightedBuildings,
  highlightedIntersections,
  isCpuTurn,
  isHumanTurn,
  selectableCars,
  useGameStore,
  viewRole,
} from '../../store/gameStore'
import { Board } from './Board'
import { ControlPanel } from './ControlPanel'
import { GameOverBanner, HandoffOverlay } from './Overlays'
import { RoundBoard } from './RoundBoard'

/** CPU が1手ごとに考える時間（ms）。パトカーは1台ずつこの間隔で動く */
const CPU_THINK_MS = 700

export function GameScreen() {
  const { t } = useTranslation()
  const store = useGameStore()
  const { game, humanSide } = store
  const cpuTurn = isCpuTurn(store)

  useEffect(() => {
    if (!cpuTurn) return
    const timer = setTimeout(() => useGameStore.getState().cpuStep(), CPU_THINK_MS)
    return () => clearTimeout(timer)
  }, [cpuTurn, game])

  // 人の陣営の視点で表示する（ホットシートでは手番の陣営）。決着後は全公開
  const view = getView(game, viewRole(store))
  const turn = currentRole(game)

  return (
    <div className="relative mx-auto flex h-full max-w-xl flex-col gap-3 p-3">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-mono font-bold">
            {game.round === 0
              ? t('header.setupRound')
              : t('header.round', {
                  round: String(game.round).padStart(2, '0'),
                  max: MAX_ROUNDS,
                })}
          </span>
          <span className="text-slate-300">{t(`phase.${game.phase}`)}</span>
          {turn && (
            <span
              className={`rounded-full px-3 py-0.5 font-bold ${
                cpuTurn ? 'bg-slate-600' : turn === 'runner' ? 'bg-red-600' : 'bg-sky-600'
              }`}
            >
              {humanSide === 'both'
                ? t('header.turn', { role: t(`role.${turn}`) })
                : isHumanTurn(store)
                  ? t('header.yourTurn')
                  : t('header.cpuThinking')}
            </span>
          )}
        </div>
        <RoundBoard traceCount={view.traceCount} round={game.round} />
      </header>

      <main className="flex flex-1 flex-col items-center justify-start gap-3">
        <Board
          view={view}
          highlightedBuildings={highlightedBuildings(store)}
          highlightedIntersections={highlightedIntersections(store)}
          selectableCars={selectableCars(store)}
          selectedCar={store.selectedCar}
          compactCarHitArea={store.mode !== null}
          onTapBuilding={store.tapBuilding}
          onTapIntersection={store.tapIntersection}
          onTapPoliceCar={store.tapPoliceCar}
        />
        <ControlPanel />
        {game.winner && game.endReason && (
          <GameOverBanner
            winner={game.winner}
            humanSide={humanSide}
            reason={game.endReason}
            onPlayAgain={store.newGame}
            onChangeSide={store.backToSelect}
          />
        )}
      </main>

      {store.handoffTo && (
        <HandoffOverlay role={store.handoffTo} onDismiss={store.dismissHandoff} />
      )}
    </div>
  )
}
