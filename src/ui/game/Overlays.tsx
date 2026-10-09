import { useTranslation } from 'react-i18next'
import type { Role } from '../../core'

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
