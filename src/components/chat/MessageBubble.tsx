'use client'

/**
 * 말풍선 6종(screens.md §3-2 C 표). 일본어 본문은 전부 `lang="ja"` 17px, `pre-wrap` + `overflow-wrap:anywhere`
 * (줄바꿈 보존·공백 없는 긴 일본어·이모지·URL 이 가로로 넘치지 않게). 일본어 블록에는 `break-keep` 을 쓰지 않는다.
 */
import Link from 'next/link'
import { useState } from 'react'
import type { ChatMessageView, TurnStage } from '@/types/chat'
import { formatClock } from '@/components/common/format'
import { DETACHED_TEXT, SLOW_TEXT, stageText, type FailureView } from './labels'
import { elapsedSec, useNow } from '@/components/common/useNow'
import TeacherAvatar from '@/components/common/TeacherAvatar'

const JA_BODY = 'whitespace-pre-wrap [overflow-wrap:anywhere] text-[17px] leading-[1.7]'


/** 강사 쪽 줄: 아바타 칸(28px)을 늘 비워 두어 묶음 안 말풍선이 한 줄로 맞는다. */
function TutorRow({ teacherName, showHeader, children }: { teacherName: string; showHeader: boolean; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 gap-2">
      <div className="w-7 flex-none pt-5">{showHeader ? <TeacherAvatar name={teacherName} /> : null}</div>
      <div className="flex min-w-0 max-w-[85%] flex-col items-start">
        {showHeader ? <p className="mb-1 truncate text-[12px] text-ink2">{teacherName}</p> : null}
        {children}
      </div>
    </div>
  )
}

export function CorrectionChip({ chatId, message }: { chatId: string; message: ChatMessageView }) {
  const list = message.corrections ?? []
  if (list.length === 0) return null
  const pending = list.filter((c) => c.status === 'PROPOSED').length
  return (
    <Link href={`/study/ai/chat/${encodeURIComponent(chatId)}/review#cr_${list[0].id}`} className="inline-flex h-11 flex-none items-center">
      <span
        className={`inline-flex h-[24px] items-center rounded-md px-2 text-[12px] font-semibold ${
          pending > 0 ? 'bg-surface2 text-ink2' : 'bg-good-soft text-good'
        }`}
      >
        {pending > 0 ? `교정 ${pending} ›` : '교정 확인함 ›'}
      </span>
    </Link>
  )
}

export function UserBubble({ chatId, message, showTime }: { chatId: string; message: ChatMessageView; showTime: boolean }) {
  const sending = message.localStatus === 'SENDING'
  const chip = (message.corrections?.length ?? 0) > 0
  return (
    <div className="flex min-w-0 flex-col items-end">
      <div className="min-w-0 max-w-[80%] rounded-2xl rounded-br-md bg-accent-soft px-3.5 py-2.5 text-ink">
        <span className="sr-only">나:</span>
        <p lang="ja" className={JA_BODY}>
          {message.content}
        </p>
      </div>
      {sending || showTime || chip ? (
        <div className="flex min-h-6 items-center gap-2 text-[12px] text-ink2">
          {sending ? <span>보내는 중…</span> : showTime ? <time dateTime={message.createdAt}>{formatClock(message.createdAt)}</time> : null}
          {chip && !sending ? <CorrectionChip chatId={chatId} message={message} /> : null}
        </div>
      ) : null}
    </div>
  )
}

export function TutorBubble({
  message,
  teacherName,
  showHeader,
  showTime,
  readingDefault,
}: {
  message: ChatMessageView
  teacherName: string
  showHeader: boolean
  showTime: boolean
  readingDefault: boolean
}) {
  // null = 사용자 기본값을 따른다(메뉴의 "읽기 항상 펼치기"가 바뀌면 손대지 않은 말풍선도 같이 바뀐다).
  const [readingOpen, setReadingOpen] = useState<boolean | null>(null)
  const [translationOpen, setTranslationOpen] = useState(false)
  const reading = message.reading?.trim() ? message.reading : null
  const hasReading = !!reading && reading !== message.content
  const showReading = hasReading && (readingOpen ?? readingDefault)
  const translation = message.translation?.trim() ? message.translation : null
  const grammar = message.learning?.grammarPoint?.trim() || null
  const hasFooter = hasReading || !!translation || !!grammar || showTime

  return (
    <TutorRow teacherName={teacherName} showHeader={showHeader}>
      <div className="min-w-0 max-w-full rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2.5">
        <span className="sr-only">{teacherName}:</span>
        <p lang="ja" className={JA_BODY}>
          {message.content}
        </p>
        {showReading ? (
          <p lang="ja" className="mt-1 whitespace-pre-wrap text-[14px] leading-[1.6] text-ink2 [overflow-wrap:anywhere]">
            {reading}
          </p>
        ) : null}
        {translationOpen && translation ? (
          <p className="mt-2 border-t border-line pt-2 text-[15px] leading-normal text-ink2 break-keep [overflow-wrap:anywhere]">{translation}</p>
        ) : null}
      </div>
      {hasFooter ? (
        <div className="flex min-w-0 flex-wrap items-center gap-x-1 text-[12px] text-ink2">
          {hasReading ? (
            <button
              type="button"
              aria-expanded={showReading}
              onClick={() => setReadingOpen(!showReading)}
              className="inline-flex h-11 items-center px-1.5 text-[13px] font-medium text-ink2"
            >
              읽기 {showReading ? '▴' : '▾'}
            </button>
          ) : null}
          {translation ? (
            <button
              type="button"
              aria-expanded={translationOpen}
              onClick={() => setTranslationOpen((v) => !v)}
              className="inline-flex h-11 items-center px-1.5 text-[13px] font-medium text-ink2"
            >
              번역 {translationOpen ? '▴' : '▾'}
            </button>
          ) : null}
          {grammar ? (
            <span lang="ja" className="inline-flex min-h-[22px] min-w-0 items-center rounded-md bg-surface2 px-2 text-[12px] text-ink2 [overflow-wrap:anywhere]">
              {grammar}
            </span>
          ) : null}
          {showTime ? (
            <time dateTime={message.createdAt} className="px-1">
              {formatClock(message.createdAt)}
            </time>
          ) : null}
        </div>
      ) : null}
    </TutorRow>
  )
}

export function PendingBubble({
  teacherName,
  showHeader,
  stage,
  startedAt,
  detached,
}: {
  teacherName: string
  showHeader: boolean
  stage: TurnStage | null
  startedAt: number | null
  detached: boolean
}) {
  const now = useNow(true)
  const sec = elapsedSec(now, startedAt)
  const base = detached ? DETACHED_TEXT : stageText(stage)
  const text = detached ? base : sec >= 12 ? `${SLOW_TEXT} · ${sec}초` : sec >= 5 ? `${base} · ${sec}초` : base
  return (
    <TutorRow teacherName={teacherName} showHeader={showHeader}>
      <div role="status" className="flex min-w-0 flex-col gap-1.5 rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-3">
        <span aria-hidden="true" className="flex h-3 items-center gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink2 motion-reduce:animate-none"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
        <span className="text-[13px] text-ink2 break-keep">{text}</span>
      </div>
    </TutorRow>
  )
}

export function FailedBubble({
  teacherName,
  showHeader,
  failure,
  busy,
  onRetry,
}: {
  teacherName: string
  showHeader: boolean
  failure: FailureView
  busy: boolean
  onRetry: () => void
}) {
  return (
    <TutorRow teacherName={teacherName} showHeader={showHeader}>
      <div className="min-w-0 rounded-2xl rounded-bl-md bg-bad-soft px-3.5 py-2.5 text-bad">
        <p className="text-[14px] break-keep">{failure.text}</p>
        {failure.retryable ? (
          <button
            type="button"
            aria-disabled={busy || undefined}
            onClick={() => {
              if (!busy) onRetry()
            }}
            className={`mt-1 inline-flex h-11 items-center rounded-lg px-1 text-[14px] font-semibold underline underline-offset-4 ${busy ? 'opacity-60' : ''}`}
          >
            {busy ? '다시 받는 중…' : '다시 받기'}
          </button>
        ) : null}
      </div>
    </TutorRow>
  )
}

export function FailedLine() {
  return <p className="pl-9 text-[12px] text-ink2">답을 받지 못한 메시지예요</p>
}
