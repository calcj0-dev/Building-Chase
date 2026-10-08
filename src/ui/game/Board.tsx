import {
  ALL_BUILDINGS,
  ALL_INTERSECTIONS,
  BUILDING_GRID_SIZE,
  buildingPoint,
  intersectionPoint,
  type BuildingId,
  type GameView,
  type IntersectionId,
  type PoliceCarIndex,
} from '../../core'
import { POLICE_CAR_COLORS, RUNNER_CAR_COLOR, TRACE_COLORS } from '../theme'

// 1マス 100 単位。ビルは各マスの中央 70 単位、ビルの間 30 単位が道路。
const CELL = 100
const BUILDING_INSET = 15
const BOARD_SIZE = CELL * BUILDING_GRID_SIZE

interface BoardProps {
  view: GameView
  highlightedBuildings: BuildingId[]
  highlightedIntersections: IntersectionId[]
  selectableCars: PoliceCarIndex[]
  selectedCar: PoliceCarIndex | null
  /** 行動を選んだ後は、パトカーの当たり判定を広げない（周囲のビルをタップしやすくする） */
  compactCarHitArea: boolean
  onTapBuilding(building: BuildingId): void
  onTapIntersection(intersection: IntersectionId): void
  onTapPoliceCar(car: PoliceCarIndex): void
}

function buildingOrigin(id: BuildingId) {
  const { row, col } = buildingPoint(id)
  return { x: col * CELL + BUILDING_INSET, y: row * CELL + BUILDING_INSET }
}

function intersectionCenter(id: IntersectionId) {
  const { row, col } = intersectionPoint(id)
  return { x: (col + 1) * CELL, y: (row + 1) * CELL }
}

/** 見た目だけの大小（大10棟 / 小15棟）。ゲーム上の差はない */
function isLargeBuilding(id: BuildingId): boolean {
  return (id * 7) % 5 < 2
}

export function Board({
  view,
  highlightedBuildings,
  highlightedIntersections,
  selectableCars,
  selectedCar,
  compactCarHitArea,
  onTapBuilding,
  onTapIntersection,
  onTapPoliceCar,
}: BoardProps) {
  const size = CELL - BUILDING_INSET * 2
  const traceByBuilding = new Map(view.traces.map((t) => [t.building, t]))
  const showRoute = view.phase === 'ended'
  const route = showRoute
    ? [...view.traces]
        .sort((a, b) => (a.round ?? 0) - (b.round ?? 0))
        .map((t) => {
          const o = buildingOrigin(t.building)
          return `${o.x + size / 2},${o.y + size / 2}`
        })
    : []

  return (
    <svg
      viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}
      className="h-auto w-full touch-manipulation select-none"
      role="img"
      aria-label="Building Chase board"
    >
      <rect width={BOARD_SIZE} height={BOARD_SIZE} rx={12} fill="#334155" />

      {ALL_BUILDINGS.map((id) => {
        const { x, y } = buildingOrigin(id)
        const highlighted = highlightedBuildings.includes(id)
        const large = isLargeBuilding(id)
        return (
          <g
            key={`b${id}`}
            data-building={id}
            data-highlighted={highlighted || undefined}
            onClick={highlighted ? () => onTapBuilding(id) : undefined}
            className={highlighted ? 'cursor-pointer' : undefined}
          >
            <rect
              x={x}
              y={y}
              width={size}
              height={size}
              rx={8}
              fill={large ? '#1e3a8a' : '#1e40af'}
              stroke={large ? '#60a5fa' : '#3b82f6'}
              strokeWidth={large ? 3 : 1.5}
            />
            {highlighted && (
              <rect
                x={x - 3}
                y={y - 3}
                width={size + 6}
                height={size + 6}
                rx={10}
                className="bc-glow"
                fill="#fde68a"
                fillOpacity={0.25}
                stroke="#fde68a"
                strokeWidth={4}
              />
            )}
          </g>
        )
      })}

      {showRoute && route.length > 1 && (
        <polyline
          points={route.join(' ')}
          fill="none"
          stroke="#f8fafc"
          strokeWidth={4}
          strokeDasharray="10 8"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )}

      {ALL_BUILDINGS.map((id) => {
        const trace = traceByBuilding.get(id)
        if (!trace) return null
        const { x, y } = buildingOrigin(id)
        const cx = showRoute ? x + size / 2 : x + 16
        const cy = showRoute ? y + size / 2 : y + 16
        return (
          <g key={`t${id}`} pointerEvents="none">
            <circle
              cx={cx}
              cy={cy}
              r={13}
              fill={TRACE_COLORS[trace.color]}
              stroke={trace.found ? '#f8fafc' : '#0f172a'}
              strokeWidth={trace.found ? 3 : 1.5}
            />
            <text
              x={cx}
              y={cy + 5}
              textAnchor="middle"
              fontSize={14}
              fontWeight="bold"
              fill="#0f172a"
            >
              {trace.round ?? '!'}
            </text>
          </g>
        )
      })}

      {view.runnerPosition !== null && (
        <RunnerCar building={view.runnerPosition} size={size} corner={showRoute} />
      )}

      {ALL_INTERSECTIONS.map((id) => {
        const highlighted = highlightedIntersections.includes(id)
        const { x, y } = intersectionCenter(id)
        return (
          <g
            key={`i${id}`}
            data-intersection={id}
            data-highlighted={highlighted || undefined}
            onClick={highlighted ? () => onTapIntersection(id) : undefined}
            className={highlighted ? 'cursor-pointer' : undefined}
          >
            <circle cx={x} cy={y} r={6} fill="#64748b" />
            {highlighted && (
              <>
                <circle
                  cx={x}
                  cy={y}
                  r={18}
                  className="bc-glow"
                  fill="#fde68a"
                  fillOpacity={0.3}
                  stroke="#fde68a"
                  strokeWidth={4}
                />
                {/* タップしやすいよう当たり判定を広げる */}
                <circle cx={x} cy={y} r={32} fill="transparent" />
              </>
            )}
          </g>
        )
      })}

      {view.policeCars.map((at, i) => {
        if (at === null) return null
        const car = i as PoliceCarIndex
        const { x, y } = intersectionCenter(at)
        const acted = view.phase === 'police' && view.actedCars[car]
        const selectable = selectableCars.includes(car)
        const selected = selectedCar === car
        return (
          <g
            key={`p${car}`}
            data-car={car}
            onClick={selectable ? () => onTapPoliceCar(car) : undefined}
            className={selectable ? 'cursor-pointer' : undefined}
          >
            {selected && (
              <circle cx={x} cy={y} r={27} fill="none" stroke="#f8fafc" strokeWidth={4} />
            )}
            <circle
              cx={x}
              cy={y}
              r={20}
              fill={acted ? '#475569' : POLICE_CAR_COLORS[car]}
              stroke={acted ? '#94a3b8' : '#0f172a'}
              strokeWidth={3}
            />
            <text
              x={x}
              y={y + 6}
              textAnchor="middle"
              fontSize={17}
              fontWeight="bold"
              fill={acted ? '#cbd5e1' : '#0f172a'}
              pointerEvents="none"
            >
              {car + 1}
            </text>
            {selectable && !compactCarHitArea && <circle cx={x} cy={y} r={32} fill="transparent" />}
          </g>
        )
      })}
    </svg>
  )
}

function RunnerCar({
  building,
  size,
  corner,
}: {
  building: BuildingId
  size: number
  /** 答え合わせ表示中は、中央の痕跡番号を隠さないよう右下に寄せる */
  corner: boolean
}) {
  const { x, y } = buildingOrigin(building)
  const cx = corner ? x + size - 22 : x + size / 2
  const cy = corner ? y + size - 13 : y + size / 2
  return (
    <g pointerEvents="none">
      <rect
        x={cx - 20}
        y={cy - 11}
        width={40}
        height={22}
        rx={8}
        fill={RUNNER_CAR_COLOR}
        stroke="#0f172a"
        strokeWidth={3}
      />
      <rect x={cx - 9} y={cy - 7} width={18} height={14} rx={3} fill="#fecaca" />
    </g>
  )
}
