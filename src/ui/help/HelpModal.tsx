import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/appStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Button } from '../Button'
import { Board } from '../game/Board'
import { HELP_DIAGRAMS, HELP_PAGES } from './diagrams'

/** 左右にこれ以上動かしたらページをめくる（px） */
const SWIPE_PX = 50
const noop = () => {}

/** 遊び方（図解付きスライド・全4ページ）。タイトルから開く */
export function HelpModal() {
  const { t } = useTranslation()
  const close = useAppStore((s) => s.closeHelp)
  const viewMode = useSettingsStore((s) => s.viewMode)
  const [page, setPage] = useState(0)
  const last = HELP_PAGES.length - 1
  const key = HELP_PAGES[page]
  const diagram = useMemo(() => HELP_DIAGRAMS[key](), [key])

  const prev = () => setPage((p) => Math.max(0, p - 1))
  const next = () => setPage((p) => Math.min(last, p + 1))

  // キーボード: ← → でめくる、Esc で閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setPage((p) => Math.max(0, p - 1))
      else if (e.key === 'ArrowRight') setPage((p) => Math.min(last, p + 1))
      else if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [last, close])

  // スワイプでめくる
  const swipeFrom = useRef<number | null>(null)
  const onPointerDown = (e: PointerEvent) => {
    swipeFrom.current = e.clientX
  }
  const onPointerUp = (e: PointerEvent) => {
    if (swipeFrom.current === null) return
    const dx = e.clientX - swipeFrom.current
    swipeFrom.current = null
    if (dx <= -SWIPE_PX) next()
    else if (dx >= SWIPE_PX) prev()
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-stretch justify-center bg-slate-950/80 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
    >
      <div className="bc-card bc-pop flex max-h-full w-full max-w-md flex-col gap-3 rounded-3xl p-4 sm:max-h-[min(780px,100%)] landscape:max-w-4xl">
        <header className="flex items-center gap-2">
          <h2 id="help-title" className="text-xl font-extrabold">
            {t('help.title')}
          </h2>
          <span className="font-mono text-sm font-bold text-slate-400">
            {t('help.page', { current: page + 1, total: HELP_PAGES.length })}
          </span>
          <button
            type="button"
            onClick={close}
            className="ml-auto flex size-11 items-center justify-center rounded-full border border-white/15 text-2xl leading-none text-slate-200"
            aria-label={t('common.close')}
          >
            ×
          </button>
        </header>

        {/* 縦長の画面: 図の下に説明 / 横長の画面: 左に図、右に説明 */}
        <div
          className="flex min-h-0 flex-1 touch-pan-y flex-col gap-3 landscape:flex-row"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (swipeFrom.current = null)}
        >
          <div className="pointer-events-none flex min-h-0 flex-1 items-center justify-center rounded-2xl bg-slate-950/40 p-1 landscape:basis-1/2">
            <Board
              key={key}
              className="bc-pop h-full max-h-[46dvh] w-full landscape:max-h-[calc(100dvh-9rem)]"
              view={diagram.view}
              viewMode={viewMode}
              highlightedBuildings={diagram.highlightedBuildings}
              highlightedIntersections={diagram.highlightedIntersections}
              selectableHelicopters={[]}
              selectedHelicopter={diagram.selectedHelicopter}
              policeMode={null}
              onTapBuilding={noop}
              onTapIntersection={noop}
              onTapHelicopter={noop}
            />
          </div>
          <section
            key={key}
            className="bc-pop flex flex-col gap-1 overflow-y-auto landscape:basis-1/2 landscape:justify-center-safe"
            aria-live="polite"
          >
            <h3 className="font-extrabold text-amber-300">
              {page + 1}. {t(`help.${key}.heading`)}
            </h3>
            <p className="text-sm leading-relaxed text-slate-200">{t(`help.${key}.body`)}</p>
            <p className="text-xs leading-relaxed text-slate-400">{t(`help.${key}.diagram`)}</p>
          </section>
        </div>

        <div className="flex justify-center gap-2" aria-hidden="true">
          {HELP_PAGES.map((p, i) => (
            <span
              key={p}
              className={`size-2 rounded-full ${i === page ? 'bg-amber-300' : 'bg-slate-600'}`}
            />
          ))}
        </div>

        <nav className="grid grid-cols-2 gap-2">
          <Button variant="subtle" onClick={page === 0 ? close : prev}>
            {page === 0 ? t('common.close') : t('help.prev')}
          </Button>
          <Button onClick={page === last ? close : next}>
            {page === last ? t('help.done') : t('help.next')}
          </Button>
        </nav>
      </div>
    </div>
  )
}
