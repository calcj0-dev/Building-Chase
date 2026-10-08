import { useTranslation } from 'react-i18next'
import { useGameStore, type HumanSide } from '../store/gameStore'

/** 仮の陣営選択。Phase 4 でタイトル画面・陣営選択画面に置き換える */
export function SideChooser() {
  const { t } = useTranslation()
  const startGame = useGameStore((s) => s.startGame)
  const options: { side: HumanSide; label: string; className: string }[] = [
    { side: 'runner', label: t('chooser.runner'), className: 'bg-red-600' },
    { side: 'police', label: t('chooser.police'), className: 'bg-sky-600' },
    { side: 'both', label: t('chooser.hotseat'), className: 'bg-slate-700' },
  ]
  return (
    <main className="mx-auto flex h-full max-w-sm flex-col items-center justify-center gap-4 p-4">
      <h1 className="mb-4 text-4xl font-bold tracking-wide">{t('app.title')}</h1>
      {options.map((o) => (
        <button
          key={o.side}
          type="button"
          onClick={() => startGame(o.side)}
          className={`min-h-12 w-full rounded-xl px-6 font-bold text-white ${o.className}`}
        >
          {o.label}
        </button>
      ))}
    </main>
  )
}
