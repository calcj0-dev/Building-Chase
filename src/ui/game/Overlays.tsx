import { useTranslation } from 'react-i18next'
import type { EndReason, Role } from '../../core'
import type { HumanSide } from '../../store/gameStore'

/** ホットシートで端末を渡す間、盤面を隠す */
export function HandoffOverlay({ role, onDismiss }: { role: Role; onDismiss(): void }) {
  const { t } = useTranslation()
  const roleName = t(`role.${role}`)
  const accent = role === 'runner' ? 'text-red-400' : 'text-sky-400'
  return (
    <button
      type="button"
      onClick={onDismiss}
      className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-slate-950 p-6 text-center"
    >
      <span className={`text-sm font-bold tracking-[0.3em] ${accent}`}>NEXT TURN</span>
      <span className="text-3xl font-extrabold">{t('handoff.title', { role: roleName })}</span>
      <span className="max-w-xs text-slate-300">{t('handoff.body', { role: roleName })}</span>
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
  const versus = humanSide === 'runner' || humanSide === 'police'
  const won = versus && winner === humanSide
  const headline = versus
    ? t(won ? 'result.victory' : 'result.defeat')
    : t('result.winner', { role: t(`role.${winner}`) })
  const color = versus
    ? won
      ? 'text-amber-300'
      : 'text-slate-300'
    : winner === 'runner'
      ? 'text-red-400'
      : 'text-sky-400'
  return (
    <div className="bc-pop flex w-full flex-col items-center gap-3 text-center">
      <p className="flex items-baseline gap-2">
        <span className={`text-3xl font-extrabold tracking-wide ${color}`}>{headline}</span>
        <span className="text-sm font-bold text-slate-400">{t(`result.${reason}`)}</span>
      </p>
      <div className="grid w-full max-w-sm grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onPlayAgain}
          className="min-h-12 rounded-xl bg-sky-600 px-4 font-bold text-white shadow-lg shadow-sky-900/40"
        >
          {t('result.playAgain')}
        </button>
        <button
          type="button"
          onClick={onChangeSide}
          className="min-h-12 rounded-xl bg-slate-700/80 px-4 font-bold text-slate-200"
        >
          {t('result.changeSide')}
        </button>
      </div>
    </div>
  )
}
