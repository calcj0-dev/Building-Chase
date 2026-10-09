import type { ReactNode } from 'react'

type Variant = 'primary' | 'runner' | 'police' | 'subtle' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-sky-600 text-white shadow-lg shadow-sky-900/40 active:bg-sky-700',
  runner: 'bg-red-600 text-white shadow-lg shadow-red-900/50 active:bg-red-700',
  police: 'bg-sky-600 text-white shadow-lg shadow-sky-900/50 active:bg-sky-700',
  subtle: 'bg-slate-700/80 text-slate-200 active:bg-slate-700',
  danger: 'bg-red-700 text-white active:bg-red-800',
}

export function Button({
  variant = 'primary',
  size = 'md',
  onClick,
  children,
  className = '',
}: {
  variant?: Variant
  size?: 'md' | 'lg'
  onClick(): void
  children: ReactNode
  className?: string
}) {
  const sizing = size === 'lg' ? 'min-h-14 rounded-2xl px-6 text-lg' : 'min-h-12 rounded-xl px-4'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-bold ${sizing} ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

/** 2〜3択の切り替え（設定画面の言語・視点など） */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange(value: T): void
  label: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-slate-800 p-1"
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`min-h-11 rounded-lg px-3 text-sm font-bold ${
              active ? 'bg-amber-300 text-slate-900 shadow' : 'text-slate-300'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
