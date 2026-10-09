import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/appStore'
import { BackIcon } from '../icons'

const SECTIONS = ['basics', 'runner', 'police', 'traces'] as const

/** 遊び方（文章版）。図解付きのスライドは Phase 9 で作る */
export function HelpScreen() {
  const { t } = useTranslation()
  const go = useAppStore((s) => s.go)
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
      <h1 className="text-2xl font-extrabold">{t('help.title')}</h1>
      {SECTIONS.map((key, i) => (
        <section key={key} className="bc-card rounded-2xl p-4">
          <h2 className="mb-1 font-extrabold text-amber-300">
            {i + 1}. {t(`help.${key}.heading`)}
          </h2>
          <p className="text-sm leading-relaxed text-slate-200">{t(`help.${key}.body`)}</p>
        </section>
      ))}
    </main>
  )
}
