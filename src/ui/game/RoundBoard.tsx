import { useTranslation } from 'react-i18next'
import { MAX_ROUNDS, traceColorForRound } from '../../core'
import { TRACE_COLORS } from '../theme'

/** 1〜11 のスロット。逃亡者が動くたびに痕跡コマが盤面へ移り、スロットが空になる */
export function RoundBoard({ traceCount, round }: { traceCount: number; round: number }) {
  const { t } = useTranslation()
  const slots = Array.from({ length: MAX_ROUNDS }, (_, i) => i + 1)
  return (
    <ol aria-label={t('roundBoard.label')} className="grid grid-cols-11 gap-1">
      {slots.map((n) => {
        const color = TRACE_COLORS[traceColorForRound(n)]
        const used = n <= traceCount
        const current = n === round
        return (
          <li
            key={n}
            className={`flex aspect-square items-center justify-center rounded-full text-[11px] font-extrabold transition-colors ${
              current ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : ''
            }`}
            style={
              used
                ? { color, boxShadow: `inset 0 0 0 2px ${color}55`, background: '#0f172a' }
                : { background: color, color: '#0f172a', boxShadow: `0 0 10px -2px ${color}` }
            }
          >
            {n}
          </li>
        )
      })}
    </ol>
  )
}
