import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import {
  FINAL_SEARCH_ROUND,
  traceColorForRound,
  type GameState,
  type SearchRecord,
} from '../../core'
import {
  isHumanTurn,
  nextHelicopterToPlace,
  useGameStore,
  type PoliceMode,
} from '../../store/gameStore'
import { BackIcon, MoveIcon, SearchIcon } from '../icons'

/** 手順の案内、警察の行動ボタン、直前の捜索結果 */
export function ControlPanel() {
  const { t } = useTranslation()
  const game = useGameStore((s) => s.game)
  const selectedHelicopter = useGameStore((s) => s.selectedHelicopter)
  const mode = useGameStore((s) => s.mode)
  const lastSearch = useGameStore((s) => s.lastSearch)
  const chooseMode = useGameStore((s) => s.chooseMode)
  const cancelSelection = useGameStore((s) => s.cancelSelection)

  const humanTurn = useGameStore(isHumanTurn)
  // CPU の手番は操作案内を出さない（ヘッダーに「CPU思考中...」を表示）
  const instruction = humanTurn ? instructionText(t, game, selectedHelicopter, mode) : null
  const showActions = humanTurn && game.phase === 'police' && selectedHelicopter !== null

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {lastSearch && <SearchToast key={game.searchLog.length} game={game} search={lastSearch} />}
      {instruction && (
        <p className="text-center text-sm font-medium text-slate-200">{instruction}</p>
      )}
      {showActions && (
        <div className="grid w-full max-w-sm grid-cols-3 gap-2">
          <ActionButton
            variant={mode === 'move' ? 'active' : 'primary'}
            icon={<MoveIcon />}
            onClick={() => chooseMode('move')}
          >
            {t('action.move')}
          </ActionButton>
          <ActionButton
            variant={mode === 'search' ? 'active' : 'primary'}
            icon={<SearchIcon />}
            onClick={() => chooseMode('search')}
          >
            {t('action.search')}
          </ActionButton>
          <ActionButton variant="subtle" icon={<BackIcon />} onClick={cancelSelection}>
            {t('action.back')}
          </ActionButton>
        </div>
      )}
    </div>
  )
}

function ActionButton({
  variant,
  icon,
  onClick,
  children,
}: {
  variant: 'primary' | 'active' | 'subtle'
  icon: ReactNode
  onClick(): void
  children: ReactNode
}) {
  const style = {
    primary: 'bg-sky-600 text-white shadow-lg shadow-sky-900/40 active:bg-sky-700',
    active: 'bg-amber-300 text-slate-900 shadow-lg shadow-amber-700/40 ring-2 ring-amber-100',
    subtle: 'bg-slate-700/80 text-slate-200 active:bg-slate-700',
  }[variant]
  return (
    <button
      type="button"
      className={`flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-3 font-bold ${style}`}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
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

function instructionText(
  t: T,
  game: GameState,
  selectedHelicopter: number | null,
  mode: PoliceMode | null,
): string | null {
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
      if (mode === 'move') return t('instruction.policeMove')
      if (mode === 'search') return t('instruction.policeSearch')
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
