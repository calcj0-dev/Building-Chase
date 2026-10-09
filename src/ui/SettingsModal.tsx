import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/appStore'
import { useSettingsStore, type Language, type ViewMode } from '../store/settingsStore'
import { Button, Segmented } from './Button'

/** 設定画面（モーダル）。タイトルとゲーム中のヘッダーから開く */
export function SettingsModal() {
  const { t } = useTranslation()
  const screen = useAppStore((s) => s.screen)
  const close = useAppStore((s) => s.closeSettings)
  const go = useAppStore((s) => s.go)
  const language = useSettingsStore((s) => s.language)
  const viewMode = useSettingsStore((s) => s.viewMode)
  const setLanguage = useSettingsStore((s) => s.setLanguage)
  const setViewMode = useSettingsStore((s) => s.setViewMode)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const inGame = screen === 'game'

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-slate-950/70 p-3 sm:items-center landscape:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="bc-card bc-pop flex max-h-[calc(100dvh-1.5rem)] w-full max-w-sm flex-col gap-5 overflow-y-auto rounded-3xl p-5">
        <h2 id="settings-title" className="text-xl font-extrabold">
          {t('settings.title')}
        </h2>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold text-slate-300">{t('settings.language')}</span>
          <Segmented<Language>
            label={t('settings.language')}
            value={language}
            onChange={setLanguage}
            options={[
              { value: 'ja', label: '日本語' },
              { value: 'en', label: 'English' },
            ]}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold text-slate-300">{t('settings.viewMode')}</span>
          <Segmented<ViewMode>
            label={t('settings.viewMode')}
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'top', label: t('viewMode.top') },
              { value: 'tilt', label: t('viewMode.tilt') },
            ]}
          />
        </div>

        {inGame &&
          (confirmQuit ? (
            <div className="flex flex-col gap-2 rounded-2xl bg-red-950/60 p-3">
              <p className="text-sm font-bold text-red-100">{t('settings.quitConfirm')}</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="danger" onClick={() => go('title')}>
                  {t('settings.quitYes')}
                </Button>
                <Button variant="subtle" onClick={() => setConfirmQuit(false)}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="subtle" onClick={() => setConfirmQuit(true)}>
              {t('settings.quit')}
            </Button>
          ))}

        <Button onClick={close}>{t('common.close')}</Button>
      </div>
    </div>
  )
}
