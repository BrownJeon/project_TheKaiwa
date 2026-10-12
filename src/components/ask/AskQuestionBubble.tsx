/**
 * 내 질문 말풍선(task-064 §25-5 B) — 한국어 그대로, 히라가나·한글·번역 층 없음([번역] 단추 없음). 일본어 구간만 `lang="ja"`.
 */
import type { ChatMessageView } from '@/types/chat'
import { formatClock } from '@/components/common/format'
import { JaRuns } from '@/components/common/japanese/JaRuns'
import { ASK_COPY } from './askCopy'

export default function AskQuestionBubble({ m, showTime }: { m: ChatMessageView; showTime: boolean }) {
  const sending = m.localStatus === 'SENDING'
  return (
    <div className="flex min-w-0 flex-col items-end">
      <p className="min-w-0 max-w-[84%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent-soft px-3.5 py-2.5 text-[15px] leading-[1.55] text-ink [overflow-wrap:anywhere]">
        <span className="sr-only">{ASK_COPY.meSr}</span>
        <JaRuns text={m.content} />
      </p>
      <p className="min-h-6 text-[12px] text-ink2">
        {sending ? ASK_COPY.asking : showTime ? <time dateTime={m.createdAt}>{formatClock(m.createdAt)}</time> : null}
      </p>
    </div>
  )
}
