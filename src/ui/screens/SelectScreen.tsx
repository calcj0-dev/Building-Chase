import { useTranslation } from 'react-i18next'
import { CPU_LEVELS, type CpuLevel } from '../../ai'
import { useAppStore } from '../../store/appStore'
import { useGameStore, type HumanSide } from '../../store/gameStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Segmented } from '../Button'
import { BackIcon } from '../icons'

/** 陣営選択: CPU の強さ、逃亡者 / 警察（VS CPU）、2人で遊ぶ（1台の端末） */
export function SelectScreen() {
  const { t } = useTranslation()
  const go = useAppStore((s) => s.go)
  const startGame = useGameStore((s) => s.startGame)
  const cpuLevel = useSettingsStore((s) => s.cpuLevel)
  const setCpuLevel = useSettingsStore((s) => s.setCpuLevel)
  const start = (side: HumanSide) => {
    startGame(side, cpuLevel)
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
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-slate-300">{t('select.cpuLevel.label')}</span>
        <Segmented<CpuLevel>
          label={t('select.cpuLevel.label')}
          value={cpuLevel}
          onChange={setCpuLevel}
          options={CPU_LEVELS.map((level) => ({
            value: level,
            label: t(`select.cpuLevel.${level}`),
          }))}
        />
      </div>
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
