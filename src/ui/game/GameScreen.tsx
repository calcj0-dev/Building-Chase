import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_ROUNDS, currentRole, getView } from '../../core'
import {
  highlightedBuildings,
  highlightedIntersections,
  isCpuTurn,
  isHumanTurn,
  selectableHelicopters,
  useGameStore,
  viewRole,
} from '../../store/gameStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Board } from './Board'
import { ControlPanel } from './ControlPanel'
import { GameOverBanner, HandoffOverlay } from './Overlays'
import { RoundBoard } from './RoundBoard'

/** CPU が1手ごとに考える時間（ms）。ヘリコプターは1機ずつこの間隔で動く */
const CPU_THINK_MS = 700

export function GameScreen() {
  const { t } = useTranslation()
  const store = useGameStore()
  const { game, humanSide } = store
  const cpuTurn = isCpuTurn(store)
  const viewMode = useSettingsStore((s) => s.viewMode)
  const setViewMode = useSettingsStore((s) => s.setViewMode)

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
            <span className="font-mono text-xl font-extrabold tracking-wide whitespace-nowrap">
              {game.round === 0
                ? t('header.setupRound')
                : t('header.round', {
                    round: String(game.round).padStart(2, '0'),
                    max: MAX_ROUNDS,
                  })}
            </span>
          </div>
          {/* 仮の視点切り替え。Phase 4 で設定画面へ移す */}
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'top' ? 'tilt' : 'top')}
            className="ml-auto min-h-9 shrink-0 rounded-full border border-white/15 px-3 text-xs font-bold whitespace-nowrap text-slate-200"
            aria-label={t('viewMode.label')}
          >
            {t(`viewMode.${viewMode}`)}
          </button>
          {turnLabel && (
            <span
              className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold whitespace-nowrap shadow-lg ${
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
          viewMode={viewMode}
          highlightedBuildings={highlightedBuildings(store)}
          highlightedIntersections={highlightedIntersections(store)}
          selectableHelicopters={selectableHelicopters(store)}
          selectedHelicopter={store.selectedHelicopter}
          policeMode={store.mode}
          onTapBuilding={store.tapBuilding}
          onTapIntersection={store.tapIntersection}
          onTapHelicopter={store.tapHelicopter}
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
