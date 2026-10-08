import {
  BUILDING_GRID_SIZE,
  buildingPoint,
  intersectionPoint,
  type BuildingId,
  type IntersectionId,
} from '../../core'

// 盤面の座標系（ワールド座標）: 1マス 100。ビルは各マスの中央 66、ビルの間 34 が道路。
// 真上から見下ろして描く。ビルの高さは地面に落ちる影の長さで表す。
export const CELL = 100
export const INSET = 17
export const FOOTPRINT = CELL - INSET * 2
export const WORLD_SIZE = CELL * BUILDING_GRID_SIZE

/** 高さ 1 あたりの影の長さ（右下へ落ちる） */
export const SHADOW_PER_HEIGHT = 0.3

/** 見た目だけのビルの高さ（大10棟 / 小15棟。ゲーム上の差はない） */
export const HEIGHT_LARGE = 60
export const HEIGHT_SMALL = 36
/** ヘリコプターが飛ぶ高さ（画面上で交差点からどれだけ上に描くか）と大きさ */
export const HELI_LIFT = 30
export const HELI_SCALE = 1
/** 盤面の土台の厚み */
export const SLAB = 14

export interface ScreenPoint {
  x: number
  y: number
}

/** ワールド座標 (x, y) → 画面座標（真上から見るので高さは位置に影響しない） */
export function project(wx: number, wy: number): ScreenPoint {
  return { x: wx, y: wy }
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
  const { x0, y0 } = buildingBox(id)
  return project(x0 + FOOTPRINT / 2 + dx, y0 + FOOTPRINT / 2 + dy)
}

export function intersectionWorld(id: IntersectionId) {
  const { row, col } = intersectionPoint(id)
  return { x: (col + 1) * CELL, y: (row + 1) * CELL }
}

export function intersectionGround(id: IntersectionId): ScreenPoint {
  const { x, y } = intersectionWorld(id)
  return project(x, y)
}

/** SVG の viewBox（盤面全体とその上に浮くコマが収まる範囲） */
export function viewBox(): string {
  const left = -12
  const right = WORLD_SIZE + 12
  const heliTop = CELL - HELI_LIFT - 40 * HELI_SCALE
  const top = Math.min(0, heliTop) - 12
  const bottom = WORLD_SIZE + SLAB + 10
  return `${left} ${top} ${right - left} ${bottom - top}`
}
