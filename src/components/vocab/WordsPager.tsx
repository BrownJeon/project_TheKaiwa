/**
 * 단어장 쪽 줄 `‹ 이전 · 3 / 1,109 · 다음 ›`(task-068 §28-1 C, D1 A · J11, 데모 `.pgr`·`button.pgl`). 목록 `ul` 바로 아래(고정·sticky 아님).
 * 질문 탭 `AskPager` 와 같은 단추 모양이고 **가운데가 단추**(누르면 「쪽으로 이동」 시트)인 것만 다르다.
 * 흐림은 `disabled` 가 아니라 `aria-disabled` + 흐림 + 눌러도 아무 일 없음 — 끝 쪽에 닿아도 초점이 누른 단추에 남는다.
 * 가운데 단추 안 글은 이름(`aria-label`)이 대신 읽고, 쪽 위치는 status 한 줄만 알린다(두 번 읽히지 않게).
 */
import { WORDS_PAGE_COPY as P } from './labels'
import type { WordsPagerView } from './wordsPaging'

/** `ask/AskPager.tsx` 의 같은 이름 문자열과 같은 값 — `ask/` 를 import 하지 않으려고 따로 둔다(시험이 두 값이 같음을 단언). */
export const PAGER_BTN =
  'inline-flex h-11 min-w-[92px] flex-none items-center justify-center gap-1 rounded-xl border border-line bg-surface px-3 text-[14px] font-semibold text-ink aria-disabled:opacity-40'

export default function WordsPager({ view, onPrev, onNext, onJump }: { view: WordsPagerView; onPrev: () => void; onNext: () => void; onJump: () => void }) {
  return (
    <>
      <nav aria-label={P.pagerAria} className="mt-3 flex min-w-0 items-center justify-between gap-2">
        <button type="button" onClick={view.prevDisabled ? undefined : onPrev} aria-disabled={view.prevDisabled || undefined} className={PAGER_BTN}>
          <span aria-hidden="true" className="text-[17px] leading-none">
            ‹
          </span>
          <span>{P.prev}</span>
        </button>
        <button
          type="button"
          onClick={view.centerDisabled ? undefined : onJump}
          aria-disabled={view.centerDisabled || undefined}
          aria-label={view.centerAria}
          className="min-h-11 min-w-0 flex-1 rounded-[10px] px-1 text-center tabular-nums text-ink aria-disabled:opacity-50"
        >
          <span className="block text-[15px] font-bold underline decoration-ink3 underline-offset-4">{view.label}</span>
          <span className="block text-[12px] font-normal text-ink2">{view.sub}</span>
        </button>
        <button type="button" onClick={view.nextDisabled ? undefined : onNext} aria-disabled={view.nextDisabled || undefined} className={PAGER_BTN}>
          <span>{P.next}</span>
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
