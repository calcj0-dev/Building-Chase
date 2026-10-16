import {
  applyAction,
  createGame,
  getView,
  policeMoveTargets,
  policeSearchTargets,
  runnerMoveTargets,
  type Action,
  type BuildingId,
  type GameState,
  type GameView,
  type HelicopterIndex,
  type IntersectionId,
} from '../../core'

// ビル ID           交差点 ID
//  0  1  2  3  4      0  1  2  3
//  5  6  7  8  9      4  5  6  7
// 10 11 12 13 14      8  9 10 11
// 15 16 17 18 19     12 13 14 15
// 20 21 22 23 24

/** 遊び方の1ページの図。実際のゲームの状態から作り、ゲーム画面と同じ盤面で描く */
export interface HelpDiagram {
  view: GameView
  highlightedBuildings: BuildingId[]
  highlightedIntersections: IntersectionId[]
  selectedHelicopter: HelicopterIndex | null
}

const place = (intersections: IntersectionId[]): Action[] =>
  intersections.map((intersection, i) => ({
    type: 'placePolice',
    helicopter: i as HelicopterIndex,
    intersection,
  }))

/** 3機がそれぞれ指定のビルを捜索する（図の中で逃亡者には当たらない場所） */
const searches = (buildings: BuildingId[]): Action[] =>
  buildings.map((building, i) => ({
    type: 'policeSearch',
    helicopter: i as HelicopterIndex,
    building,
  }))

/** 逃亡者が path をたどる。各ラウンドは 警察（idle を捜索）→ 逃亡者 */
function walk(path: BuildingId[], idle: BuildingId[]): Action[] {
  const [start, ...moves] = path
  return [
    { type: 'runnerMove', building: start },
    ...moves.flatMap((building): Action[] => [...searches(idle), { type: 'runnerMove', building }]),
  ]
}

const play = (actions: Action[]): GameState => actions.reduce(applyAction, createGame())

const plain = (view: GameView): HelpDiagram => ({
  view,
  highlightedBuildings: [],
  highlightedIntersections: [],
  selectedHelicopter: null,
})

/** 1. 基本ルール: ヘリコプター3機と、ビルに隠れた逃亡者 */
function basics(): HelpDiagram {
  const s = play([...place([5, 6, 10]), { type: 'runnerMove', building: 3 }])
  return plain(getView(s, 'runner'))
}

/** 2. 逃亡者の動き: 11 → 12 → 13 と動いた後。痕跡のある 12 には戻れない */
function runner(): HelpDiagram {
  const s = play([...place([0, 3, 12]), ...walk([11, 12, 13], [0, 4, 20]), ...searches([0, 4, 20])])
  return { ...plain(getView(s, 'runner')), highlightedBuildings: runnerMoveTargets(s) }
}

/** 3. 警察の動き: ヘリコプター1 の移動先（交差点）と捜索できるビル */
function police(): HelpDiagram {
  const s = play([...place([5, 7, 13]), { type: 'runnerMove', building: 24 }])
  return {
    view: getView(s, 'police'),
    highlightedBuildings: policeSearchTargets(s, 0),
    highlightedIntersections: policeMoveTargets(s, 0),
    selectedHelicopter: 0,
  }
}

/**
 * 4. 痕跡と推理（警察から見た盤面）: 逃亡者は 16 → 11 → 6 → 7 → 8 → 13 → 18 → 19 → 24 と動いた。
 * 警察は 黄（16・1番目）/ 赤（13・6番目）/ 青（8）の痕跡を見つけている。最後にヘリコプター2 を痕跡の上からどかす
 */
function traces(): HelpDiagram {
  const search = (helicopter: HelicopterIndex, building: BuildingId): Action => ({
    type: 'policeSearch',
    helicopter,
    building,
  })
  const move = (helicopter: HelicopterIndex, intersection: IntersectionId): Action => ({
    type: 'policeMove',
    helicopter,
    intersection,
  })
  const run = (building: BuildingId): Action => ({ type: 'runnerMove', building })
  const s = play([
    ...place([12, 6, 3]),
    run(16),
    ...[search(0, 20), search(1, 12), search(2, 4), run(11)],
    ...[search(0, 16), search(1, 12), search(2, 4), run(6)], // 黄の痕跡を発見
    ...[move(0, 13), search(1, 12), search(2, 4), run(7)],
    ...[move(0, 14), search(1, 12), search(2, 4), run(8)],
    ...[search(0, 22), search(1, 12), search(2, 4), run(13)],
    ...[search(0, 22), search(1, 12), search(2, 4), run(18)],
    ...[search(0, 22), search(1, 13), search(2, 8), run(19)], // 赤と青の痕跡を発見
    ...[search(0, 22), move(1, 5), search(2, 4), run(24)],
  ])
  return plain(getView(s, 'police'))
}

export const HELP_PAGES = ['basics', 'runner', 'police', 'traces'] as const
export type HelpPage = (typeof HELP_PAGES)[number]

export const HELP_DIAGRAMS: Record<HelpPage, () => HelpDiagram> = {
  basics,
  runner,
  police,
  traces,
}
