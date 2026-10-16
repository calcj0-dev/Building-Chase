import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import {
  FINAL_SEARCH_ROUND,
  policeMoveTargets,
  policeSearchTargets,
  traceColorForRound,
  type GameState,
  type SearchRecord,
} from '../../core'
import { isHumanTurn, nextHelicopterToPlace, useGameStore } from '../../store/gameStore'
import { BackIcon, MoveIcon, SearchIcon } from '../icons'

/**
 * 手順の案内と直前の捜索結果（searching の間は「捜索中」と出し、結果はまだ見せない）。
 * 警察がヘリコプターを選んでいる間は、盤面の光り方の見方（青 = 移動 / 黄 = 捜索）と「戻る」を出す
 */
export function ControlPanel({ searching }: { searching: boolean }) {
  const { t } = useTranslation()
  const game = useGameStore((s) => s.game)
  const selectedHelicopter = useGameStore((s) => s.selectedHelicopter)
  const lastSearch = useGameStore((s) => s.lastSearch)
  const cancelSelection = useGameStore((s) => s.cancelSelection)

  const humanTurn = useGameStore(isHumanTurn)
  // CPU の手番は操作案内を出さない（ヘッダーに「CPU思考中...」を表示）
  const instruction = humanTurn ? instructionText(t, game, selectedHelicopter) : null
  const choosing = humanTurn && game.phase === 'police' && selectedHelicopter !== null
  const canMove = choosing && policeMoveTargets(game, selectedHelicopter).length > 0
  const canSearch = choosing && policeSearchTargets(game, selectedHelicopter).length > 0

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {lastSearch &&
        (searching ? (
          <p className="flex items-center gap-2 rounded-full border border-amber-300/50 bg-slate-800/90 px-4 py-1.5 text-sm font-bold text-amber-100">
            <SearchIcon />
            {t('search.searching', { number: lastSearch.helicopter + 1 })}
          </p>
        ) : (
          <SearchToast key={game.searchLog.length} game={game} search={lastSearch} />
        ))}
      {instruction && (
        <p className="text-center text-sm font-medium text-slate-200">{instruction}</p>
      )}
      {choosing && (
        <div className="flex w-full max-w-sm flex-wrap items-center justify-center gap-2">
          {canMove && (
            <Legend className="border-sky-300/60 bg-sky-950/80 text-sky-100" icon={<MoveIcon />}>
              {t('instruction.legendMove')}
            </Legend>
          )}
          {canSearch && (
            <Legend
              className="border-amber-300/60 bg-amber-950/80 text-amber-100"
              icon={<SearchIcon />}
            >
              {t('instruction.legendSearch')}
            </Legend>
          )}
          <button
            type="button"
            onClick={cancelSelection}
            className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-slate-700/80 px-3 text-sm font-bold whitespace-nowrap text-slate-200 active:bg-slate-700"
          >
            <BackIcon />
            {t('action.back')}
          </button>
        </div>
      )}
    </div>
  )
}

/** 盤面の光り方の見方（色とアイコンを盤面にそろえる） */
function Legend({
  className,
  icon,
  children,
}: {
  className: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold whitespace-nowrap ${className}`}
    >
      {icon}
      {children}
    </span>
  )
}

function SearchToast({ game, search }: { game: GameState; search: SearchRecord }) {
  const { t } = useTranslation()
  const { text, tone } = searchResult(t, game, search)
  const toneClass = {
    nothing: 'border-slate-500/40 bg-slate-800/90 text-slate-200',
    trace: 'border-sky-400/50 bg-sky-950/90 text-sky-100',
    special: 'border-amber-300/70 bg-amber-950/90 text-amber-100',
    arrest: 'border-red-400/70 bg-red-950/90 text-red-100',
  }[tone]
  return (
    <p
      className={`bc-pop flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-bold ${toneClass}`}
    >
      <SearchIcon />
      {text}
    </p>
  )
}

type T = (key: string, options?: Record<string, unknown>) => string

function instructionText(t: T, game: GameState, selectedHelicopter: number | null): string | null {
  switch (game.phase) {
    case 'setup': {
      const helicopter = nextHelicopterToPlace(game)
      return helicopter === null ? null : t('instruction.setup', { number: helicopter + 1 })
    }
    case 'hide':
      return t('instruction.runnerStart')
    case 'runner':
      return t('instruction.runnerMove')
    case 'police':
      if (selectedHelicopter === null) {
        return game.round >= FINAL_SEARCH_ROUND
          ? t('instruction.policeFinalSearch')
          : t('instruction.policeSelectHelicopter')
      }
      return t('instruction.policeChooseAction', { number: selectedHelicopter + 1 })
    case 'ended':
      return null
  }
}

function searchResult(
  t: T,
  game: GameState,
  search: SearchRecord,
): { text: string; tone: 'nothing' | 'trace' | 'special' | 'arrest' } {
  const number = search.helicopter + 1
  if (search.outcome === 'runner') return { text: t('search.arrested'), tone: 'arrest' }
  if (search.outcome === 'nothing')
    return { text: t('search.nothing', { number }), tone: 'nothing' }
  const trace = game.traces.find((tr) => tr.building === search.building)
  const color = trace ? traceColorForRound(trace.round) : 'blue'
  return color === 'blue'
    ? { text: t('search.trace', { number }), tone: 'trace' }
    : { text: t('search.traceSpecial', { number, round: trace?.round }), tone: 'special' }
}
