import { useTranslation } from 'react-i18next'
import { MAX_ROUNDS, traceColorForRound } from '../../core'
import { TRACE_COLORS } from '../theme'

/** 1〜11 のスロット。逃亡者が動くたびに痕跡コマが盤面へ移り、スロットが空になる */
export function RoundBoard({ traceCount, round }: { traceCount: number; round: number }) {
  const { t } = useTranslation()
  const slots = Array.from({ length: MAX_ROUNDS }, (_, i) => i + 1)
  return (
    <ol aria-label={t('roundBoard.label')} className="flex flex-wrap justify-center gap-1">
      {slots.map((n) => {
        const color = traceColorForRound(n)
        const used = n <= traceCount
        const current = n === round
        return (
          <li
            key={n}
            className={`flex size-7 items-center justify-center rounded-full border-2 text-xs font-bold ${
              current ? 'border-white' : 'border-slate-600'
            }`}
            style={
              used
                ? { color: TRACE_COLORS[color] }
                : { backgroundColor: TRACE_COLORS[color], color: '#0f172a' }
            }
          >
            {n}
          </li>
        )
      })}
    </ol>
  )
}
