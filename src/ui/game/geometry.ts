import {
  ALL_BUILDINGS,
  ALL_INTERSECTIONS,
  BUILDING_GRID_SIZE,
  buildingPoint,
  intersectionPoint,
  type BuildingId,
  type IntersectionId,
} from '../../core'
import type { ViewMode } from '../../store/settingsStore'

// 盤面の座標系（ワールド座標）: 1マス 100。ビルは各マスの中央 66、ビルの間 34 が道路。
// 視点は2種類（設定で切り替え）。どちらも正面から浅く傾け、奥行きを縮めて各ビルの手前の壁を見せる:
// - front: 正面から見る（左右はまっすぐ）
// - angle: 右へ ANGLE_YAW 度回り込んで見る（ビルの右側の壁も見える）
// 投影は1次変換（回転 + 縮み + 高さのずれ）なので、屋上・壁・地面は SVG の matrix でそのまま描ける
export const CELL = 100
export const INSET = 17
export const FOOTPRINT = CELL - INSET * 2
export const WORLD_SIZE = CELL * BUILDING_GRID_SIZE

/** 奥行きの縮み（1 で真上から見た形） */
const TILT_DEPTH = 0.8
/** 高さ 1 あたり上へずらす量 */
export const TILT_HEIGHT = 0.45
/** angle: 右へ回り込む角度（度） */
export const ANGLE_YAW = 15

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

const CENTER = WORLD_SIZE / 2

function yaw(mode: ViewMode): number {
  return mode === 'angle' ? (ANGLE_YAW * Math.PI) / 180 : 0
}

/**
 * 盤面を上から見て時計回りに回したワールド座標（カメラが右へ回り込むのと同じ）。
 * 回した後の y が大きいほど手前（カメラに近い）
 */
export function rotate(mode: ViewMode, wx: number, wy: number): ScreenPoint {
  const t = yaw(mode)
  const dx = wx - CENTER
  const dy = wy - CENTER
  return {
    x: CENTER + dx * Math.cos(t) - dy * Math.sin(t),
    y: CENTER + dx * Math.sin(t) + dy * Math.cos(t),
  }
}

/** ワールド座標 (x, y, 高さ z) → 画面座標 */
export function project(mode: ViewMode, wx: number, wy: number, wz = 0): ScreenPoint {
  const r = rotate(mode, wx, wy)
  return { x: r.x, y: r.y * TILT_DEPTH - wz * TILT_HEIGHT }
}

/**
 * 平面上のローカル座標 (u, v) を画面座標へ移す SVG の matrix。
 * origin がローカルの (0, 0)、u・v 方向はワールド座標の向き（du・dv、長さ 1 あたり）で指定する
 */
export function planeMatrix(
  mode: ViewMode,
  origin: { x: number; y: number; z: number },
  du: { x: number; y: number },
  dv: { x: number; y: number },
): string {
  const o = project(mode, origin.x, origin.y, origin.z)
  const pu = project(mode, origin.x + du.x, origin.y + du.y, origin.z)
  const pv = project(mode, origin.x + dv.x, origin.y + dv.y, origin.z)
  return matrix(o, { x: pu.x - o.x, y: pu.y - o.y }, { x: pv.x - o.x, y: pv.y - o.y })
}

/**
 * 壁のローカル座標 (u, s) を画面座標へ移す SVG の matrix。
 * u は壁の上端に沿ってワールド座標の向き du へ、s は画面上で真下へ（ピクセル）
 */
export function wallMatrix(
  mode: ViewMode,
  top: { x: number; y: number; z: number },
  du: { x: number; y: number },
): string {
  const o = project(mode, top.x, top.y, top.z)
  const pu = project(mode, top.x + du.x, top.y + du.y, top.z)
  return matrix(o, { x: pu.x - o.x, y: pu.y - o.y }, { x: 0, y: 1 })
}

function matrix(o: ScreenPoint, a: ScreenPoint, b: ScreenPoint): string {
  const f = (n: number) => n.toFixed(4)
  return `matrix(${f(a.x)} ${f(a.y)} ${f(b.x)} ${f(b.y)} ${f(o.x)} ${f(o.y)})`
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

/** 奥から手前の順に並べたビル（手前のビルが奥のビルを隠すように、この順に描く） */
export function buildingsBackToFront(mode: ViewMode): BuildingId[] {
  const depth = (id: BuildingId) => {
    const { x0, y0 } = buildingBox(id)
    return rotate(mode, x0 + FOOTPRINT / 2, y0 + FOOTPRINT / 2).y
  }
  return [...ALL_BUILDINGS].sort((a, b) => depth(a) - depth(b))
}

/** 右側の壁が見えるか（angle で右へ回り込んだとき） */
export function showsRightWall(mode: ViewMode): boolean {
  return yaw(mode) > 0
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
  const corners = [0, WORLD_SIZE].flatMap((x) => [0, WORLD_SIZE].map((y) => ({ x, y })))
  const ground = corners.map((c) => project(mode, c.x, c.y))
  const roofs = corners.map((c) => project(mode, c.x, c.y, HEIGHT_LARGE))
  const helicopterTops = ALL_INTERSECTIONS.map(
    (i) => intersectionGround(mode, i).y - HELI_LIFT - 40 * HELI_SCALE,
  )
  const left = Math.min(...ground.map((p) => p.x)) - 12
  const right = Math.max(...ground.map((p) => p.x)) + 12
  const top = Math.min(...roofs.map((p) => p.y), ...helicopterTops) - 12
  const bottom = Math.max(...ground.map((p) => p.y)) + SLAB + 10
  return `${left.toFixed(1)} ${top.toFixed(1)} ${(right - left).toFixed(1)} ${(bottom - top).toFixed(1)}`
}

/** 窓の明かりの点き方（ビル・階・列ごとに固定の疑似乱数） */
export function windowLit(id: BuildingId, floor: number, column: number): boolean {
  const n = (id * 73 + floor * 17 + column * 11) % 7
  return n === 0 || n === 3
}
