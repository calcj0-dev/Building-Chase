import type { HelicopterIndex, TraceColor } from '../core'

/** ヘリコプターの識別色（原作どおり ピンク / 黄 / 緑） */
export const HELICOPTER_COLORS: Record<HelicopterIndex, string> = {
  0: '#ec4899',
  1: '#eab308',
  2: '#22c55e',
}

export const TRACE_COLORS: Record<TraceColor, string> = {
  yellow: '#facc15',
  red: '#ef4444',
  blue: '#3b82f6',
}
