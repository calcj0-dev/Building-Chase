import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { traceColorForRound, type GameState, type SearchRecord } from '../../core'
import { nextCarToPlace, useGameStore, type PoliceMode } from '../../store/gameStore'

/** 手順の案内、警察の行動ボタン、直前の捜索結果 */
export function ControlPanel() {
  const { t } = useTranslation()
  const game = useGameStore((s) => s.game)
  const selectedCar = useGameStore((s) => s.selectedCar)
  const mode = useGameStore((s) => s.mode)
  const lastSearch = useGameStore((s) => s.lastSearch)
  const chooseMode = useGameStore((s) => s.chooseMode)
  const cancelSelection = useGameStore((s) => s.cancelSelection)

  const instruction = instructionText(t, game, selectedCar, mode)
  const showActions = game.phase === 'police' && selectedCar !== null

  return (
    <div className="flex min-h-28 flex-col items-center gap-3 px-2 text-center">
      {lastSearch && (
        <p className="rounded-lg bg-slate-800 px-3 py-1 text-sm font-semibold text-amber-200">
          {searchText(t, game, lastSearch)}
        </p>
      )}
      {instruction && <p className="text-sm text-slate-200">{instruction}</p>}
      {showActions && (
        <div className="flex gap-2">
          <ActionButton active={mode === 'move'} onClick={() => chooseMode('move')}>
            {t('action.move')}
          </ActionButton>
          <ActionButton active={mode === 'search'} onClick={() => chooseMode('search')}>
            {t('action.search')}
          </ActionButton>
          <ActionButton active={false} onClick={cancelSelection} subtle>
            {t('action.back')}
          </ActionButton>
        </div>
      )}
    </div>
  )
}

function ActionButton({
  active,
  subtle,
  onClick,
  children,
}: {
  active: boolean
  subtle?: boolean
  onClick(): void
  children: ReactNode
}) {
  const base = 'min-h-11 min-w-20 rounded-xl px-4 font-bold'
  const style = active
    ? 'bg-amber-300 text-slate-900'
    : subtle
      ? 'bg-slate-700 text-slate-200'
      : 'bg-sky-600 text-white'
  return (
    <button type="button" className={`${base} ${style}`} onClick={onClick}>
      {children}
    </button>
  )
}

type T = (key: string, options?: Record<string, unknown>) => string

function instructionText(
  t: T,
  game: GameState,
  selectedCar: number | null,
  mode: PoliceMode | null,
): string | null {
  switch (game.phase) {
    case 'setup': {
      const car = nextCarToPlace(game)
      return car === null ? null : t('instruction.setup', { number: car + 1 })
    }
    case 'runner':
      return t(game.runnerPosition === null ? 'instruction.runnerStart' : 'instruction.runnerMove')
    case 'police':
      if (selectedCar === null) return t('instruction.policeSelectCar')
      if (mode === 'move') return t('instruction.policeMove')
      if (mode === 'search') return t('instruction.policeSearch')
      return t('instruction.policeChooseAction', { number: selectedCar + 1 })
    case 'ended':
      return null
  }
}

function searchText(t: T, game: GameState, search: SearchRecord): string {
  const number = search.car + 1
  if (search.outcome === 'car') return t('search.car')
  if (search.outcome === 'nothing') return t('search.nothing', { number })
  const trace = game.traces.find((tr) => tr.building === search.building)
  const color = trace ? traceColorForRound(trace.round) : 'blue'
  return color === 'blue'
    ? t('search.trace', { number })
    : t('search.traceSpecial', { number, round: trace?.round })
}
