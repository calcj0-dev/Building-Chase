import { useTranslation } from 'react-i18next'
import { getView } from '../../core'
import { useAppStore } from '../../store/appStore'
import { useGameStore } from '../../store/gameStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Button } from '../Button'
import { Board } from '../game/Board'

/** リザルト / 答え合わせ: 勝敗、決着の理由、逃亡者が辿った全ルート */
export function ResultScreen() {
  const { t } = useTranslation()
  const game = useGameStore((s) => s.game)
  const humanSide = useGameStore((s) => s.humanSide)
  const viewMode = useSettingsStore((s) => s.viewMode)

  if (!game.winner || !game.endReason) return null
  // 決着後は全情報が公開される
  const view = getView(game, 'runner')
  const versus = humanSide === 'runner' || humanSide === 'police'
  const won = versus && game.winner === humanSide
  const headline = versus
    ? t(won ? 'result.victory' : 'result.defeat')
    : t('result.winner', { role: t(`role.${game.winner}`) })
  const color = versus
    ? won
      ? 'text-amber-300'
      : 'text-slate-300'
    : game.winner === 'runner'
      ? 'text-red-400'
      : 'text-sky-400'
  const found = game.traces.filter((tr) => tr.found).length

  const stats = (
    <dl className="grid grid-cols-2 gap-2 text-center text-sm">
      <div className="rounded-xl bg-slate-800/70 p-2">
        <dt className="text-xs text-slate-400">{t('result.moves')}</dt>
        <dd className="font-mono text-lg font-bold">{game.traces.length}</dd>
      </div>
      <div className="rounded-xl bg-slate-800/70 p-2">
        <dt className="text-xs text-slate-400">{t('result.tracesFound')}</dt>
        <dd className="font-mono text-lg font-bold">
          {found} / {game.traces.length}
        </dd>
      </div>
    </dl>
  )

  return (
    // 縦長の画面: 結果 → 盤面と記録 → ボタン
    // 横長の画面: 左に結果・記録・ボタン / 右に盤面
    <main className="mx-auto flex min-h-full max-w-xl flex-col gap-3 px-3 pt-[max(16px,env(safe-area-inset-top))] pb-[max(12px,env(safe-area-inset-bottom))] landscape:grid landscape:h-dvh landscape:max-w-6xl landscape:grid-cols-[minmax(260px,340px)_1fr] landscape:content-center landscape:gap-x-4">
      <div className="flex flex-col gap-3 landscape:col-start-1">
        <header className="bc-pop flex flex-col items-center gap-1 text-center">
          <span className={`text-4xl font-black tracking-wide ${color}`}>{headline}</span>
          <span className="text-sm font-bold text-slate-300">
            {t(`result.reason.${game.endReason}`)}
          </span>
        </header>
        <div className="hidden landscape:block">{stats}</div>
        <div className="hidden grid-cols-2 gap-2 landscape:grid">
          <ResultButtons />
        </div>
      </div>

      <section className="bc-card flex flex-col gap-2 rounded-2xl p-3 landscape:col-start-2 landscape:row-start-1">
        <h2 className="text-center text-xs font-bold tracking-[0.2em] text-slate-400">
          {t('result.routeTitle')}
        </h2>
        <Board
          className="h-auto max-h-[50dvh] w-full landscape:max-h-[calc(100dvh-5rem)]"
          view={view}
          viewMode={viewMode}
          highlightedBuildings={[]}
          highlightedIntersections={[]}
          selectableHelicopters={[]}
          selectedHelicopter={null}
          policeMode={null}
          onTapBuilding={() => {}}
          onTapIntersection={() => {}}
          onTapHelicopter={() => {}}
        />
        <div className="landscape:hidden">{stats}</div>
      </section>

      <div className="grid grid-cols-2 gap-2 landscape:hidden">
        <ResultButtons />
      </div>
    </main>
  )
}

function ResultButtons() {
  const { t } = useTranslation()
  const go = useAppStore((s) => s.go)
  const newGame = useGameStore((s) => s.newGame)
  return (
    <>
      <Button
        onClick={() => {
          newGame()
          go('game')
        }}
      >
        {t('result.playAgain')}
      </Button>
      <Button variant="subtle" onClick={() => go('title')}>
        {t('result.toTitle')}
      </Button>
    </>
  )
}
