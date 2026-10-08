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

  const turnLabel =
    turn === null
      ? null
      : humanSide === 'both'
        ? t('header.turn', { role: t(`role.${turn}`) })
        : isHumanTurn(store)
          ? t('header.yourTurn')
          : t('header.cpuThinking')

  return (
    <div className="relative mx-auto flex min-h-full max-w-xl flex-col gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))] pb-[max(12px,env(safe-area-inset-bottom))]">
      <header className="bc-card flex flex-col gap-3 rounded-2xl p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-bold tracking-[0.2em] text-slate-400">
              {t(`phase.${game.phase}`)}
            </span>
            <span className="font-mono text-xl font-extrabold tracking-wide">
              {game.round === 0
                ? t('header.setupRound')
                : t('header.round', {
                    round: String(game.round).padStart(2, '0'),
                    max: MAX_ROUNDS,
                  })}
            </span>
          </div>
          {turnLabel && (
            <span
              className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold shadow-lg ${
                cpuTurn
                  ? 'bg-slate-700 text-slate-200'
                  : turn === 'runner'
                    ? 'bg-red-600 shadow-red-900/50'
                    : 'bg-sky-600 shadow-sky-900/50'
              }`}
            >
              {cpuTurn && <span className="size-2 animate-pulse rounded-full bg-slate-300" />}
              {turnLabel}
            </span>
          )}
        </div>
        <RoundBoard traceCount={view.traceCount} round={game.round} />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center">
        <Board
          view={view}
          highlightedBuildings={highlightedBuildings(store)}
          highlightedIntersections={highlightedIntersections(store)}
          selectableCars={selectableCars(store)}
          selectedCar={store.selectedCar}
          policeMode={store.mode}
          onTapBuilding={store.tapBuilding}
          onTapIntersection={store.tapIntersection}
          onTapPoliceCar={store.tapPoliceCar}
        />
      </main>

      <footer className="bc-card flex min-h-32 flex-col items-center justify-center gap-3 rounded-2xl p-3">
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
      </footer>

      {store.handoffTo && (
        <HandoffOverlay role={store.handoffTo} onDismiss={store.dismissHandoff} />
      )}
    </div>
  )
}
