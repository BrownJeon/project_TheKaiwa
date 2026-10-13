/**
 * 머리 「지난 질문」 알약(task-066 §26-4 B — D1=B 약점 보완). 상태 우선순위: 답 만드는 중 > 새 답 > 기본(로딩·오류 포함).
 * 보이는 36 · 터치 44(`before:` 히트). 글자가 바뀌어도 높이는 그대로, 너비만 변한다. 라이브 영역이 아니다(새 답은 토스트 한 번).
 * 색만으로 알리지 않는다 — 글자가 상태를 말한다.
 */
import { ASK_COPY } from './askCopy'
import { askHistoryState } from './homeLogic'

const BASE =
  "relative inline-flex h-9 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border border-line pl-2.5 pr-3 text-[13px] font-semibold text-ink before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']"

export default function AskHistoryButton({ running, newCount, onClick }: { running: boolean; newCount: number; onClick?: () => void }) {
  const s = askHistoryState({ running, newCount })
  const H = ASK_COPY.history
  return (
    <button type="button" onClick={onClick} aria-label={H.aria(s)} className={`${BASE} ${s === 'new' ? 'bg-accent-soft' : 'bg-surface'}`}>
      {s === 'running' ? (
        <>
          <span aria-hidden="true" className="inline-flex gap-[3px]">
            <span className="h-1 w-1 rounded-full bg-current motion-safe:animate-pulse" />
            <span className="h-1 w-1 rounded-full bg-current motion-safe:animate-pulse [animation-delay:200ms]" />
            <span className="h-1 w-1 rounded-full bg-current motion-safe:animate-pulse [animation-delay:400ms]" />
          </span>
          {H.running}
        </>
      ) : s === 'new' ? (
        <>
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
          {H.newAnswer}
        </>
      ) : (
        H.button
      )}
    </button>
  )
}
