import type { PoliceCarIndex, TraceColor } from '../core'

/** パトカーの識別色（原作のヘリコプターの色: ピンク / 黄 / 緑） */
export const POLICE_CAR_COLORS: Record<PoliceCarIndex, string> = {
  0: '#ec4899',
  1: '#eab308',
  2: '#22c55e',
}

export const TRACE_COLORS: Record<TraceColor, string> = {
  yellow: '#facc15',
  red: '#ef4444',
  blue: '#3b82f6',
}

export const RUNNER_CAR_COLOR = '#dc2626'
