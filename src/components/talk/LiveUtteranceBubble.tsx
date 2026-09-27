'use client'

/**
 * 목록 꼬리의 부분 인식 말풍선(screens §9-2 E) — 녹음·인식 중엔 점선 + `aria-hidden`(스크린리더 음성이 마이크로 들어가지 않게),
 * 보내기 대기(QUEUED)는 실선 말풍선 + 안내(마이크가 닫힌 뒤라 낭독해도 된다).
 */
import { JA_BODY } from '@/components/chat/MessageBubble'
import { TALK_ROOM } from './talkCopy'

export default function LiveUtteranceBubble({ kind, partial, text }: { kind: 'listening' | 'recognizing' | 'queued'; partial: string; text?: string }) {
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
      <div className="min-w-0 max-w-[80%] rounded-2xl rounded-br-md border border-dashed border-line bg-surface px-3.5 py-2.5">
        {partial ? (
          <p lang="ja" className={`${JA_BODY} text-ink2`}>
            {partial}
            <span>…</span>
          </p>
        ) : (
          <p className="text-[14px] text-ink2 break-keep">{TALK_ROOM.listening}</p>
        )}
      </div>
    </div>
  )
}
