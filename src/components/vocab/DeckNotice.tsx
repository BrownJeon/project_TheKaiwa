'use client'

/**
 * 덱 알림 줄(screens.md §5-2 B DeckNotice) — 우선순위대로 하나만(`pickNotice`), 한 줄 + 닫기. 이어 풀기 알림은 4초 뒤 스스로 닫힌다.
 * 주제 세트(task-044)는 강등·장수 알림이 "표현·이 주제 카드" 문구이고, 폴백 사유(`topicReason`)는 #47 직후 첫 열기에만 보인다.
 */
import type { DeckNotice as Notice } from './deck'
import { formatMonthDay } from './format'
import { REASON } from './topicCopy'

function text(n: Notice, topic: boolean): string {
  switch (n.kind) {
    case 'few':
      return topic ? REASON.few : '뜻이 서로 다른 단어가 4개보다 적어서 이번엔 뒤집기 카드로 풀어요.'
    case 'deleted':
      return '지운 단어가 있어서 이번엔 뒤집기 카드로 풀어요.'
    case 'fewer':
      return topic ? REASON.fewer(n.cardCount) : `풀 수 있는 단어가 ${n.cardCount}개라 ${n.cardCount}장으로 만들었어요.`
    case 'resume':
      return `이어서 풀어요 · ${n.answered}장은 이미 답했어요.`
    case 'pastDate':
      return `${formatMonthDay(n.date)}에 시작한 세트예요. 끝내면 그날 기록으로 남아요.`
    case 'topicReason':
      return n.text
    case 'noChoice':
      return topic ? REASON.noChoice : '뜻이 서로 다른 단어가 4개보다 적어서 이번엔 객관식 없이 풀어요.'
  }
}

export default function DeckNotice({ notice, onClose, topic = false }: { notice: Notice; onClose: () => void; topic?: boolean }) {
  return (
    <div className="flex-none px-4 pt-2">
      <div role="status" className="flex min-w-0 items-center gap-1 rounded-xl bg-surface2 py-0.5 pl-3 text-[13px] text-ink2">
        <p className="min-w-0 flex-1 break-keep py-1.5 [overflow-wrap:anywhere]">{text(notice, topic)}</p>
        <button type="button" aria-label="알림 닫기" onClick={onClose} className="grid h-11 w-11 flex-none place-items-center rounded-full">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
