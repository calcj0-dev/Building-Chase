import { useEffect, useState } from 'react'
import { SEARCH_SCAN_SEC } from '../../audio'
import { chooseCpuAction } from '../../ai'
import {
  applyAction,
  createGame,
  getView,
  traceColorForRound,
  type GameState,
  type SearchRecord,
} from '../../core'
import { useSettingsStore } from '../../store/settingsStore'
import { Board, type SearchEffect } from '../game/Board'

/** 1手ごとの間（ms） */
const STEP_MS = 600
/** 捜索の結果を見せておく時間（ms） */
const RESULT_MS = 900
/** 決着してから次のゲームを始めるまで（ms） */
const RESTART_MS = 2500
const SEARCH_SCAN_MS = SEARCH_SCAN_SEC * 1000

interface DemoState {
  game: GameState
  /** 直前の行動の前の状態（捜索の演出の間は、結果を見せずにこちらを描く） */
  before: GameState
  lastSearch: SearchRecord | null
  scanning: boolean
}

const fresh = (): DemoState => {
  const game = createGame()
  return { game, before: game, lastSearch: null, scanning: false }
}

const noop = () => {}

/** タイトル画面の背景で流す CPU 同士のデモ対戦（音なし・操作なし）。逃亡者の視点で全部見せる */
export function TitleDemo() {
  const viewMode = useSettingsStore((s) => s.viewMode)
  const [demo, setDemo] = useState(fresh)

  useEffect(() => {
    const { game, lastSearch, scanning } = demo
    const delay = scanning
      ? SEARCH_SCAN_MS
      : game.phase === 'ended'
        ? RESTART_MS
        : lastSearch
          ? RESULT_MS
          : STEP_MS
    const timer = setTimeout(() => {
      if (scanning) {
        setDemo({ ...demo, scanning: false })
        return
      }
      if (game.phase === 'ended') {
        setDemo(fresh())
        return
      }
      const action = chooseCpuAction(game, Math.random, 'strong')
      const next = applyAction(game, action)
      const search = action.type === 'policeSearch' ? (next.searchLog.at(-1) ?? null) : null
      setDemo({ game: next, before: game, lastSearch: search, scanning: search !== null })
    }, delay)
    return () => clearTimeout(timer)
  }, [demo])

  const shown = demo.scanning ? demo.before : demo.game
  const search = demo.lastSearch
  const trace =
    search?.outcome === 'trace'
      ? demo.game.traces.find((t) => t.building === search.building)
      : undefined
  const effect: SearchEffect | null = search
    ? {
        key: demo.game.searchLog.length,
        building: search.building,
        outcome: search.outcome,
        traceColor: trace ? traceColorForRound(trace.round) : null,
        helicopterAt: demo.game.helicopters[search.helicopter] ?? null,
        scanning: demo.scanning,
      }
    : null

  return (
    <Board
      className="h-full w-full"
      view={getView(shown, 'runner')}
      viewMode={viewMode}
      highlightedBuildings={[]}
      highlightedIntersections={[]}
      selectableHelicopters={[]}
      selectedHelicopter={null}
      onTapBuilding={noop}
      onTapIntersection={noop}
      onTapHelicopter={noop}
      searchEffect={effect}
    />
  )
}
