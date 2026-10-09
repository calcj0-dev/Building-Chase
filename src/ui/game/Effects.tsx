import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/** カットインを表示しておく時間（ms） */
export const CUT_IN_MS = 1000
/** 重要な痕跡のバナーを表示しておく時間（ms） */
export const BANNER_MS = 1500

/** ターン切り替えのカットイン（VS CPU のみ）。1秒で消え、タップでも飛ばせる */
export function TurnCutIn({ kind, onDone }: { kind: 'your' | 'enemy'; onDone(): void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, CUT_IN_MS)
    return () => clearTimeout(timer)
  }, [onDone])
  const your = kind === 'your'
  return (
    <button
      type="button"
      onClick={onDone}
      aria-label={your ? 'YOUR TURN' : 'ENEMY TURN'}
      className="fixed inset-0 z-20 flex items-center justify-center"
    >
      <span
        className={`bc-cutin w-full py-5 text-center text-4xl font-black tracking-[0.15em] text-white shadow-2xl ${
          your
            ? 'bg-gradient-to-r from-sky-700/0 via-sky-600/95 to-sky-700/0'
            : 'bg-gradient-to-r from-red-800/0 via-red-700/95 to-red-800/0'
        }`}
      >
        {your ? 'YOUR TURN' : 'ENEMY TURN'}
      </span>
    </button>
  )
}

/** 黄・赤の痕跡を見つけたときのバナー（操作は妨げない） */
export function SpecialTraceBanner({ round, onDone }: { round: number; onDone(): void }) {
  const { t } = useTranslation()
  useEffect(() => {
    const timer = setTimeout(onDone, BANNER_MS)
    return () => clearTimeout(timer)
  }, [onDone])
  const red = round === 6
  return (
    <div
      className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center p-6"
      role="status"
    >
      <div
        className={`bc-banner flex flex-col items-center gap-1 rounded-3xl border-4 px-8 py-5 text-center shadow-2xl ${
          red
            ? 'border-red-300 bg-red-950/90 text-red-50 shadow-red-900/60'
            : 'border-amber-200 bg-amber-950/90 text-amber-50 shadow-amber-700/60'
        }`}
      >
        <span className="text-3xl font-black">{t('effect.keyTrace')}</span>
        <span className="text-sm font-bold opacity-90">
          {t('effect.keyTraceDetail', { round })}
        </span>
      </div>
    </div>
  )
}

/** 逮捕の演出（リザルト画面に移るまで表示） */
export function ArrestOverlay() {
  const { t } = useTranslation()
  return (
    <div
      className="bc-siren-flash pointer-events-none fixed inset-0 z-20 flex items-center justify-center"
      role="status"
    >
      <span className="bc-banner rounded-3xl border-4 border-white bg-slate-950/85 px-10 py-5 text-5xl font-black tracking-widest text-white shadow-2xl">
        {t('effect.arrested')}
      </span>
    </div>
  )
}
