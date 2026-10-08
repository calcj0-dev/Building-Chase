import type { ReactNode } from 'react'
import {
  ALL_BUILDINGS,
  ALL_INTERSECTIONS,
  type BuildingId,
  type GameView,
  type IntersectionId,
  type PoliceCarIndex,
  type VisibleTrace,
} from '../../core'
import { POLICE_CAR_COLORS, RUNNER_CAR_COLOR, TRACE_COLORS } from '../theme'
import {
  CELL,
  FOOTPRINT,
  SLAB,
  TOKEN_LIFT,
  WORLD_SIZE,
  buildingBox,
  depth,
  intersectionGround,
  isLargeBuilding,
  points,
  project,
  roofCenter,
  viewBox,
  windowLit,
} from './iso'

interface BoardProps {
  view: GameView
  highlightedBuildings: BuildingId[]
  highlightedIntersections: IntersectionId[]
  selectableCars: PoliceCarIndex[]
  selectedCar: PoliceCarIndex | null
  /**
   * 選択中の行動。パトカーのコマは浮いていて奥のビルに重なるため、
   * 捜索するビルを選ぶ間はコマを半透明にしてタップを通す。移動先を選ぶ間は当たり判定を小さくする
   */
  policeMode: 'move' | 'search' | null
  onTapBuilding(building: BuildingId): void
  onTapIntersection(intersection: IntersectionId): void
  onTapPoliceCar(car: PoliceCarIndex): void
}

const BUILDINGS_BACK_TO_FRONT = [...ALL_BUILDINGS].sort((a, b) => depth(a) - depth(b))

export function Board({
  view,
  highlightedBuildings,
  highlightedIntersections,
  selectableCars,
  selectedCar,
  policeMode,
  onTapBuilding,
  onTapIntersection,
  onTapPoliceCar,
}: BoardProps) {
  const traceByBuilding = new Map(view.traces.map((t) => [t.building, t]))
  const showRoute = view.phase === 'ended'
  const route = showRoute
    ? [...view.traces].sort((a, b) => (a.round ?? 0) - (b.round ?? 0)).map((t) => t.building)
    : []

  return (
    <svg
      viewBox={viewBox()}
      // ヘッダーと操作パネルが常に画面内に収まるよう、盤面の高さに上限を設ける
      className="h-auto max-h-[calc(100dvh-23rem)] w-full touch-manipulation select-none"
      role="img"
      aria-label="Building Chase board"
    >
      <defs>
        <linearGradient id="bc-plate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a3850" />
          <stop offset="1" stopColor="#1a2438" />
        </linearGradient>
        <radialGradient id="bc-beam" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fde68a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
      </defs>

      <Ground />

      {/* パトカーの影（地面に落ちる。手前のビルに隠れることがある） */}
      {view.policeCars.map((at, i) => {
        if (at === null) return null
        const g = intersectionGround(at)
        return (
          <g
            key={`shadow${i}`}
            className="bc-move"
            style={{ transform: `translate(${g.x}px, ${g.y}px)` }}
          >
            <ellipse rx={26} ry={15} fill="#020617" opacity={0.55} />
          </g>
        )
      })}

      {BUILDINGS_BACK_TO_FRONT.map((id) => (
        <Building
          key={`b${id}`}
          id={id}
          highlighted={highlightedBuildings.includes(id)}
          onTap={onTapBuilding}
        >
          <RoofItems
            id={id}
            trace={traceByBuilding.get(id)}
            hasRunner={view.runnerPosition === id}
            showRoute={showRoute}
          />
        </Building>
      ))}

      {showRoute && route.length > 1 && (
        <polyline
          points={points(route.map((b) => roofCenter(b)).map((p) => ({ x: p.x, y: p.y - 4 })))}
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
      {showRoute && <RouteNumbers traces={view.traces} />}

      {view.policeCars.map((at, i) => {
        if (at === null) return null
        const car = i as PoliceCarIndex
        return (
          <PoliceToken
            key={`p${car}`}
            car={car}
            at={at}
            acted={view.phase === 'police' && view.actedCars[car]}
            selected={selectedCar === car}
            selectable={selectableCars.includes(car)}
            hitArea={policeMode === 'search' ? 'none' : policeMode === 'move' ? 'compact' : 'wide'}
            onTap={onTapPoliceCar}
          />
        )
      })}

      {/* 選べる交差点は最前面に表示し、ビルの奥でもタップできるようにする */}
      {ALL_INTERSECTIONS.filter((id) => highlightedIntersections.includes(id)).map((id) => {
        const g = intersectionGround(id)
        return (
          <g
            key={`i${id}`}
            data-intersection={id}
            data-highlighted
            onClick={() => onTapIntersection(id)}
            className="cursor-pointer"
          >
            <g className="bc-glow">
              <ellipse
                cx={g.x}
                cy={g.y}
                rx={34}
                ry={20}
                fill="#fde68a"
                fillOpacity={0.4}
                stroke="#fde68a"
                strokeWidth={4}
              />
              <path
                d={`M ${g.x} ${g.y - 20} l -12 -20 h 24 z`}
                fill="#fde68a"
                stroke="#0f172a"
                strokeWidth={1.5}
              />
            </g>
            {/* タップしやすいよう当たり判定を広げる */}
            <ellipse cx={g.x} cy={g.y - 12} rx={46} ry={34} fill="transparent" />
          </g>
        )
      })}
    </svg>
  )
}

/** 地面: 土台、道路の中央線、交差点 */
function Ground() {
  const c = [
    project(0, 0),
    project(WORLD_SIZE, 0),
    project(WORLD_SIZE, WORLD_SIZE),
    project(0, WORLD_SIZE),
  ]
  const down = (p: { x: number; y: number }) => ({ x: p.x, y: p.y + SLAB })
  const lanes = [1, 2, 3, 4].flatMap((k) => [
    [project(k * CELL, 0), project(k * CELL, WORLD_SIZE)],
    [project(0, k * CELL), project(WORLD_SIZE, k * CELL)],
  ])
  return (
    <g pointerEvents="none">
      {/* 土台の側面 */}
      <polygon points={points([c[3], c[2], down(c[2]), down(c[3])])} fill="#0b1220" />
      <polygon points={points([c[2], c[1], down(c[1]), down(c[2])])} fill="#070d18" />
      {/* 道路（アスファルト） */}
      <polygon points={points(c)} fill="url(#bc-plate)" stroke="#334155" strokeWidth={2} />
      {lanes.map(([a, b], i) => (
        <line
          key={i}
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke="#cbd5e1"
          strokeWidth={2.5}
          strokeDasharray="10 12"
          opacity={0.45}
        />
      ))}
      {ALL_INTERSECTIONS.map((id) => {
        const g = intersectionGround(id)
        return <ellipse key={id} cx={g.x} cy={g.y} rx={9} ry={5.5} fill="#94a3b8" opacity={0.8} />
      })}
    </g>
  )
}

const BUILDING_COLORS = {
  large: { roof: '#475a7a', left: '#2b3a55', right: '#1c2840', rim: '#7b93bd' },
  small: { roof: '#526283', left: '#334363', right: '#222f4a', rim: '#8aa0c8' },
}

function Building({
  id,
  highlighted,
  onTap,
  children,
}: {
  id: BuildingId
  highlighted: boolean
  onTap(id: BuildingId): void
  children: ReactNode
}) {
  const { x0, y0, x1, y1, h } = buildingBox(id)
  const colors = isLargeBuilding(id) ? BUILDING_COLORS.large : BUILDING_COLORS.small
  const roof = [project(x0, y0, h), project(x1, y0, h), project(x1, y1, h), project(x0, y1, h)]
  const left = [project(x0, y1), project(x1, y1), project(x1, y1, h), project(x0, y1, h)]
  const right = [project(x1, y0), project(x1, y1), project(x1, y1, h), project(x1, y0, h)]
  // 歩道（ビルの足元を少し広げた面）
  const pad = 5
  const sidewalk = [
    project(x0 - pad, y0 - pad),
    project(x1 + pad, y0 - pad),
    project(x1 + pad, y1 + pad),
    project(x0 - pad, y1 + pad),
  ]

  return (
    <g
      data-building={id}
      data-highlighted={highlighted || undefined}
      onClick={highlighted ? () => onTap(id) : undefined}
      className={highlighted ? 'cursor-pointer' : undefined}
    >
      <polygon points={points(sidewalk)} fill="#273449" pointerEvents="none" />
      <polygon points={points(left)} fill={colors.left} />
      <polygon points={points(right)} fill={colors.right} />
      <Windows id={id} h={h} x0={x0} y0={y0} x1={x1} y1={y1} />
      <polygon points={points(roof)} fill={colors.roof} stroke={colors.rim} strokeWidth={1.5} />
      {highlighted && (
        <g className="bc-glow" pointerEvents="none">
          <polygon
            points={points(roof)}
            fill="#fde68a"
            fillOpacity={0.45}
            stroke="#fde68a"
            strokeWidth={4}
          />
          <polyline
            points={points([left[0], left[1], right[0]])}
            fill="none"
            stroke="#fde68a"
            strokeWidth={3}
          />
        </g>
      )}
      {children}
    </g>
  )
}

/** 窓（夜の街らしく、ところどころ明かりが点いている） */
function Windows({
  id,
  h,
  x0,
  y0,
  x1,
  y1,
}: {
  id: BuildingId
  h: number
  x0: number
  y0: number
  x1: number
  y1: number
}) {
  const floors = Math.floor((h - 10) / 14)
  const cols = [10, 30, 50]
  const out: ReactNode[] = []
  for (let f = 0; f < floors; f++) {
    const z0 = 8 + f * 14
    const z1 = z0 + 7
    for (const [k, u] of cols.entries()) {
      // 左面（y = y1）
      const litL = windowLit(id, 0, f, k)
      out.push(
        <polygon
          key={`l${f}-${k}`}
          points={points([
            project(x0 + u, y1, z0),
            project(x0 + u + 10, y1, z0),
            project(x0 + u + 10, y1, z1),
            project(x0 + u, y1, z1),
          ])}
          fill={litL ? '#fcd34d' : '#16203a'}
          opacity={litL ? 0.85 : 1}
        />,
      )
      // 右面（x = x1）
      const litR = windowLit(id, 1, f, k)
      out.push(
        <polygon
          key={`r${f}-${k}`}
          points={points([
            project(x1, y0 + u, z0),
            project(x1, y0 + u + 10, z0),
            project(x1, y0 + u + 10, z1),
            project(x1, y0 + u, z1),
          ])}
          fill={litR ? '#fbbf24' : '#111a30'}
          opacity={litR ? 0.6 : 1}
        />,
      )
    }
  }
  return <g pointerEvents="none">{out}</g>
}

/** 屋上に置くもの: 痕跡コマと逃亡者の車 */
function RoofItems({
  id,
  trace,
  hasRunner,
  showRoute,
}: {
  id: BuildingId
  trace: VisibleTrace | undefined
  hasRunner: boolean
  showRoute: boolean
}) {
  const q = FOOTPRINT / 4
  // 車と痕跡が同じビルにあるときは重ならないようにずらす
  const tracePos = hasRunner && !showRoute ? roofCenter(id, -q, -q) : roofCenter(id)
  const carPos = showRoute ? roofCenter(id, q, q) : roofCenter(id, q / 2, q / 2)
  return (
    <g pointerEvents="none">
      {trace && !showRoute && <TraceToken trace={trace} x={tracePos.x} y={tracePos.y} />}
      {hasRunner && <RunnerCar x={carPos.x} y={carPos.y} />}
    </g>
  )
}

function TraceToken({ trace, x, y }: { trace: VisibleTrace; x: number; y: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y + 4} rx={24} ry={14} fill="#020617" opacity={0.5} />
      <ellipse
        cx={x}
        cy={y}
        rx={24}
        ry={14}
        fill={TRACE_COLORS[trace.color]}
        stroke={trace.found ? '#f8fafc' : '#0f172a'}
        strokeWidth={trace.found ? 3 : 1.5}
      />
      <text x={x} y={y + 7} textAnchor="middle" fontSize={19} fontWeight="bold" fill="#0f172a">
        {trace.round ?? '!'}
      </text>
    </g>
  )
}

/** 答え合わせ: ルートの番号を屋上に表示 */
function RouteNumbers({ traces }: { traces: VisibleTrace[] }) {
  return (
    <g pointerEvents="none">
      {traces.map((t) => {
        const p = roofCenter(t.building)
        return <TraceToken key={t.building} trace={t} x={p.x} y={p.y - 4} />
      })}
    </g>
  )
}

/** 逃亡者の車（屋上に小さな箱型で表示） */
function RunnerCar({ x, y }: { x: number; y: number }) {
  // 車体を盤面と同じ向きの小さな直方体として描く
  const L = 42
  const W = 22
  const H = 12
  const p = (wx: number, wy: number, wz: number) => {
    const s = project(wx, wy, wz)
    return { x: s.x, y: s.y }
  }
  const top = [p(-L / 2, -W / 2, H), p(L / 2, -W / 2, H), p(L / 2, W / 2, H), p(-L / 2, W / 2, H)]
  const side = [p(-L / 2, W / 2, 0), p(L / 2, W / 2, 0), p(L / 2, W / 2, H), p(-L / 2, W / 2, H)]
  const front = [p(L / 2, -W / 2, 0), p(L / 2, W / 2, 0), p(L / 2, W / 2, H), p(L / 2, -W / 2, H)]
  const glass = [
    p(-2, -W / 2 + 3, H),
    p(11, -W / 2 + 3, H),
    p(11, W / 2 - 3, H),
    p(-2, W / 2 - 3, H),
  ]
  return (
    <g className="bc-move" style={{ transform: `translate(${x}px, ${y}px)` }}>
      <ellipse rx={32} ry={18} cy={2} fill="#ef4444" opacity={0.4} className="bc-glow" />
      <polygon points={points(side)} fill="#991b1b" />
      <polygon points={points(front)} fill="#7f1d1d" />
      <polygon points={points(top)} fill={RUNNER_CAR_COLOR} stroke="#450a0a" strokeWidth={1.5} />
      <polygon points={points(glass)} fill="#fecaca" />
    </g>
  )
}

/** パトカーのコマ（交差点の上に浮かせて表示） */
function PoliceToken({
  car,
  at,
  acted,
  selected,
  selectable,
  hitArea,
  onTap,
}: {
  car: PoliceCarIndex
  at: IntersectionId
  acted: boolean
  selected: boolean
  selectable: boolean
  hitArea: 'wide' | 'compact' | 'none'
  onTap(car: PoliceCarIndex): void
}) {
  const g = intersectionGround(at)
  const color = acted ? '#475569' : POLICE_CAR_COLORS[car]
  return (
    <g
      data-car={car}
      onClick={selectable && hitArea !== 'none' ? () => onTap(car) : undefined}
      className={`bc-move ${selectable && hitArea !== 'none' ? 'cursor-pointer' : ''}`}
      pointerEvents={!selectable || hitArea === 'none' ? 'none' : undefined}
      opacity={hitArea === 'none' ? 0.45 : 1}
      style={{ transform: `translate(${g.x}px, ${g.y}px)` }}
    >
      {/* 台座の柱 */}
      <line
        x1={0}
        y1={0}
        x2={0}
        y2={-TOKEN_LIFT + 26}
        stroke={acted ? '#64748b' : '#e2e8f0'}
        strokeWidth={3}
        opacity={0.8}
      />
      <g transform={`translate(0, ${-TOKEN_LIFT})`}>
        {selected && <circle r={38} fill="none" stroke="#f8fafc" strokeWidth={5} />}
        <circle r={29} fill={color} stroke={acted ? '#94a3b8' : '#0f172a'} strokeWidth={4} />
        {/* 屋根の回転灯 */}
        {!acted && (
          <g className="bc-siren">
            <rect x={-14} y={-38} width={13} height={9} rx={3} fill="#ef4444" />
            <rect x={1} y={-38} width={13} height={9} rx={3} fill="#3b82f6" />
          </g>
        )}
        <text
          y={9}
          textAnchor="middle"
          fontSize={25}
          fontWeight="bold"
          fill={acted ? '#cbd5e1' : '#0f172a'}
          pointerEvents="none"
        >
          {car + 1}
        </text>
        {selectable && hitArea !== 'none' && (
          <circle r={hitArea === 'wide' ? 44 : 32} fill="transparent" />
        )}
      </g>
    </g>
  )
}
