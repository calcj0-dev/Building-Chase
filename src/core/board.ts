// 盤面の形状。ビルは 5×5、交差点はビルの間の 4×4。
// ID は行優先の連番（ビル: row * 5 + col / 交差点: row * 4 + col）。

export const BUILDING_GRID_SIZE = 5
export const INTERSECTION_GRID_SIZE = BUILDING_GRID_SIZE - 1
export const BUILDING_COUNT = BUILDING_GRID_SIZE * BUILDING_GRID_SIZE
export const INTERSECTION_COUNT = INTERSECTION_GRID_SIZE * INTERSECTION_GRID_SIZE
/** ラウンド数（各ラウンドは 警察 → 逃亡者）。その後に警察の最後の捜索がある */
export const MAX_ROUNDS = 11
/** 最後の捜索（逃亡者の 11 回目の移動の後、警察だけが行動する） */
export const FINAL_SEARCH_ROUND = MAX_ROUNDS + 1
export const HELICOPTER_COUNT = 3

export type BuildingId = number
export type IntersectionId = number

export interface GridPoint {
  row: number
  col: number
}

export const ALL_BUILDINGS: readonly BuildingId[] = Array.from(
  { length: BUILDING_COUNT },
  (_, i) => i,
)
export const ALL_INTERSECTIONS: readonly IntersectionId[] = Array.from(
  { length: INTERSECTION_COUNT },
  (_, i) => i,
)

export function isBuildingId(id: number): id is BuildingId {
  return Number.isInteger(id) && id >= 0 && id < BUILDING_COUNT
}

export function isIntersectionId(id: number): id is IntersectionId {
  return Number.isInteger(id) && id >= 0 && id < INTERSECTION_COUNT
}

export function buildingAt(row: number, col: number): BuildingId | null {
  return inGrid(row, col, BUILDING_GRID_SIZE) ? row * BUILDING_GRID_SIZE + col : null
}

export function intersectionAt(row: number, col: number): IntersectionId | null {
  return inGrid(row, col, INTERSECTION_GRID_SIZE) ? row * INTERSECTION_GRID_SIZE + col : null
}

export function buildingPoint(id: BuildingId): GridPoint {
  return { row: Math.floor(id / BUILDING_GRID_SIZE), col: id % BUILDING_GRID_SIZE }
}

export function intersectionPoint(id: IntersectionId): GridPoint {
  return { row: Math.floor(id / INTERSECTION_GRID_SIZE), col: id % INTERSECTION_GRID_SIZE }
}

/** 縦横に隣接するビル（斜めは含まない） */
export const BUILDING_NEIGHBORS: readonly (readonly BuildingId[])[] = ALL_BUILDINGS.map((id) => {
  const { row, col } = buildingPoint(id)
  return orthogonal(row, col)
    .map(([r, c]) => buildingAt(r, c))
    .filter((n): n is BuildingId => n !== null)
})

/** 縦横に隣接する交差点（斜めは含まない） */
export const INTERSECTION_NEIGHBORS: readonly (readonly IntersectionId[])[] = ALL_INTERSECTIONS.map(
  (id) => {
    const { row, col } = intersectionPoint(id)
    return orthogonal(row, col)
      .map(([r, c]) => intersectionAt(r, c))
      .filter((n): n is IntersectionId => n !== null)
  },
)

/** 交差点を囲む4棟のビル（捜索できるビル） */
export const BUILDINGS_AROUND_INTERSECTION: readonly (readonly BuildingId[])[] =
  ALL_INTERSECTIONS.map((id) => {
    const { row, col } = intersectionPoint(id)
    return [
      row * BUILDING_GRID_SIZE + col,
      row * BUILDING_GRID_SIZE + col + 1,
      (row + 1) * BUILDING_GRID_SIZE + col,
      (row + 1) * BUILDING_GRID_SIZE + col + 1,
    ]
  })

/** ビルに接する交差点（そのビルを捜索できる交差点。角のビルは1か所、辺は2か所、内側は4か所） */
export const INTERSECTIONS_AROUND_BUILDING: readonly (readonly IntersectionId[])[] =
  ALL_BUILDINGS.map((building) =>
    ALL_INTERSECTIONS.filter((i) => BUILDINGS_AROUND_INTERSECTION[i].includes(building)),
  )

function inGrid(row: number, col: number, size: number): boolean {
  return (
    Number.isInteger(row) &&
    Number.isInteger(col) &&
    row >= 0 &&
    row < size &&
    col >= 0 &&
    col < size
  )
}

function orthogonal(row: number, col: number): [number, number][] {
  return [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ]
}
