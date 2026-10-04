'use client'

/**
 * 말풍선 6종(screens.md §3-2 C 표). 일본어 본문은 전부 `lang="ja"` 17px, `pre-wrap` + `overflow-wrap:anywhere`
 * (줄바꿈 보존·공백 없는 긴 일본어·이모지·URL 이 가로로 넘치지 않게). 일본어 블록에는 `break-keep` 을 쓰지 않는다.
 * 회화방(task-007 §9-5)은 선택 슬롯(`ranges`·`actions`·`headerExtra`·`correctionChip`)만 더 넘긴다 — 넘기지 않으면 채팅 그대로.
 *
 * task-026(screens §15-4-2): 선생님 말·내 말 모두 히라가나(한자 위) → 본문 → `[한글]` → 번역(안쪽 구분선 아래). 분석 상태(`ann`)는 목록이 한 번에
 * 받아 넘긴다. 번역은 앱 전체 스위치 + 말풍선별 [번역 ▾](스위치를 바꾸면 초기화, §15-3 D). [읽기 ▾] 는 없앴다(E1-A).
 */
import Link from 'next/link'
import { useState } from 'react'
import type { ChatMessageView, TurnStage } from '@/types/chat'
import { apiPost } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { formatClock } from '@/components/common/format'
import { type AnnotationState, type TextRange } from '@/components/common/japanese/annotations'
import { DISPLAY_COPY, useDisplayPrefs, userTrFailure } from '@/components/common/japanese/displayPrefs'
import { HangulLine, HangulPlaceholder, JaText } from '@/components/common/japanese/JapaneseText'
import { DETACHED_TEXT, SLOW_TEXT, stageText, type FailureView } from './labels'
import { fetchUserTranslation } from './messages'
import { elapsedSec, useNow } from '@/components/common/useNow'
import TeacherAvatar from '@/components/common/TeacherAvatar'

export const JA_BODY = 'whitespace-pre-wrap [overflow-wrap:anywhere] text-[17px] leading-[1.7]'

/** 강사 쪽 줄: 아바타 칸(28px)을 늘 비워 두어 묶음 안 말풍선이 한 줄로 맞는다. `headerExtra` = 이름 뒤(회화: "· 말하는 중"). */
export function TutorRow({
  teacherName,
  showHeader,
  headerExtra,
  children,
}: {
  teacherName: string
  showHeader: boolean
  headerExtra?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 gap-2">
      <div className="w-7 flex-none pt-5">{showHeader ? <TeacherAvatar name={teacherName} /> : null}</div>
      <div className="flex min-w-0 max-w-[85%] flex-col items-start">
        {showHeader ? (
          <p className="mb-1 flex min-w-0 max-w-full items-center gap-1 text-[12px] text-ink2">
            <span className="min-w-0 truncate">{teacherName}</span>
            {headerExtra}
          </p>
        ) : null}
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

/** 말풍선별 [번역 ▾] — 앱 전체 스위치를 따르다가 누르면 이 말풍선만 바뀐다. 스위치를 바꾸면(trEpoch) 초기화. */
function useBubbleTranslation(): [boolean, () => void] {
  const prefs = useDisplayPrefs()
  const [own, setOwn] = useState<{ epoch: number; open: boolean } | null>(null)
  const open = own && own.epoch === prefs.trEpoch ? own.open : prefs.loaded && prefs.showTranslation
  return [open, () => setOwn({ epoch: prefs.trEpoch, open: !open })]
}

function TranslationToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-expanded={open} onClick={onClick} className="inline-flex h-11 items-center px-1.5 text-[13px] font-medium text-ink2">
      {open ? DISPLAY_COPY.translationOpen : DISPLAY_COPY.translationClosed}
    </button>
  )
}

type UserTrLocal =
  | { s: 'retrying'; label: string }
  | { s: 'ok'; text: string }
  | { s: 'failed' }
  | { s: 'blocked'; text: string; label: string | null }

const TR_LINE = 'mt-2 border-t border-ink/18'

/**
 * 내 말 번역 칸(E5-A·E6-A, screens §15-2 H). 새 턴은 `done.userTranslation`, 지난 말은 #29 `translation`. 못 받았으면 사용자가 누를 때만 #32t
 * (자동 호출 없음 — 분당 20회·LLM 비용). 오류 문구는 이 칸 안에서만(토스트·빨간색 없음). 받은 번역은 `onTranslated` 로 목록에 올린다 —
 * 칸이 접혔다 펴져(언마운트) 다시 묻지 않게(REV-094 M-1). `local.ok` 는 목록 갱신이 오기 전 한 렌더를 메운다.
 */
function UserTranslation({
  chatId,
  message,
  onTranslated,
}: {
  chatId: string
  message: ChatMessageView
  onTranslated?: (messageId: string, text: string) => void
}) {
  const [local, setLocal] = useState<UserTrLocal | null>(null)
  const server = message.translation?.trim() ? message.translation : null

  const fetchTr = async (label: string) => {
    if (local?.s === 'retrying') return
    setLocal({ s: 'retrying', label })
    try {
      const text = await fetchUserTranslation((url) => apiPost<{ translation: string | null }>(url), chatId, message.id, onTranslated)
      setLocal(text ? { s: 'ok', text } : { s: 'failed' })
    } catch (e) {
      setLocal(userTrFailure(toErr(e), label))
    }
  }

  const button = (label: string) => (
    <button
      type="button"
      onClick={() => void fetchTr(label)}
      className="-my-[7px] -ml-1.5 inline-flex h-11 flex-none items-center px-1.5 text-[13px] text-ink underline underline-offset-[3px]"
    >
      {label}
    </button>
  )
  const row = (children: React.ReactNode) => (
    <div className={`${TR_LINE} flex min-h-[30px] flex-wrap items-center gap-x-2 pt-1.5 text-[13px] text-ink2`}>{children}</div>
  )
  const preparing = (
    <>
      <HangulPlaceholder onTint className="!m-0 !w-[72px] flex-none" />
      <span>{DISPLAY_COPY.userTr.pending}</span>
    </>
  )

  const text = server ?? (local?.s === 'ok' ? local.text : null)
  if (text) return <p className={`${TR_LINE} pt-2 text-[15px] leading-normal text-ink2 break-keep [overflow-wrap:anywhere]`}>{text}</p>
  if (local?.s === 'retrying') return row(preparing)
  if (local?.s === 'blocked')
    return row(
      <>
        <span className="break-keep">{local.text}</span>
        {local.label ? button(local.label) : null}
      </>,
    )
  if (local?.s === 'failed' || message.translationState === 'failed')
    return row(
      <>
        <span className="break-keep">{DISPLAY_COPY.userTr.failed}</span>
        {button(DISPLAY_COPY.userTr.retry)}
      </>,
    )
  if (message.translationState === 'pending' || message.localStatus === 'SENDING') return row(preparing)
  return row(button(DISPLAY_COPY.userTr.fetch))
}

export function UserBubble({
  chatId,
  message,
  showTime,
  ann,
  actions,
  correctionChip = true,
  onTranslated,
}: {
  chatId: string
  message: ChatMessageView
  showTime: boolean
  /** 본문 분석 상태(목록이 모아서 받는다) */
  ann: AnnotationState
  /** 시각 줄 맨 앞(회화: ▶ 내 목소리) */
  actions?: React.ReactNode
  /** 점검 결과로 가는 교정 칩 — 회화는 결과 화면이 없어 끈다 */
  correctionChip?: boolean
  /** 손으로 가져온 번역(#32t)을 목록 상태에 반영 — 방이 `setMessages` 로 그 말의 `translation` 을 채운다 */
  onTranslated?: (messageId: string, text: string) => void
}) {
  const sending = message.localStatus === 'SENDING'
  const chip = correctionChip && (message.corrections?.length ?? 0) > 0
  const [trOpen, toggleTr] = useBubbleTranslation()
  const preparing = message.translationState === 'pending'
  return (
    <div className="flex min-w-0 flex-col items-end">
      <div className="min-w-0 max-w-[80%] rounded-2xl rounded-br-md bg-accent-soft px-3.5 py-2.5 text-ink">
        <span className="sr-only">나:</span>
        {preparing ? <span className="sr-only">{DISPLAY_COPY.preparingSr}</span> : null}
        <JaText text={message.content} state={ann} className={JA_BODY} />
        <HangulLine state={ann} onTint />
        {trOpen ? <UserTranslation chatId={chatId} message={message} onTranslated={onTranslated} /> : null}
      </div>
      <div className="flex min-h-6 min-w-0 max-w-full flex-wrap items-center justify-end gap-x-2 text-[12px] text-ink2">
        {actions}
        <TranslationToggle open={trOpen} onClick={toggleTr} />
        {sending ? <span>보내는 중…</span> : showTime ? <time dateTime={message.createdAt}>{formatClock(message.createdAt)}</time> : null}
        {chip && !sending ? <CorrectionChip chatId={chatId} message={message} /> : null}
      </div>
    </div>
  )
}

export function TutorBubble({
  message,
  teacherName,
  showHeader,
  showTime,
  ann,
  ranges,
  actions,
  headerExtra,
}: {
  message: ChatMessageView
  teacherName: string
  showHeader: boolean
  showTime: boolean
  /** 본문 분석 상태(목록이 모아서 받는다) */
  ann: AnnotationState
  /** 본문 위 범위(회화: 재생 중 문장 강조 — 다시 듣기) */
  ranges?: TextRange[]
  /** 아래 줄 맨 앞(회화: ▶ 다시 듣기) */
  actions?: React.ReactNode
  headerExtra?: React.ReactNode
}) {
  const [trOpen, toggleTr] = useBubbleTranslation()
  const translation = message.translation?.trim() ? message.translation : null
  const grammar = message.learning?.grammarPoint?.trim() || null
  const hasFooter = !!translation || !!grammar || showTime || !!actions

  return (
    <TutorRow teacherName={teacherName} showHeader={showHeader} headerExtra={headerExtra}>
      <div className="min-w-0 max-w-full rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2.5">
        <span className="sr-only">{teacherName}:</span>
        <JaText text={message.content} state={ann} className={JA_BODY} ranges={ranges} />
        <HangulLine state={ann} />
        {trOpen && translation ? (
          <p className="mt-2 border-t border-line pt-2 text-[15px] leading-normal text-ink2 break-keep [overflow-wrap:anywhere]">{translation}</p>
        ) : null}
      </div>
      {hasFooter ? (
        <div className="flex min-w-0 flex-wrap items-center gap-x-1 text-[12px] text-ink2">
          {actions}
          {translation ? <TranslationToggle open={trOpen} onClick={toggleTr} /> : null}
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
