import {
  BUILDING_GRID_SIZE,
  buildingPoint,
  intersectionPoint,
  type BuildingId,
  type IntersectionId,
} from '../../core'

// 盤面の座標系（ワールド座標）: 1マス 100。ビルは各マスの中央 66、ビルの間 34 が道路。
// これを斜め上から見下ろす 2.5D（ダイメトリック）に投影する。
export const CELL = 100
export const INSET = 17
export const FOOTPRINT = CELL - INSET * 2
export const WORLD_SIZE = CELL * BUILDING_GRID_SIZE

/** 横方向の縮尺。大きいほど横長 */
const ISO_X = 0.7
/** 奥行き方向の縮尺。大きいほど真上から見下ろす角度に近づく */
const ISO_Y = 0.66

/** 見た目だけのビルの高さ（大10棟 / 小15棟。ゲーム上の差はない） */
export const HEIGHT_LARGE = 60
export const HEIGHT_SMALL = 36
/** パトカーのコマを浮かせる高さ（手前のビルに隠れないように） */
export const TOKEN_LIFT = 64
/** 盤面の土台の厚み */
export const SLAB = 14

export interface ScreenPoint {
  x: number
  y: number
}

/** ワールド座標 (x, y, 高さ z) → 画面座標 */
export function project(wx: number, wy: number, wz = 0): ScreenPoint {
  return { x: (wx - wy) * ISO_X, y: (wx + wy) * ISO_Y - wz }
}

export function points(list: ScreenPoint[]): string {
  return list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

export function isLargeBuilding(id: BuildingId): boolean {
  return (id * 7) % 5 < 2
}

export function buildingHeight(id: BuildingId): number {
  return isLargeBuilding(id) ? HEIGHT_LARGE : HEIGHT_SMALL
}

/** ビルの足元の範囲（ワールド座標） */
export function buildingBox(id: BuildingId) {
  const { row, col } = buildingPoint(id)
  const x0 = col * CELL + INSET
  const y0 = row * CELL + INSET
  return { x0, y0, x1: x0 + FOOTPRINT, y1: y0 + FOOTPRINT, h: buildingHeight(id) }
}

/** 屋上の中心（画面座標） */
export function roofCenter(id: BuildingId, dx = 0, dy = 0): ScreenPoint {
  const { x0, y0, h } = buildingBox(id)
  return project(x0 + FOOTPRINT / 2 + dx, y0 + FOOTPRINT / 2 + dy, h)
}

export function intersectionWorld(id: IntersectionId) {
  const { row, col } = intersectionPoint(id)
  return { x: (col + 1) * CELL, y: (row + 1) * CELL }
}

export function intersectionGround(id: IntersectionId): ScreenPoint {
  const { x, y } = intersectionWorld(id)
  return project(x, y)
}

/** 奥から手前へ描く順序（画家のアルゴリズム） */
export function depth(id: BuildingId): number {
  const { row, col } = buildingPoint(id)
  return row + col
}

/** SVG の viewBox（盤面全体とその上に浮くコマが収まる範囲） */
export function viewBox(): string {
  const left = project(0, WORLD_SIZE).x - 16
  const right = project(WORLD_SIZE, 0).x + 16
  const top = project(INSET, INSET, HEIGHT_LARGE).y - 24
  const bottom = project(WORLD_SIZE, WORLD_SIZE).y + SLAB + 10
  return `${left} ${top} ${right - left} ${bottom - top}`
}

/** 窓の明かりの点き方（ビル・面・階・列ごとに固定の疑似乱数） */
export function windowLit(id: BuildingId, face: number, floor: number, column: number): boolean {
  const n = (id * 73 + face * 37 + floor * 17 + column * 11) % 7
  return n === 0 || n === 3
}
