/**
 * 내 질문 말풍선.
 * - 글자로 물은 것(task-064 §25-5 B): 한국어 그대로 15px, 히라가나·한글·번역 층 없음. 일본어 구간만 `lang="ja"`.
 * - 말로 물은 것(task-066 §26-7 F, `inputSource === 'REALTIME_STT'`): 들린 일본어를 17px·읽기 층(히라가나·[한글] — 표시 스위치)으로,
 *   아래 「🎤 말로 물었어요」와 가장 최근 질문이면 [고쳐서 묻기]. 들린 글은 문장부호가 없어도 고치지 않고 그대로 보인다(J6).
 */
import type { ChatMessageView } from '@/types/chat'
import { JA_BODY } from '@/components/chat/MessageBubble'
import { formatClock } from '@/components/common/format'
import { OFF, type AnnotationState } from '@/components/common/japanese/annotations'
import { HangulLine, JaText } from '@/components/common/japanese/JapaneseText'
import { JaRuns } from '@/components/common/japanese/JaRuns'
import { ASK_COPY } from './askCopy'
import { ASK_VOICE_COPY } from './askVoiceCopy'
import { isVoiceQuestion } from './voiceBubble'

const offAnn = (): AnnotationState => OFF

function MicIcon() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mr-[3px] inline align-[-2px]">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}

export default function AskQuestionBubble({
  m,
  showTime = false,
  sending: sendingProp,
  canFix = false,
  onFix,
  ann = offAnn,
}: {
  m: ChatMessageView
  showTime?: boolean
  /** 방 만들기(#28) 동안의 임시 말풍선 — 없으면 `m.localStatus` 로 판단 */
  sending?: boolean
  /** [고쳐서 묻기] — 말로 물은 가장 최근 질문에만(`lastUserVoiceId`) */
  canFix?: boolean
  onFix?: (text: string) => void
  /** 말로 물은 글의 읽기 층 상태(`useAnnotations`) — 없으면 층 없음 */
  ann?: (text: string) => AnnotationState
}) {
  const sending = sendingProp ?? m.localStatus === 'SENDING'
  if (!isVoiceQuestion(m)) {
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
  const state = ann(m.content)
  return (
    <div className="flex min-w-0 flex-col items-end gap-0.5">
      <div lang="ja" className="min-w-0 max-w-[84%] rounded-2xl rounded-br-md bg-accent-soft px-3.5 py-2.5 text-ink">
        <span lang="ko" className="sr-only">
          {ASK_VOICE_COPY.meSr}
        </span>
        <JaText text={m.content} state={state} className={JA_BODY} />
        <HangulLine state={state} onTint waitAsLine />
      </div>
      <p className="flex min-h-5 flex-wrap items-center justify-end gap-x-2.5 text-[12px] text-ink2">
        <span>
          <MicIcon />
          {ASK_VOICE_COPY.asked}
        </span>
        {canFix && onFix ? (
          <button
            type="button"
            onClick={() => onFix(m.content)}
            className="inline-flex min-h-11 items-center px-0.5 text-[13px] font-semibold text-ink underline underline-offset-[3px]"
          >
            {ASK_VOICE_COPY.fix}
          </button>
        ) : null}
        {sending ? ASK_COPY.asking : showTime ? <time dateTime={m.createdAt}>{formatClock(m.createdAt)}</time> : null}
      </p>
    </div>
  )
}
