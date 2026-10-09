import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/appStore'
import { useGameStore, type HumanSide } from '../../store/gameStore'
import { BackIcon } from '../icons'

/** 陣営選択: 逃亡者 / 警察（VS CPU）、2人で遊ぶ（1台の端末） */
export function SelectScreen() {
  const { t } = useTranslation()
  const go = useAppStore((s) => s.go)
  const startGame = useGameStore((s) => s.startGame)
  const start = (side: HumanSide) => {
    startGame(side)
    go('game')
  }
  const options: { side: HumanSide; accent: string }[] = [
    { side: 'runner', accent: 'border-red-500/60 bg-red-950/50' },
    { side: 'police', accent: 'border-sky-500/60 bg-sky-950/50' },
    { side: 'both', accent: 'border-slate-500/50 bg-slate-800/60' },
  ]
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col gap-4 p-6">
      <button
        type="button"
        onClick={() => go('title')}
        className="flex min-h-11 items-center gap-1 self-start font-bold text-slate-300"
      >
        <BackIcon />
        {t('common.back')}
      </button>
      <h1 className="text-2xl font-extrabold">{t('select.title')}</h1>
      {options.map((o) => (
        <button
          key={o.side}
          type="button"
          onClick={() => start(o.side)}
          className={`flex flex-col gap-1 rounded-2xl border-2 p-4 text-left ${o.accent}`}
        >
          <span className="text-lg font-extrabold">{t(`select.${o.side}.name`)}</span>
          <span className="text-sm text-slate-300">{t(`select.${o.side}.description`)}</span>
        </button>
      ))}
    </main>
  )
}
