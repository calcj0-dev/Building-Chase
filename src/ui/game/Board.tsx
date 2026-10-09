import {
  ALL_BUILDINGS,
  ALL_INTERSECTIONS,
  type BuildingId,
  type GameView,
  type HelicopterIndex,
  type IntersectionId,
  type SearchOutcome,
  type TraceColor,
  type VisibleTrace,
} from '../../core'
import type { ViewMode } from '../../store/settingsStore'
import { HELICOPTER_COLORS, TRACE_COLORS } from '../theme'
import {
  CELL,
  FOOTPRINT,
  HELI_LIFT,
  HELI_SCALE,
  SHADOW_PER_HEIGHT,
  SLAB,
  WORLD_SIZE,
  buildingBox,
  groundScaleY,
  intersectionGround,
  isLargeBuilding,
  points,
  project,
  roofCenter,
  viewBox,
  wallScale,
  windowLit,
} from './geometry'

interface BoardProps {
  view: GameView
  /** 盤面の視点（真上 / 正面から浅く傾ける） */
  viewMode: ViewMode
  highlightedBuildings: BuildingId[]
  highlightedIntersections: IntersectionId[]
  selectableHelicopters: HelicopterIndex[]
  selectedHelicopter: HelicopterIndex | null
  /**
   * 選択中の行動。ヘリコプターは空中に描くため北側のビルに重なる。
   * 捜索するビルを選ぶ間はヘリコプターを半透明にしてタップを通し、移動先を選ぶ間は当たり判定を小さくする
   */
  policeMode: 'move' | 'search' | null
  onTapBuilding(building: BuildingId): void
  onTapIntersection(intersection: IntersectionId): void
  onTapHelicopter(helicopter: HelicopterIndex): void
  /** 盤面の大きさの指定（画面ごとに高さの上限を変える） */
  className?: string
  /** 直前の捜索の演出（ビルが持ち上がり、結果のマークが浮かぶ）。key が変わるたびに再生する */
  searchEffect?: SearchEffect | null
}

export interface SearchEffect {
  key: number
  building: BuildingId
  outcome: SearchOutcome
  /** 痕跡が見つかったときの色 */
  traceColor: TraceColor | null
}

export function Board({
  view,
  viewMode: mode,
  highlightedBuildings,
  highlightedIntersections,
  selectableHelicopters,
  selectedHelicopter,
  policeMode,
  onTapBuilding,
  onTapIntersection,
  onTapHelicopter,
  className = '',
  searchEffect = null,
}: BoardProps) {
  const traceByBuilding = new Map(view.traces.map((t) => [t.building, t]))
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
      </defs>

      <Ground mode={mode} />

      {/* ビルとヘリコプターの影（地面に落ちる）。真上の視点ではビルの高さを影で表す */}
      {mode === 'top' && ALL_BUILDINGS.map((id) => <BuildingShadow key={`bs${id}`} id={id} />)}
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

      {ALL_BUILDINGS.map((id) => (
        <Building
          // 捜索されたビルは key を変えて、持ち上がるアニメーションを毎回最初から再生する
          key={`b${id}-${searchEffect?.building === id ? searchEffect.key : 0}`}
          mode={mode}
          id={id}
          highlighted={highlightedBuildings.includes(id)}
          lifting={searchEffect?.building === id}
          onTap={onTapBuilding}
        />
      ))}

      {ALL_BUILDINGS.map((id) => (
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
      {searchEffect && (
        <SearchResultMark key={searchEffect.key} mode={mode} effect={searchEffect} />
      )}

      {view.helicopters.map((at, i) => {
        if (at === null) return null
        const helicopter = i as HelicopterIndex
        return (
          <Helicopter
            key={`h${helicopter}`}
            mode={mode}
            helicopter={helicopter}
            at={at}
            acted={view.phase === 'police' && view.actedHelicopters[helicopter]}
            selected={selectedHelicopter === helicopter}
            selectable={selectableHelicopters.includes(helicopter)}
            hitArea={policeMode === 'search' ? 'none' : policeMode === 'move' ? 'compact' : 'wide'}
            onTap={onTapHelicopter}
          />
        )
      })}

      {/* 選べる交差点は最前面に表示し、ヘリコプターの下でもタップできるようにする */}
      {ALL_INTERSECTIONS.filter((id) => highlightedIntersections.includes(id)).map((id) => {
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
      })}
    </svg>
  )
}

/** 地面: 土台、道路の中央線、交差点 */
function Ground({ mode }: { mode: ViewMode }) {
  const lanes = [1, 2, 3, 4]
  const sy = groundScaleY(mode)
  return (
    <g pointerEvents="none">
      {/* 土台の厚み（手前側） */}
      <rect
        x={0}
        y={WORLD_SIZE * sy - 8}
        width={WORLD_SIZE}
        height={SLAB + 8}
        rx={10}
        fill="#0b1220"
      />
      <g transform={`scale(1, ${sy})`}>
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
      </g>
      {ALL_INTERSECTIONS.map((id) => {
        const g = intersectionGround(mode, id)
        return (
          <ellipse key={id} cx={g.x} cy={g.y} rx={7} ry={7 * sy} fill="#94a3b8" opacity={0.8} />
        )
      })}
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

/** 高いビルほど長い影を右下に落とす */
function BuildingShadow({ id }: { id: BuildingId }) {
  const { x0, y0, h } = buildingBox(id)
  const d = h * SHADOW_PER_HEIGHT
  return (
    <rect
      x={x0 + d * 0.4}
      y={y0 + d * 0.4}
      width={FOOTPRINT + d * 0.6}
      height={FOOTPRINT + d * 0.6}
      rx={6}
      fill="#020617"
      opacity={0.5}
      pointerEvents="none"
    />
  )
}

/** ビル: 屋上（どちらの視点でも）と、傾けた視点では手前の壁 */
function Building({
  mode,
  id,
  highlighted,
  lifting,
  onTap,
}: {
  mode: ViewMode
  id: BuildingId
  highlighted: boolean
  lifting: boolean
  onTap(id: BuildingId): void
}) {
  const { x0, y0, y1, h } = buildingBox(id)
  const large = isLargeBuilding(id)
  const colors = large ? BUILDING_COLORS.large : BUILDING_COLORS.small
  const inset = 6
  // 屋上は「左上の位置 + 縦の縮み」で描く（屋上の中は 0〜FOOTPRINT のローカル座標）
  const roofTop = project(mode, x0, y0, h)
  const sy = groundScaleY(mode)
  const roofBottomY = project(mode, x0, y1, h).y
  const wallHeight = h * wallScale(mode)
  return (
    <g
      data-building={id}
      data-highlighted={highlighted || undefined}
      onClick={highlighted ? () => onTap(id) : undefined}
      className={`${highlighted ? 'cursor-pointer' : ''} ${lifting ? 'bc-lift' : ''}`}
    >
      {wallHeight > 0 && (
        <FrontWall id={id} x={x0} y={roofBottomY} height={wallHeight} color={colors.wall} />
      )}
      <g transform={`translate(${roofTop.x}, ${roofTop.y}) scale(1, ${sy})`}>
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
      {highlighted && wallHeight > 0 && (
        <rect
          className="bc-glow"
          pointerEvents="none"
          x={x0}
          y={roofBottomY}
          width={FOOTPRINT}
          height={wallHeight}
          fill="#fde68a"
          fillOpacity={0.25}
        />
      )}
    </g>
  )
}

/** 傾けた視点で見えるビルの手前の壁（窓明かり付き） */
function FrontWall({
  id,
  x,
  y,
  height,
  color,
}: {
  id: BuildingId
  x: number
  y: number
  height: number
  color: string
}) {
  const floors = Math.max(1, Math.floor(height / 7))
  const cols = [8, 22, 36, 50]
  return (
    <g>
      <rect x={x} y={y} width={FOOTPRINT} height={height} fill={color} />
      <g pointerEvents="none">
        {Array.from({ length: floors }, (_, f) =>
          cols.map((u, k) => {
            const lit = windowLit(id, f, k)
            return (
              <rect
                key={`${f}-${k}`}
                x={x + u}
                y={y + 3 + f * 7}
                width={8}
                height={4}
                fill={lit ? '#fcd34d' : '#16203a'}
                opacity={lit ? 0.85 : 1}
              />
            )
          }),
        )}
      </g>
    </g>
  )
}

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

function TraceToken({ trace, x, y }: { trace: VisibleTrace; x: number; y: number }) {
  return (
    <g>
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

/** 警察のヘリコプター（横から見たイラスト。交差点の上空を飛んでいる） */
function Helicopter({
  mode,
  helicopter,
  at,
  acted,
  selected,
  selectable,
  hitArea,
  onTap,
}: {
  mode: ViewMode
  helicopter: HelicopterIndex
  at: IntersectionId
  acted: boolean
  selected: boolean
  selectable: boolean
  hitArea: 'wide' | 'compact' | 'none'
  onTap(helicopter: HelicopterIndex): void
}) {
  const g = intersectionGround(mode, at)
  const body = acted ? '#64748b' : HELICOPTER_COLORS[helicopter]
  const outline = '#0f172a'
  const tappable = selectable && hitArea !== 'none'
  return (
    <g
      data-helicopter={helicopter}
      onClick={tappable ? () => onTap(helicopter) : undefined}
      className={`bc-move ${tappable ? 'cursor-pointer' : ''}`}
      pointerEvents={tappable ? undefined : 'none'}
      opacity={hitArea === 'none' ? 0.45 : 1}
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

          {tappable && (
            <ellipse
              cx={6}
              cy={-6}
              rx={hitArea === 'wide' ? 44 : 32}
              ry={hitArea === 'wide' ? 34 : 30}
              fill="transparent"
            />
          )}
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
