import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/appStore'
import { Button } from '../Button'
import { SettingsIcon } from '../icons'

export function TitleScreen() {
  const { t } = useTranslation()
  const go = useAppStore((s) => s.go)
  const openSettings = useAppStore((s) => s.openSettings)
  return (
    <main className="mx-auto flex min-h-full max-w-sm flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-center text-5xl leading-none font-black tracking-tight">
        <span className="block text-slate-100">BUILDING</span>
        <span className="block bg-gradient-to-r from-red-400 via-amber-300 to-sky-400 bg-clip-text text-transparent">
          CHASE
        </span>
      </h1>
      <p className="mb-8 text-center text-sm font-medium text-slate-400">{t('title.tagline')}</p>
      <Button size="lg" className="w-full" onClick={() => go('select')}>
        {t('title.start')}
      </Button>
      <Button size="lg" variant="subtle" className="w-full" onClick={() => go('help')}>
        {t('title.help')}
      </Button>
      <Button
        size="lg"
        variant="subtle"
        className="flex w-full items-center justify-center gap-2"
        onClick={openSettings}
      >
        <SettingsIcon />
        {t('title.settings')}
      </Button>
    </main>
  )
}
