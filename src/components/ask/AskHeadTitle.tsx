/**
 * 질문 탭 머리 제목 블록(task-067 §27-2 B — D1 A) — `AppBar heading` 에 넣는다. 「질문」 아래 작은 줄에 지금 대화 제목.
 * - `new`     빈 대화·탭 자리표시: 둘째 줄 「새 질문」(머리 높이가 변하지 않게, J8). 단추 아님.
 * - `loading` 대화를 읽는 중: 둘째 줄 = 시트에서 고른 행 제목(힌트), 힌트가 없으면 회색 막대. **단추 아님** — 확인되지 않은 대화의 제목은 바꿀 수 없다.
 * - `ready`   둘째 줄 제목 + 연필, 블록 전체가 `h1` 안 단추 → 제목 바꾸기.
 */
import { JaRuns } from '@/components/common/japanese/JaRuns'
import { ASK_COPY } from './askCopy'

export type AskHeadState = 'new' | 'loading' | 'ready'

const BLOCK = 'flex h-11 min-w-0 flex-1 flex-col justify-center gap-px'
const LINE1 = 'block truncate text-xl font-bold leading-[1.15]'
const LINE2 = 'flex min-w-0 items-center text-[12.5px] leading-[1.3] text-ink2'

export default function AskHeadTitle({ state, title, onRename }: { state: AskHeadState; title?: string | null; onRename?: () => void }) {
  if (state === 'ready') {
    const t = title ?? ''
    return (
      <button
        type="button"
        onClick={onRename}
        aria-label={ASK_COPY.head.aria(t)}
        className={`-ml-1.5 ${BLOCK} rounded-[10px] px-1.5 text-left active:bg-surface2 active:shadow-[inset_0_0_0_2px_var(--color-accent)]`}
      >
        <span className={LINE1}>{ASK_COPY.title}</span>
        <span className={`${LINE2} gap-[3px]`}>
          <span className="min-w-0 truncate">
            <JaRuns text={t} />
          </span>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="flex-none"
          >
            <path d="M4 20h4L19 9l-4-4L4 16z" />
            <path d="M14 6l4 4" />
          </svg>
        </span>
      </button>
    )
  }
  return (
    <span className={BLOCK}>
      <span className={LINE1}>{ASK_COPY.title}</span>
      <span className={LINE2}>
        {state === 'new' ? (
          <span className="min-w-0 truncate">{ASK_COPY.head.newConv}</span>
        ) : title ? (
          <span className="min-w-0 truncate">
            <JaRuns text={title} />
          </span>
        ) : (
          <span aria-hidden="true" className="block h-3 w-24 rounded bg-surface2" />
        )}
      </span>
    </span>
  )
}
