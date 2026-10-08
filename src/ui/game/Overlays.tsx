import { useTranslation } from 'react-i18next'
import type { EndReason, Role } from '../../core'
import type { HumanSide } from '../../store/gameStore'

/** ホットシートで端末を渡す間、盤面を隠す */
export function HandoffOverlay({ role, onDismiss }: { role: Role; onDismiss(): void }) {
  const { t } = useTranslation()
  const roleName = t(`role.${role}`)
  return (
    <button
      type="button"
      onClick={onDismiss}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center"
    >
      <span className="text-3xl font-bold">{t('handoff.title', { role: roleName })}</span>
      <span className="text-slate-300">{t('handoff.body', { role: roleName })}</span>
    </button>
  )
}

/** 簡易版の決着表示（正式なリザルト画面は Phase 4） */
export function GameOverBanner({
  winner,
  humanSide,
  reason,
  onPlayAgain,
  onChangeSide,
}: {
  winner: Role
  humanSide: HumanSide | null
  reason: EndReason
  onPlayAgain(): void
  onChangeSide(): void
}) {
  const { t } = useTranslation()
  const headline =
    humanSide === 'runner' || humanSide === 'police'
      ? t(winner === humanSide ? 'result.victory' : 'result.defeat')
      : t('result.winner', { role: t(`role.${winner}`) })
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-slate-800 p-4 text-center">
      <p className="text-2xl font-bold">
        {headline}
        <span className="ml-2 text-base text-slate-300">（{t(`result.${reason}`)}）</span>
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onPlayAgain}
          className="min-h-11 rounded-xl bg-sky-600 px-6 font-bold text-white"
        >
          {t('result.playAgain')}
        </button>
        <button
          type="button"
          onClick={onChangeSide}
          className="min-h-11 rounded-xl bg-slate-700 px-6 font-bold text-slate-200"
        >
          {t('result.changeSide')}
        </button>
      </div>
    </div>
  )
}
