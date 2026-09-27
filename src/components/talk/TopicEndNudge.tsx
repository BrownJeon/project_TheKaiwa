'use client'

/** 선생님이 이야기가 끝났다고 본 뒤(직전 `done.endOfTopic`) 새 회화를 권하는 한 줄(screens §9-2 G ⑤). */
import { TOPIC_END_COPY } from './talkCopy'

export default function TopicEndNudge({ onNew, onClose }: { onNew: () => void; onClose: () => void }) {
  return (
    <div className="flex min-w-0 items-center gap-1 rounded-xl bg-surface2 pl-3.5">
      <p className="min-w-0 flex-1 py-2 text-[13px] text-ink2 break-keep">{TOPIC_END_COPY.text}</p>
      <button type="button" onClick={onNew} className="inline-flex h-11 flex-none items-center px-2 text-[13px] font-semibold text-ink underline underline-offset-4">
        {TOPIC_END_COPY.action}
      </button>
      <button type="button" aria-label={TOPIC_END_COPY.close} onClick={onClose} className="grid h-11 w-11 flex-none place-items-center text-ink2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  )
}
