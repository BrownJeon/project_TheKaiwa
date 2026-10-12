'use client'

/**
 * 실패 카드(task-064 §25-5 G) — 시간 초과·답 불가(이어받은 실패 포함). [다시 받기]는 늘 보인다(채팅의 `retryable:false` 숨김 규칙을 쓰지 않음).
 * 누르면 같은 질문으로 다시 받는다(새 말풍선 없음 — `turn.resume()`).
 */
import type { FailureView } from '@/components/chat/labels'
import { ASK_COPY } from './askCopy'
import { TeacherLine } from './AskPending'
import { askFailureCopy } from './logic'

export default function AskFailed({
  teacherName,
  title,
  failure,
  busy,
  onRetry,
}: {
  teacherName: string
  title: string
  failure: FailureView | null
  busy: boolean
  onRetry: () => void
}) {
  const copy = askFailureCopy(failure)
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <TeacherLine teacherName={teacherName} title={title} />
      <div role="alert" className="rounded-[6px_16px_16px_16px] bg-bad-soft px-3.5 py-3 text-[13.5px] text-bad break-keep">
        <span className="block text-[14.5px] font-semibold">{copy.title}</span>
        {copy.body}
        <div>
          <button
            type="button"
            onClick={() => {
              if (!busy) onRetry()
            }}
            aria-disabled={busy || undefined}
            aria-busy={busy || undefined}
            className="mt-2 inline-flex min-h-11 items-center justify-center rounded-[10px] border border-bad bg-surface px-3.5 text-[14px] font-semibold text-bad"
          >
            {busy ? ASK_COPY.retryGetBusy : ASK_COPY.retryGet}
          </button>
        </div>
      </div>
    </div>
  )
}
