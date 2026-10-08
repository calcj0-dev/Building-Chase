import {
  BUILDING_GRID_SIZE,
  buildingPoint,
  intersectionPoint,
  type BuildingId,
  type IntersectionId,
} from '../../core'
import type { ViewMode } from '../../store/settingsStore'

// 盤面の座標系（ワールド座標）: 1マス 100。ビルは各マスの中央 66、ビルの間 34 が道路。
// 視点は2種類（設定で切り替え）:
// - top:  真上から見下ろす。ビルの高さは地面に落ちる影の長さで表す
// - tilt: 正面から浅く傾ける。左右はまっすぐのまま、奥行きを縮めて各ビルの手前の壁を見せる
export const CELL = 100
export const INSET = 17
export const FOOTPRINT = CELL - INSET * 2
export const WORLD_SIZE = CELL * BUILDING_GRID_SIZE

/** tilt: 奥行きの縮み（1 で真上から見た形） */
const TILT_DEPTH = 0.8
/** tilt: 高さ 1 あたり屋上を上へずらす量 */
const TILT_HEIGHT = 0.45

/** top: 高さ 1 あたりの影の長さ（右下へ落ちる） */
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

/** ワールド座標 (x, y, 高さ z) → 画面座標 */
export function project(mode: ViewMode, wx: number, wy: number, wz = 0): ScreenPoint {
  if (mode === 'top') return { x: wx, y: wy }
  return { x: wx, y: wy * TILT_DEPTH - wz * TILT_HEIGHT }
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
export function roofCenter(mode: ViewMode, id: BuildingId, dx = 0, dy = 0): ScreenPoint {
  const { x0, y0, h } = buildingBox(id)
  return project(mode, x0 + FOOTPRINT / 2 + dx, y0 + FOOTPRINT / 2 + dy, h)
}

export function intersectionWorld(id: IntersectionId) {
  const { row, col } = intersectionPoint(id)
  return { x: (col + 1) * CELL, y: (row + 1) * CELL }
}

export function intersectionGround(mode: ViewMode, id: IntersectionId): ScreenPoint {
  const { x, y } = intersectionWorld(id)
  return project(mode, x, y)
}

/** SVG の viewBox（盤面全体とその上に浮くコマが収まる範囲） */
export function viewBox(mode: ViewMode): string {
  const left = -12
  const right = WORLD_SIZE + 12
  const heliTop = project(mode, CELL, CELL).y - HELI_LIFT - 40 * HELI_SCALE
  const roofTop = project(mode, INSET, INSET, HEIGHT_LARGE).y
  const top = Math.min(0, heliTop, roofTop) - 12
  const bottom = project(mode, WORLD_SIZE, WORLD_SIZE).y + SLAB + 10
  return `${left} ${top} ${right - left} ${bottom - top}`
}

/** tilt: 窓の明かりの点き方（ビル・階・列ごとに固定の疑似乱数） */
export function windowLit(id: BuildingId, floor: number, column: number): boolean {
  const n = (id * 73 + floor * 17 + column * 11) % 7
  return n === 0 || n === 3
}

/** 地面（高さ 0）の縦方向の縮み */
export function groundScaleY(mode: ViewMode): number {
  return mode === 'top' ? 1 : TILT_DEPTH
}

/** 高さ 1 あたりの画面上の高さ（tilt のビルの壁の高さ） */
export function wallScale(mode: ViewMode): number {
  return mode === 'top' ? 0 : TILT_HEIGHT
}
