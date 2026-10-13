/**
 * 지난 질문 쪽 줄 `‹ 이전 · 1 / 3 · 다음 ›`(task-067 §27-4 B, 데모 `.pgr`).
 * 흐림은 `disabled` 가 아니라 `aria-disabled` + 흐림 40% + 눌러도 아무 일 없음(J9) — 끝 쪽에 닿아도 초점이 누른 단추에 남는다.
 * 가운데 라벨은 화면 읽기에서 숨기고 같은 뜻을 status 한 줄로(두 번 읽히지 않게). 단추 44 높이 · 최소 92 폭(360 에서도 한 줄).
 */
import { ASK_COPY } from './askCopy'
import type { PagerView } from './historyPaging'

const PAGER_BTN =
  'inline-flex h-11 min-w-[92px] flex-none items-center justify-center gap-1 rounded-xl border border-line bg-surface px-3 text-[14px] font-semibold text-ink aria-disabled:opacity-40'

export default function AskPager({ view, onPrev, onNext }: { view: PagerView; onPrev: () => void; onNext: () => void }) {
  const H = ASK_COPY.history
  return (
    <>
      <nav aria-label={H.pagerAria} className="flex min-w-0 items-center justify-between gap-2 pt-0.5">
        <button type="button" onClick={view.prevDisabled ? undefined : onPrev} aria-disabled={view.prevDisabled || undefined} className={PAGER_BTN}>
          <span aria-hidden="true" className="text-[17px] leading-none">
            ‹
          </span>
          <span>{H.prev}</span>
        </button>
        <p aria-hidden="true" className="min-w-0 flex-1 text-center tabular-nums">
          <span className="block text-[15px] font-bold">{view.label}</span>
          <span className="block text-[12px] text-ink2">{view.sub}</span>
        </p>
        <button type="button" onClick={view.nextDisabled ? undefined : onNext} aria-disabled={view.nextDisabled || undefined} className={PAGER_BTN}>
          <span>{H.next}</span>
          <span aria-hidden="true" className="text-[17px] leading-none">
            ›
          </span>
        </button>
      </nav>
      <p role="status" className="sr-only">
        {view.sr}
      </p>
    </>
  )
}
