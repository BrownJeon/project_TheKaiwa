'use client'

/**
 * 목록 꼬리의 부분 인식 말풍선(screens §9-2 E) — 녹음·인식 중엔 점선 + `aria-hidden`(스크린리더 음성이 마이크로 들어가지 않게),
 * 보내기 대기(QUEUED)는 실선 말풍선 + 안내(마이크가 닫힌 뒤라 낭독해도 된다).
 */
import { JA_BODY } from '@/components/chat/MessageBubble'
import { TALK_ROOM } from './talkCopy'

export default function LiveUtteranceBubble({
  kind,
  partial,
  text,
  out,
  caption,
}: {
  kind: 'listening' | 'recognizing' | 'queued'
  partial: string
  text?: string
  /** 질문 탭만(task-066 §26-7 E) — 손가락이 버튼 밖: 테두리 bad·부분 글 취소선. 없으면 지금 그대로. */
  out?: boolean
  /** 질문 탭만 — 녹음 중 말풍선 아래 캡션(밀어서 취소 안내). 없으면 지금 그대로. */
  caption?: string
}) {
  if (kind === 'queued') {
    return (
      <div className="flex min-w-0 flex-col items-end">
        <div className="min-w-0 max-w-[80%] rounded-2xl rounded-br-md bg-accent-soft px-3.5 py-2.5 text-ink">
          <span className="sr-only">나:</span>
          <p lang="ja" className={JA_BODY}>
            {text}
          </p>
        </div>
        <p className="mt-0.5 text-[12px] text-ink2 break-keep">{TALK_ROOM.queuedCaption}</p>
      </div>
    )
  }
  return (
    <div aria-hidden="true" className="flex min-w-0 flex-col items-end">
      <div className={`min-w-0 max-w-[80%] rounded-2xl rounded-br-md border border-dashed ${out ? 'border-bad' : 'border-line'} bg-surface px-3.5 py-2.5`}>
        {partial ? (
          <p lang="ja" className={out ? `${JA_BODY} text-ink2 line-through` : `${JA_BODY} text-ink2`}>
            {partial}
            <span>…</span>
          </p>
        ) : (
          <p className="text-[14px] text-ink2 break-keep">{TALK_ROOM.listening}</p>
        )}
      </div>
      {caption !== undefined && kind === 'listening' ? (
        <p aria-hidden="true" className={`mt-1 self-end max-w-[84%] text-right text-[12px] break-keep ${out ? 'font-semibold text-bad' : 'text-ink2'}`}>
          {caption}
        </p>
      ) : null}
    </div>
  )
}
