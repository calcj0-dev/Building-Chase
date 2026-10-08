import { useTranslation } from 'react-i18next'
import { useGameStore, type HumanSide } from '../store/gameStore'

/** 仮の陣営選択。Phase 4 でタイトル画面・陣営選択画面に置き換える */
export function SideChooser() {
  const { t } = useTranslation()
  const startGame = useGameStore((s) => s.startGame)
  const options: { side: HumanSide; label: string; className: string }[] = [
    {
      side: 'runner',
      label: t('chooser.runner'),
      className: 'bg-red-600 shadow-lg shadow-red-900/50',
    },
    {
      side: 'police',
      label: t('chooser.police'),
      className: 'bg-sky-600 shadow-lg shadow-sky-900/50',
    },
    { side: 'both', label: t('chooser.hotseat'), className: 'bg-slate-700/80' },
  ]
  return (
    <main className="mx-auto flex min-h-full max-w-sm flex-col items-center justify-center gap-4 p-6">
      <h1 className="mb-6 text-center text-5xl leading-none font-black tracking-tight">
        <span className="block text-slate-100">BUILDING</span>
        <span className="block bg-gradient-to-r from-red-400 via-amber-300 to-sky-400 bg-clip-text text-transparent">
          CHASE
        </span>
      </h1>
      {options.map((o) => (
        <button
          key={o.side}
          type="button"
          onClick={() => startGame(o.side)}
          className={`min-h-14 w-full rounded-2xl px-6 text-lg font-bold text-white ${o.className}`}
        >
          {o.label}
        </button>
      ))}
    </main>
  )
}
