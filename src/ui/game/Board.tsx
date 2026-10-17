import { useLayoutEffect, useRef, useState } from 'react'
import {
  ALL_INTERSECTIONS,
  type BuildingId,
  type GameView,
  type HelicopterIndex,
  type IntersectionId,
  type SearchOutcome,
  type TraceColor,
  type VisibleTrace,
} from '../../core'
import type { PendingPoliceAction } from '../../store/gameStore'
import type { ViewMode } from '../../store/settingsStore'
import { HELICOPTER_COLORS, TRACE_COLORS } from '../theme'
import {
  CELL,
  FOOTPRINT,
  HELI_LIFT,
  HELI_SCALE,
  INSET,
  SLAB,
  TILT_HEIGHT,
  WORLD_SIZE,
  buildingBox,
  buildingsBackToFront,
  intersectionGround,
  intersectionWorld,
  isLargeBuilding,
  planeMatrix,
  points,
  project,
  roofCenter,
  showsRightWall,
  viewBox,
  wallMatrix,
  windowLit,
} from './geometry'

interface BoardProps {
  view: GameView
  /** 盤面の視点（正面 / 右へ回り込んだ斜め） */
  viewMode: ViewMode
  highlightedBuildings: BuildingId[]
  highlightedIntersections: IntersectionId[]
  selectableHelicopters: HelicopterIndex[]
  /**
   * 選択中のヘリコプター。選んでいる間は、移動できる交差点（青）と捜索できるビル（黄）を同時に光らせる。
   * ヘリコプターは空中に描くため北側のビルに重なるので、タップは「当たり判定の層」で受け取る（BoardHitLayer）
   */
  selectedHelicopter: HelicopterIndex | null
  onTapBuilding(building: BuildingId): void
  onTapIntersection(intersection: IntersectionId): void
  onTapHelicopter(helicopter: HelicopterIndex): void
  /** 盤面の大きさの指定（画面ごとに高さの上限を変える） */
  className?: string
  /** 直前の捜索の演出（サーチライトでビルの中を探し、結果のマークが浮かぶ）。key が変わるたびに再生する */
  searchEffect?: SearchEffect | null
  /** 決定待ちの行き先。その場所に ✓（決定）と ×（やめる）を出す */
  pending?: PendingPoliceAction | null
  onConfirm?(): void
  onCancel?(): void
}

export interface SearchEffect {
  key: number
  building: BuildingId
  outcome: SearchOutcome
  /** 痕跡が見つかったときの色 */
  traceColor: TraceColor | null
  /** 捜索したヘリコプターのいる交差点（サーチライトの光の出どころ） */
  helicopterAt: IntersectionId | null
  /** true の間はビルの中を探している最中（結果はまだ見せない） */
  scanning: boolean
}

export function Board({
  view,
  viewMode: mode,
  highlightedBuildings,
  highlightedIntersections,
  selectableHelicopters,
  selectedHelicopter,
  onTapBuilding,
  onTapIntersection,
  onTapHelicopter,
  className = '',
  searchEffect = null,
  pending = null,
  onConfirm = () => {},
  onCancel = () => {},
}: BoardProps) {
  const traceByBuilding = new Map(view.traces.map((t) => [t.building, t]))
  // 画面上の 1px が盤面の座標でいくつか（✓ / × を画面の大きさによらず押しやすい大きさにするため）
  const svgRef = useRef<SVGSVGElement>(null)
  const [unitsPerPx, setUnitsPerPx] = useState(1)
  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg || typeof ResizeObserver === 'undefined') return
    const update = () => {
      const [, , w, h] = viewBox(mode).split(' ').map(Number)
      const rect = svg.getBoundingClientRect()
      // viewBox は縦横比を保って収める（短い方に合わせる）
      const scale = Math.min(rect.width / w, rect.height / h)
      if (scale > 0) setUnitsPerPx(1 / scale)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [mode])
  // 警察がヘリコプターを選んで、行き先（移動 / 捜索）を選んでいる最中
  const choosing = selectedHelicopter !== null
  const showRoute = view.phase === 'ended'
  // 答え合わせのルート: 痕跡（スタート地点から順）→ 最後にいたビル（痕跡はない）
  const route = showRoute
    ? [
        ...[...view.traces].sort((a, b) => (a.round ?? 0) - (b.round ?? 0)).map((t) => t.building),
        ...(view.runnerPosition !== null ? [view.runnerPosition] : []),
      ]
    : []

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox(mode)}
      className={`touch-manipulation select-none ${className || 'h-auto w-full'}`}
      role="img"
      aria-label="Building Chase board"
    >
      <defs>
        <linearGradient id="bc-plate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a3850" />
          <stop offset="1" stopColor="#1a2438" />
        </linearGradient>
        <linearGradient id="bc-canopy" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e0f2fe" />
          <stop offset="1" stopColor="#7dd3fc" />
        </linearGradient>
        {/* サーチライト: ヘリコプター側が明るく、ビルに向かって薄くなる光 */}
        <linearGradient id="bc-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fef9c3" stopOpacity={0.75} />
          <stop offset="1" stopColor="#fde68a" stopOpacity={0.15} />
        </linearGradient>
        <radialGradient id="bc-spot">
          <stop offset="0" stopColor="#fefce8" stopOpacity={1} />
          <stop offset="0.5" stopColor="#fde68a" stopOpacity={0.7} />
          <stop offset="1" stopColor="#fde68a" stopOpacity={0} />
        </radialGradient>
      </defs>

      <Ground mode={mode} />

      {/* ヘリコプターの影（地面に落ちる） */}
      {view.helicopters.map((at, i) => {
        if (at === null) return null
        const g = intersectionGround(mode, at)
        return (
          <g
            key={`hs${i}`}
            className="bc-move"
            style={{ transform: `translate(${g.x}px, ${g.y}px)` }}
            pointerEvents="none"
          >
            <ellipse rx={30} ry={10} fill="#020617" opacity={0.5} className="bc-shadow" />
          </g>
        )
      })}

      {buildingsBackToFront(mode).map((id) => (
        <Building
          key={`b${id}`}
          mode={mode}
          id={id}
          highlighted={highlightedBuildings.includes(id)}
          onTap={onTapBuilding}
        />
      ))}

      {buildingsBackToFront(mode).map((id) => (
        <RoofItems
          key={`r${id}`}
          mode={mode}
          id={id}
          trace={traceByBuilding.get(id)}
          hasRunner={view.runnerPosition === id}
          showRoute={showRoute}
        />
      ))}

      {showRoute && route.length > 1 && (
        <polyline
          points={points(route.map((b) => roofCenter(mode, b)))}
          fill="none"
          stroke="#f8fafc"
          strokeWidth={4}
          strokeDasharray="10 8"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.9}
          pointerEvents="none"
        />
      )}
      {showRoute && <RouteNumbers mode={mode} traces={view.traces} />}
      {searchEffect &&
        (searchEffect.scanning ? (
          <SearchBeam key={`beam${searchEffect.key}`} mode={mode} effect={searchEffect} />
        ) : (
          <SearchResultMark key={searchEffect.key} mode={mode} effect={searchEffect} />
        ))}

      {choosing && (
        <ChoiceHitAreas
          mode={mode}
          highlightedBuildings={highlightedBuildings}
          highlightedIntersections={highlightedIntersections}
          onTapBuilding={onTapBuilding}
          onTapIntersection={onTapIntersection}
        />
      )}

      {view.helicopters.map((at, i) => {
        if (at === null) return null
        const helicopter = i as HelicopterIndex
        const selected = selectedHelicopter === helicopter
        const selectable = selectableHelicopters.includes(helicopter)
        return (
          <Helicopter
            key={`h${helicopter}`}
            mode={mode}
            helicopter={helicopter}
            at={at}
            acted={view.phase === 'police' && view.actedHelicopters[helicopter]}
            selected={selected}
            // 選んでいる間: ほかのヘリコプターは描かれた部分だけで選び直せる。
            // 選んだヘリコプターは半透明にして、下の光るビルを押せるようタップを通す
            hit={!selectable ? 'none' : !choosing ? 'wide' : selected ? 'none' : 'painted'}
            faded={choosing && selected}
            onTap={onTapHelicopter}
          />
        )
      })}

      {searchEffect?.scanning && (
        <SearchScan key={`scan${searchEffect.key}`} mode={mode} effect={searchEffect} />
      )}

      {choosing ? (
        <>
          <ChoiceMarkers
            mode={mode}
            from={view.helicopters[selectedHelicopter]}
            highlightedBuildings={highlightedBuildings}
            highlightedIntersections={highlightedIntersections}
            pending={pending}
          />
          {pending && (
            <ConfirmButtons
              mode={mode}
              unitsPerPx={unitsPerPx}
              pending={pending}
              onConfirm={onConfirm}
              onCancel={onCancel}
            />
          )}
        </>
      ) : (
        // 配置の候補の交差点は最前面に表示し、ヘリコプターの下でもタップできるようにする
        ALL_INTERSECTIONS.filter((id) => highlightedIntersections.includes(id)).map((id) => {
          const g = intersectionGround(mode, id)
          return (
            <g
              key={`i${id}`}
              data-intersection={id}
              data-highlighted
              onClick={() => onTapIntersection(id)}
              className="cursor-pointer"
            >
              <g className="bc-glow">
                <circle
                  cx={g.x}
                  cy={g.y}
                  r={17}
                  fill="#fde68a"
                  fillOpacity={0.4}
                  stroke="#fde68a"
                  strokeWidth={4}
                />
                <circle cx={g.x} cy={g.y} r={5} fill="#fde68a" />
              </g>
              {/* タップしやすいよう当たり判定を広げる */}
              <circle cx={g.x} cy={g.y} r={36} fill="transparent" />
            </g>
          )
        })
      )}
    </svg>
  )
}

/** 地面: 土台、道路の中央線、交差点。地面の上はワールド座標のまま matrix で描く */
function Ground({ mode }: { mode: ViewMode }) {
  const lanes = [1, 2, 3, 4]
  const ground = planeMatrix(mode, { x: 0, y: 0, z: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 })
  return (
    <g pointerEvents="none">
      {/* 土台の厚み（地面を真下へずらして重ねる） */}
      <g transform={`translate(0, ${SLAB})`}>
        <g transform={ground}>
          <rect width={WORLD_SIZE} height={WORLD_SIZE} rx={10} fill="#0b1220" />
        </g>
      </g>
      <g transform={ground}>
        {/* 道路（アスファルト） */}
        <rect
          width={WORLD_SIZE}
          height={WORLD_SIZE}
          rx={10}
          fill="url(#bc-plate)"
          stroke="#334155"
          strokeWidth={2}
        />
        {lanes.map((k) => (
          <g key={k} stroke="#cbd5e1" strokeWidth={2.5} strokeDasharray="10 12" opacity={0.4}>
            <line x1={k * CELL} y1={0} x2={k * CELL} y2={WORLD_SIZE} />
            <line x1={0} y1={k * CELL} x2={WORLD_SIZE} y2={k * CELL} />
          </g>
        ))}
        {ALL_INTERSECTIONS.map((id) => {
          const w = intersectionWorld(id)
          return <circle key={id} cx={w.x} cy={w.y} r={7} fill="#94a3b8" opacity={0.8} />
        })}
      </g>
    </g>
  )
}

const BUILDING_COLORS = {
  large: {
    roof: '#4b5f82',
    parapet: '#7b93bd',
    inner: '#3c4d6c',
    fixture: '#2a3852',
    wall: '#2b3a55',
  },
  small: {
    roof: '#56688b',
    parapet: '#8aa0c8',
    inner: '#4a5b7c',
    fixture: '#33415e',
    wall: '#334363',
  },
}

/** 右側の壁を手前の壁より暗くする（光は左上から） */
const RIGHT_WALL_SHADE = 0.7

/**
 * ビル: 屋上と、手前の壁（斜めの視点では右側の壁も）。
 * 屋上の中は 0〜FOOTPRINT のローカル座標で描き、matrix で画面へ移す
 */
function Building({
  mode,
  id,
  highlighted,
  onTap,
}: {
  mode: ViewMode
  id: BuildingId
  highlighted: boolean
  onTap(id: BuildingId): void
}) {
  const { x0, x1, y0, y1, h } = buildingBox(id)
  const large = isLargeBuilding(id)
  const colors = large ? BUILDING_COLORS.large : BUILDING_COLORS.small
  const inset = 6
  const roof = planeMatrix(mode, { x: x0, y: y0, z: h }, { x: 1, y: 0 }, { x: 0, y: 1 })
  const wallHeight = h * TILT_HEIGHT
  const frontWall = wallMatrix(mode, { x: x0, y: y1, z: h }, { x: 1, y: 0 })
  const rightWall = wallMatrix(mode, { x: x1, y: y1, z: h }, { x: 0, y: -1 })
  return (
    <g
      data-building={id}
      data-highlighted={highlighted || undefined}
      onClick={highlighted ? () => onTap(id) : undefined}
      className={highlighted ? 'cursor-pointer' : undefined}
    >
      {showsRightWall(mode) && (
        <g transform={rightWall}>
          <Wall id={id} height={wallHeight} color={colors.wall} shade={RIGHT_WALL_SHADE} />
          {highlighted && <WallGlow height={wallHeight} />}
        </g>
      )}
      <g transform={frontWall}>
        <Wall id={id} height={wallHeight} color={colors.wall} shade={1} />
        {highlighted && <WallGlow height={wallHeight} />}
      </g>
      <g transform={roof}>
        {/* 屋上の外周（パラペット）と内側の床 */}
        <rect
          x={0}
          y={0}
          width={FOOTPRINT}
          height={FOOTPRINT}
          rx={6}
          fill={colors.roof}
          stroke={colors.parapet}
          strokeWidth={2}
        />
        <rect
          x={inset}
          y={inset}
          width={FOOTPRINT - inset * 2}
          height={FOOTPRINT - inset * 2}
          rx={3}
          fill={colors.inner}
          pointerEvents="none"
        />
        {/* 屋上の設備（見た目だけ） */}
        {large ? (
          <g pointerEvents="none">
            <rect x={10} y={10} width={20} height={15} rx={2} fill={colors.fixture} />
            <circle cx={FOOTPRINT - 15} cy={FOOTPRINT - 15} r={6} fill={colors.fixture} />
            <circle
              cx={FOOTPRINT - 15}
              cy={FOOTPRINT - 15}
              r={2.5}
              fill={colors.parapet}
              opacity={0.6}
            />
          </g>
        ) : (
          <g pointerEvents="none">
            <rect x={FOOTPRINT - 22} y={10} width={11} height={9} rx={2} fill={colors.fixture} />
          </g>
        )}
        {highlighted && (
          <rect
            className="bc-glow"
            pointerEvents="none"
            x={-2}
            y={-2}
            width={FOOTPRINT + 4}
            height={FOOTPRINT + 4}
            rx={8}
            fill="#fde68a"
            fillOpacity={0.45}
            stroke="#fde68a"
            strokeWidth={4}
          />
        )}
      </g>
    </g>
  )
}

/** ビルの壁（窓明かり付き）。壁のローカル座標: 横 0〜FOOTPRINT、縦 0〜height（上端から下へ） */
function Wall({
  id,
  height,
  color,
  shade,
}: {
  id: BuildingId
  height: number
  color: string
  /** 1 で手前の壁の明るさ。小さいほど暗い */
  shade: number
}) {
  const floors = Math.max(1, Math.floor(height / 7))
  const cols = [8, 22, 36, 50]
  return (
    <g>
      <rect width={FOOTPRINT} height={height} fill={color} />
      <g pointerEvents="none">
        {Array.from({ length: floors }, (_, f) =>
          cols.map((u, k) => {
            const lit = windowLit(id, f, k)
            return (
              <rect
                key={`${f}-${k}`}
                x={u}
                y={3 + f * 7}
                width={8}
                height={4}
                fill={lit ? '#fcd34d' : '#16203a'}
                opacity={lit ? 0.85 : 1}
              />
            )
          }),
        )}
      </g>
      {shade < 1 && <rect width={FOOTPRINT} height={height} fill="#020617" opacity={1 - shade} />}
    </g>
  )
}

function WallGlow({ height }: { height: number }) {
  return (
    <rect
      className="bc-glow"
      pointerEvents="none"
      width={FOOTPRINT}
      height={height}
      fill="#fde68a"
      fillOpacity={0.25}
    />
  )
}

/** 見つかっていない痕跡コマの濃さ */
const UNFOUND_TRACE_OPACITY = 0.4

/** 屋上に置くもの: 痕跡コマと逃亡者 */
function RoofItems({
  mode,
  id,
  trace,
  hasRunner,
  showRoute,
}: {
  mode: ViewMode
  id: BuildingId
  trace: VisibleTrace | undefined
  hasRunner: boolean
  showRoute: boolean
}) {
  const q = FOOTPRINT / 4
  // 逃亡者と痕跡が同じビルにあるときは重ならないようにずらす
  const tracePos = hasRunner && !showRoute ? roofCenter(mode, id, -q, -q) : roofCenter(mode, id)
  const runnerPos = showRoute
    ? roofCenter(mode, id, q, q * 1.4)
    : roofCenter(mode, id, q / 2, q * 1.2)
  return (
    <g pointerEvents="none">
      {trace && !showRoute && <TraceToken trace={trace} x={tracePos.x} y={tracePos.y} />}
      {hasRunner && <Villain x={runnerPos.x} y={runnerPos.y} />}
    </g>
  )
}

/** 痕跡コマ。まだ警察に見つかっていない痕跡（逃亡者だけに見える）は薄く描く */
function TraceToken({ trace, x, y }: { trace: VisibleTrace; x: number; y: number }) {
  return (
    <g opacity={trace.found ? 1 : UNFOUND_TRACE_OPACITY}>
      <circle cx={x + 2} cy={y + 3} r={17} fill="#020617" opacity={0.5} />
      <circle
        cx={x}
        cy={y}
        r={17}
        fill={TRACE_COLORS[trace.color]}
        stroke={trace.found ? '#f8fafc' : '#0f172a'}
        strokeWidth={trace.found ? 3 : 1.5}
      />
      <text x={x} y={y + 6} textAnchor="middle" fontSize={17} fontWeight="bold" fill="#0f172a">
        {trace.round ?? '!'}
      </text>
    </g>
  )
}

/** 答え合わせ: ルートの番号を屋上に表示 */
function RouteNumbers({ mode, traces }: { mode: ViewMode; traces: VisibleTrace[] }) {
  return (
    <g pointerEvents="none">
      {traces.map((t) => {
        const p = roofCenter(mode, t.building)
        return <TraceToken key={t.building} trace={t} x={p.x} y={p.y} />
      })}
    </g>
  )
}

/** 逃亡者: 目出し帽とボーダーシャツ、お金の袋を抱えた泥棒 */
function Villain({ x, y }: { x: number; y: number }) {
  return (
    <g className="bc-move" style={{ transform: `translate(${x}px, ${y}px) scale(1.3)` }}>
      <ellipse rx={16} ry={6} fill="#ef4444" opacity={0.45} className="bc-glow" />
      <ellipse rx={11} ry={4} fill="#020617" opacity={0.6} />
      {/* 脚 */}
      <rect x={-7} y={-15} width={5} height={15} rx={2} fill="#111827" />
      <rect x={2} y={-15} width={5} height={15} rx={2} fill="#111827" />
      {/* 胴体（ボーダーシャツ） */}
      <rect
        x={-10}
        y={-33}
        width={20}
        height={20}
        rx={5}
        fill="#f1f5f9"
        stroke="#0f172a"
        strokeWidth={1.5}
      />
      <rect x={-10} y={-29} width={20} height={3.5} fill="#0f172a" />
      <rect x={-10} y={-22} width={20} height={3.5} fill="#0f172a" />
      {/* 腕 */}
      <path d="M -10 -29 L -15 -18" stroke="#0f172a" strokeWidth={4} strokeLinecap="round" />
      <path d="M 10 -29 L 14 -22" stroke="#0f172a" strokeWidth={4} strokeLinecap="round" />
      {/* お金の袋 */}
      <path d="M 12 -27 q -2 -4 2 -5 h 5 q 4 1 2 5 z" fill="#854d0e" />
      <ellipse cx={17} cy={-20} rx={8} ry={8} fill="#a16207" stroke="#422006" strokeWidth={1.5} />
      <text x={17} y={-16.5} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#fef3c7">
        $
      </text>
      {/* 頭（目出し帽） */}
      <circle cy={-42} r={10} fill="#1f2937" stroke="#0f172a" strokeWidth={1.5} />
      <rect x={-8} y={-46} width={16} height={6} rx={3} fill="#f2c9a0" />
      <circle cx={-3.5} cy={-43} r={1.7} fill="#0f172a" />
      <circle cx={3.5} cy={-43} r={1.7} fill="#0f172a" />
      <path d="M -6 -47.5 L -1 -46" stroke="#0f172a" strokeWidth={1.4} strokeLinecap="round" />
      <path d="M 6 -47.5 L 1 -46" stroke="#0f172a" strokeWidth={1.4} strokeLinecap="round" />
      <circle cy={-52} r={3} fill="#dc2626" />
    </g>
  )
}

/** ヘリコプターの広い当たり判定（イラストの座標。交差点から HELI_LIFT 上が原点） */
const HELI_HIT = { cx: 6, cy: -6, rx: 44, ry: 34 }
/** 移動先の交差点の当たり判定: 交差点から道路に沿って伸びる十字（腕の長さと太さの半分、ワールド座標） */
const ROAD_ARM = CELL / 2
const ROAD_HALF_WIDTH = INSET

/**
 * ヘリコプターを選んでいる間の当たり判定（見た目は持たない）。ヘリコプターのすぐ下に置き、
 * 見た目で一番上に見えているものが反応するよう、絵と同じ順に重ねる（上にあるものが優先される）:
 * 1. 移動先の交差点: 交差点と、そこから伸びる道路の十字（ビルに隠れていない道路の部分だけが反応する）
 * 2. ビル（奥から手前の順）: 光っているビルは捜索、光っていないビルは何もしない（タップをふさぐ）
 * その上のヘリコプターは、描かれた部分で選び直せる（選んでいるヘリコプターは反応しない）
 */
function ChoiceHitAreas({
  mode,
  highlightedBuildings,
  highlightedIntersections,
  onTapBuilding,
  onTapIntersection,
}: {
  mode: ViewMode
  highlightedBuildings: BuildingId[]
  highlightedIntersections: IntersectionId[]
  onTapBuilding(building: BuildingId): void
  onTapIntersection(intersection: IntersectionId): void
}) {
  const ground = planeMatrix(mode, { x: 0, y: 0, z: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 })
  return (
    <g>
      <g transform={ground}>
        {highlightedIntersections.map((id) => {
          const w = intersectionWorld(id)
          return (
            <g
              key={`ih${id}`}
              data-intersection={id}
              data-highlighted
              onClick={() => onTapIntersection(id)}
              className="cursor-pointer"
              fill="transparent"
            >
              <rect
                x={w.x - ROAD_ARM}
                y={w.y - ROAD_HALF_WIDTH}
                width={ROAD_ARM * 2}
                height={ROAD_HALF_WIDTH * 2}
              />
              <rect
                x={w.x - ROAD_HALF_WIDTH}
                y={w.y - ROAD_ARM}
                width={ROAD_HALF_WIDTH * 2}
                height={ROAD_ARM * 2}
              />
            </g>
          )
        })}
      </g>
      {buildingsBackToFront(mode).map((id) =>
        highlightedBuildings.includes(id) ? (
          <BuildingHitArea key={`bh${id}`} mode={mode} id={id} onTap={onTapBuilding} />
        ) : (
          <BuildingHitArea key={`bb${id}`} mode={mode} id={id} />
        ),
      )}
    </g>
  )
}

/** 決定待ちの行き先の位置（ビルは屋上の中心、交差点は地面） */
function pendingAnchor(mode: ViewMode, pending: PendingPoliceAction) {
  return pending.type === 'search'
    ? roofCenter(mode, pending.building)
    : intersectionGround(mode, pending.intersection)
}

/** ✓ と × のボタンの半径（盤面の座標）。画面上で CONFIRM_MIN_PX より小さくならないよう大きくする */
const CONFIRM_RADIUS = 30
/** ✓ と × のボタンの画面上の最小の直径（px。指で押しやすい大きさ） */
const CONFIRM_MIN_PX = 48

/**
 * 決定待ちの行き先のすぐ上に出す ✓（決定）と ×（やめる）。盤面の最前面に置き、盤面の外にはみ出さない
 */
function ConfirmButtons({
  mode,
  unitsPerPx,
  pending,
  onConfirm,
  onCancel,
}: {
  mode: ViewMode
  /** 画面上の 1px が盤面の座標でいくつか */
  unitsPerPx: number
  pending: PendingPoliceAction
  onConfirm(): void
  onCancel(): void
}) {
  const a = pendingAnchor(mode, pending)
  const [left, top, width, height] = viewBox(mode).split(' ').map(Number)
  const r = Math.max(CONFIRM_RADIUS, (CONFIRM_MIN_PX / 2) * unitsPerPx)
  const k = r / CONFIRM_RADIUS // 記号（✓ / ×）もボタンに合わせて大きくする
  const gap = r + 8
  const lift = r * 2
  const x = Math.min(Math.max(a.x, left + gap + r), left + width - gap - r)
  // 上に場所がなければ下に出す
  const above = a.y - lift
  const y = above - r < top ? Math.min(a.y + lift, top + height - r) : above
  return (
    <g data-confirm>
      <line x1={a.x} y1={a.y} x2={x} y2={y} stroke="#f8fafc" strokeWidth={3} opacity={0.7} />
      <g
        data-cancel
        role="button"
        aria-label="×"
        className="cursor-pointer"
        onClick={onCancel}
        transform={`translate(${x - gap}, ${y})`}
      >
        <circle r={r} fill="#334155" stroke="#f8fafc" strokeWidth={4} />
        <path
          transform={`scale(${k})`}
          d="M -10 -10 L 10 10 M 10 -10 L -10 10"
          stroke="#f8fafc"
          strokeWidth={6}
          strokeLinecap="round"
        />
      </g>
      <g
        data-ok
        role="button"
        aria-label="✓"
        className="cursor-pointer"
        onClick={onConfirm}
        transform={`translate(${x + gap}, ${y})`}
      >
        <circle r={r} fill="#16a34a" stroke="#f8fafc" strokeWidth={4} />
        <path
          transform={`scale(${k})`}
          d="M -12 0 L -3 9 L 13 -9"
          fill="none"
          stroke="#f8fafc"
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </g>
  )
}

/** ヘリコプターを選んでいる間の目印（タップは通す）: 捜索先の虫めがね、移動先の青い丸と矢印 */
function ChoiceMarkers({
  mode,
  from,
  highlightedBuildings,
  highlightedIntersections,
  pending,
}: {
  mode: ViewMode
  /** 選んだヘリコプターのいる交差点（矢印の向きの基準） */
  from: IntersectionId | null
  highlightedBuildings: BuildingId[]
  highlightedIntersections: IntersectionId[]
  pending: PendingPoliceAction | null
}) {
  return (
    <g pointerEvents="none">
      {/* 決定待ちの行き先を白い輪で囲む */}
      {pending && (
        <circle
          className="bc-glow"
          cx={pendingAnchor(mode, pending).x}
          cy={pendingAnchor(mode, pending).y}
          r={24}
          fill="none"
          stroke="#f8fafc"
          strokeWidth={4}
        />
      )}
      {highlightedBuildings.map((id) => {
        const p = roofCenter(mode, id)
        return (
          <g key={`sm${id}`} transform={`translate(${p.x}, ${p.y})`}>
            <circle r={13} fill="#451a03" fillOpacity={0.75} stroke="#fde68a" strokeWidth={2.5} />
            <circle cx={-2} cy={-2} r={5} fill="none" stroke="#fde68a" strokeWidth={2.5} />
            <path d="M 2 2 L 7 7" stroke="#fde68a" strokeWidth={3} strokeLinecap="round" />
          </g>
        )
      })}
      {highlightedIntersections.map((id) => {
        const g = intersectionGround(mode, id)
        const o = from === null ? g : intersectionGround(mode, from)
        // 選んだヘリコプターから離れる向きの矢印
        const angle = (Math.atan2(g.y - o.y, g.x - o.x) * 180) / Math.PI
        return (
          <g key={`mm${id}`} className="bc-glow" transform={`translate(${g.x}, ${g.y})`}>
            <circle r={17} fill="#38bdf8" fillOpacity={0.35} stroke="#7dd3fc" strokeWidth={4} />
            <path
              d="M -6 -6 L 4 0 L -6 6"
              transform={`rotate(${angle})`}
              fill="none"
              stroke="#e0f2fe"
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )
      })}
    </g>
  )
}

/** 光っているビルの縁取り（光）の太さ。当たり判定もこの分だけ広げて、見た目とそろえる */
const GLOW_MARGIN = 4
/** 光っていないビルの外周の線の太さの半分 */
const PARAPET_MARGIN = 1.5

/**
 * ビルの見た目どおりの当たり判定（屋上と、見えている壁）。onTap がなければタップをふさぐだけ。
 * 光っているビル（onTap あり）は縁取りの光の分だけ広げる
 */
function BuildingHitArea({
  mode,
  id,
  onTap,
}: {
  mode: ViewMode
  id: BuildingId
  onTap?(id: BuildingId): void
}) {
  const box = buildingBox(id)
  const m = onTap ? GLOW_MARGIN : PARAPET_MARGIN
  const [x0, x1, y0, y1, h] = [box.x0 - m, box.x1 + m, box.y0 - m, box.y1 + m, box.h]
  const p = (x: number, y: number, z: number) => project(mode, x, y, z)
  const roof = [p(x0, y0, h), p(x1, y0, h), p(x1, y1, h), p(x0, y1, h)]
  const front = [p(x0, y1, h), p(x1, y1, h), p(x1, y1, 0), p(x0, y1, 0)]
  const right = [p(x1, y0, h), p(x1, y1, h), p(x1, y1, 0), p(x1, y0, 0)]
  return (
    <g
      data-building-hit={id}
      onClick={onTap ? () => onTap(id) : undefined}
      className={onTap ? 'cursor-pointer' : undefined}
      fill="transparent"
    >
      <polygon points={points(roof)} />
      <polygon points={points(front)} />
      {showsRightWall(mode) && <polygon points={points(right)} />}
    </g>
  )
}

/** 警察のヘリコプター（横から見たイラスト。交差点の上空を飛んでいる） */
function Helicopter({
  mode,
  helicopter,
  at,
  acted,
  selected,
  hit,
  faded,
  onTap,
}: {
  mode: ViewMode
  helicopter: HelicopterIndex
  at: IntersectionId
  acted: boolean
  selected: boolean
  /**
   * タップの受け取り方。wide: 機体のまわりの広い楕円 / painted: 描かれた部分だけ / none: 受け取らない
   */
  hit: 'wide' | 'painted' | 'none'
  /** 半透明にする（選んだヘリコプターの下のビルを見せる） */
  faded: boolean
  onTap(helicopter: HelicopterIndex): void
}) {
  const g = intersectionGround(mode, at)
  const body = acted ? '#64748b' : HELICOPTER_COLORS[helicopter]
  const outline = '#0f172a'
  const tappable = hit !== 'none'
  return (
    <g
      data-helicopter={helicopter}
      onClick={tappable ? () => onTap(helicopter) : undefined}
      className={`bc-move ${tappable ? 'cursor-pointer' : ''}`}
      pointerEvents={tappable ? undefined : 'none'}
      opacity={faded ? 0.55 : 1}
      style={{ transform: `translate(${g.x}px, ${g.y}px)` }}
    >
      <g transform={`translate(0, ${-HELI_LIFT}) scale(${HELI_SCALE})`}>
        {/* 行動済みのヘリコプターはホバリングとローターを止める */}
        <g className={acted ? undefined : 'bc-hover'}>
          {selected && (
            <ellipse cx={6} cy={-6} rx={52} ry={36} fill="none" stroke="#f8fafc" strokeWidth={4} />
          )}

          {/* テールブーム・尾翼・テールローター */}
          <path
            d="M 14 -10 L 50 -14 L 50 -7 L 14 2 Z"
            fill={body}
            stroke={outline}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <path
            d="M 44 -14 L 52 -30 L 58 -30 L 54 -9 Z"
            fill={body}
            stroke={outline}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <g transform="translate(51, -12)">
            <circle r={8} fill="#e2e8f0" opacity={acted ? 0 : 0.25} />
            <g className={acted ? undefined : 'bc-tail-rotor'}>
              <path
                d="M -8 0 H 8 M 0 -8 V 8"
                stroke={outline}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            </g>
            <circle r={2} fill={outline} />
          </g>

          {/* スキッド（着陸用のそり） */}
          <path
            d="M -10 8 L -14 18 M 6 8 L 8 18"
            stroke={outline}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <path
            d="M -26 15 Q -26 19 -21 19 H 18"
            fill="none"
            stroke={outline}
            strokeWidth={3.5}
            strokeLinecap="round"
          />

          {/* 胴体 */}
          <path
            d="M -26 -2 C -26 -16 -14 -22 0 -22 C 12 -22 20 -16 20 -6 C 20 4 12 10 0 10 L -16 10 C -22 10 -26 6 -26 -2 Z"
            fill={body}
            stroke={outline}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          {/* 警察の白いライン */}
          <path d="M -24 3 H 19" stroke="#f8fafc" strokeWidth={3} opacity={acted ? 0.5 : 0.9} />
          {/* キャノピー（大きな窓） */}
          <path
            d="M -25 -3 C -24 -13 -15 -19 -4 -19 L -4 -3 Z"
            fill="url(#bc-canopy)"
            stroke={outline}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <path
            d="M -19 -8 C -17 -13 -13 -15 -9 -16"
            fill="none"
            stroke="#f8fafc"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.8}
          />
          {/* 番号 */}
          <circle cx={8} cy={-9} r={8} fill="#f8fafc" stroke={outline} strokeWidth={1.5} />
          <text x={8} y={-4.5} textAnchor="middle" fontSize={12} fontWeight="bold" fill={outline}>
            {helicopter + 1}
          </text>
          {/* 回転灯 */}
          {!acted && (
            <g className="bc-siren">
              <rect x={-6} y={-27} width={6} height={5} rx={1.5} fill="#ef4444" />
              <rect x={1} y={-27} width={6} height={5} rx={1.5} fill="#3b82f6" />
            </g>
          )}

          {/* メインローター（横から見ると羽根が伸び縮みして見える） */}
          <rect x={-2} y={-30} width={4} height={8} fill={outline} />
          <g className={acted ? undefined : 'bc-main-rotor'}>
            <rect x={-44} y={-34} width={88} height={4} rx={2} fill={outline} />
          </g>
          {!acted && <ellipse cy={-32} rx={44} ry={3} fill="#e2e8f0" opacity={0.15} />}
          <circle cy={-32} r={3.5} fill={outline} />

          {hit === 'wide' && (
            <ellipse
              cx={HELI_HIT.cx}
              cy={HELI_HIT.cy}
              rx={HELI_HIT.rx}
              ry={HELI_HIT.ry}
              fill="transparent"
            />
          )}
        </g>
      </g>
    </g>
  )
}

/** 捜索中のサーチライトの光（ヘリコプターの真下から屋上全体へ広がる）。ヘリコプターより下に描く */
function SearchBeam({ mode, effect }: { mode: ViewMode; effect: SearchEffect }) {
  if (effect.helicopterAt === null) return null
  const from = intersectionGround(mode, effect.helicopterAt)
  const center = roofCenter(mode, effect.building)
  const half = FOOTPRINT / 2
  return (
    <polygon
      className="bc-beam"
      pointerEvents="none"
      points={points([
        { x: from.x - 6, y: from.y - HELI_LIFT + 12 },
        { x: from.x + 6, y: from.y - HELI_LIFT + 12 },
        { x: center.x + half, y: center.y },
        { x: center.x - half, y: center.y },
      ])}
      fill="url(#bc-beam)"
    />
  )
}

/**
 * 捜索中の演出: 屋上を外して見えた暗い室内を、虫めがねと光の輪が探し回る。
 * ヘリコプターに隠れないよう、ヘリコプターより上に描く
 */
function SearchScan({ mode, effect }: { mode: ViewMode; effect: SearchEffect }) {
  const { x0, y0, h } = buildingBox(effect.building)
  const roof = planeMatrix(mode, { x: x0, y: y0, z: h }, { x: 1, y: 0 }, { x: 0, y: 1 })
  const center = roofCenter(mode, effect.building)
  const inset = 3
  const inner = FOOTPRINT - inset * 2
  // 光の輪は室内からはみ出さないよう、室内の形（画面上の四角形）で切り抜く
  const corner = (u: number, v: number) => project(mode, x0 + u, y0 + v, h)
  const room = [
    corner(inset, inset),
    corner(inset + inner, inset),
    corner(inset + inner, inset + inner),
    corner(inset, inset + inner),
  ]
  return (
    <g pointerEvents="none">
      <clipPath id="bc-scan-clip">
        <polygon points={points(room)} />
      </clipPath>
      {/* 屋上を外して見えた暗い室内（各階の床の線） */}
      <g transform={roof}>
        <g className="bc-scan-room">
          <rect
            x={inset}
            y={inset}
            width={inner}
            height={inner}
            rx={3}
            fill="#020617"
            stroke="#fde68a"
            strokeWidth={3}
          />
          {[0.3, 0.55, 0.8].map((f) => (
            <rect
              key={f}
              x={inset + (inner * (1 - f)) / 2}
              y={inset + (inner * (1 - f)) / 2}
              width={inner * f}
              height={inner * f}
              fill="none"
              stroke="#334155"
              strokeWidth={1.5}
            />
          ))}
        </g>
      </g>
      {/* 室内を照らす光の輪と、それを覗く虫めがね（同じ動きをする） */}
      <g clipPath="url(#bc-scan-clip)">
        <g transform={`translate(${center.x}, ${center.y})`}>
          <g className="bc-scan-spot">
            <circle r={18} fill="url(#bc-spot)" />
          </g>
        </g>
      </g>
      <g transform={`translate(${center.x}, ${center.y})`}>
        <g className="bc-scan-spot">
          <g className="bc-scan-lens">
            <path d="M 15 15 L 30 30" stroke="#0f172a" strokeWidth={10} strokeLinecap="round" />
            <path d="M 15 15 L 30 30" stroke="#f8fafc" strokeWidth={6} strokeLinecap="round" />
            <circle r={19} fill="none" stroke="#0f172a" strokeWidth={8} />
            <circle r={19} fill="none" stroke="#f8fafc" strokeWidth={4.5} />
          </g>
        </g>
      </g>
    </g>
  )
}

/** 捜索結果のマーク: 何もない = ×、痕跡 = その色のコマ、逃亡者 = 赤い警告マーク */
function SearchResultMark({ mode, effect }: { mode: ViewMode; effect: SearchEffect }) {
  const p = roofCenter(mode, effect.building)
  const ringColor =
    effect.outcome === 'runner'
      ? '#ef4444'
      : effect.outcome === 'trace'
        ? TRACE_COLORS[effect.traceColor ?? 'blue']
        : '#94a3b8'
  return (
    <g pointerEvents="none" transform={`translate(${p.x}, ${p.y})`}>
      <circle className="bc-ripple" r={44} fill="none" stroke={ringColor} strokeWidth={5} />
      <g className="bc-badge">
        {effect.outcome === 'nothing' && (
          <g>
            <circle r={18} fill="#1e293b" stroke="#94a3b8" strokeWidth={3} />
            <path
              d="M -7 -7 L 7 7 M 7 -7 L -7 7"
              stroke="#e2e8f0"
              strokeWidth={4}
              strokeLinecap="round"
            />
          </g>
        )}
        {effect.outcome === 'trace' && (
          <g>
            <circle r={20} fill={ringColor} stroke="#f8fafc" strokeWidth={3} />
            <text y={7} textAnchor="middle" fontSize={20} fontWeight="bold" fill="#0f172a">
              !
            </text>
          </g>
        )}
        {effect.outcome === 'runner' && (
          <g>
            <circle r={22} fill="#dc2626" stroke="#fef2f2" strokeWidth={3} />
            <text y={8} textAnchor="middle" fontSize={24} fontWeight="900" fill="#fff">
              !
            </text>
          </g>
        )}
      </g>
    </g>
  )
}
