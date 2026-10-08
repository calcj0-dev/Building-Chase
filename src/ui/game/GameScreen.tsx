import { useTranslation } from 'react-i18next'
import { MAX_ROUNDS, currentRole, getView } from '../../core'
import {
  highlightedBuildings,
  highlightedIntersections,
  selectableCars,
  useGameStore,
} from '../../store/gameStore'
import { Board } from './Board'
import { ControlPanel } from './ControlPanel'
import { GameOverBanner, HandoffOverlay } from './Overlays'
import { RoundBoard } from './RoundBoard'

export function GameScreen() {
  const { t } = useTranslation()
  const store = useGameStore()
  const { game } = store

  // ホットシートでは今の手番の陣営の視点で表示する。決着後は全公開
  const turn = currentRole(game)
  const view = getView(game, turn ?? 'runner')

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
                turn === 'runner' ? 'bg-red-600' : 'bg-sky-600'
              }`}
            >
              {t('header.turn', { role: t(`role.${turn}`) })}
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
            reason={game.endReason}
            onPlayAgain={store.newGame}
          />
        )}
      </main>

      {store.handoffTo && (
        <HandoffOverlay role={store.handoffTo} onDismiss={store.dismissHandoff} />
      )}
    </div>
  )
}
