'use client'

/**
 * 들린 말 확인 카드(task-012b-2 가이드 §2-A, 상태 R0~R9) — 분석이 "다르게 들렸다"고 본 내 발화 하나를 그 자리에서 확정한다(#21a).
 *  - 회화방(`room`): 내 말풍선 아래 44px 접힘 줄 → 펼치면 두 안(라디오) + [이걸로 기록하기]. 방에서 한 번에 하나만 펼친다.
 *  - 내 발화 기록(`log`): 접힘 줄 없이 본문부터.
 * 확정은 `Utterance.finalText/finalSource` 만 바꾼다(D-B6) — 보낸 말풍선 글·교정 카드·평가 답은 화면에서도 그대로 둔다.
 * 신뢰도 숫자·임계·엔진 이름은 어디에도 없다. 고르는 중에는 푸시투토크·입력 바를 막지 않는다.
 */
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { apiPatch } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { changedRanges, NONE, useAnnotations, type AnnotationState, type TextRange } from '@/components/common/japanese/annotations'
import { HangulLine, JaText } from '@/components/common/japanese/JapaneseText'
import { Btn } from '@/components/common/ui'
import { diffCodepoints } from '@/components/chat/diff'
import { FollowHoldContext } from '@/components/chat/followHold'
import type { UtteranceFinalSource, UtteranceListItem, UtteranceResolveBody, UtteranceViewDto } from '@/types/speech'
import UtteranceFixSheet from './UtteranceFixSheet'
import { REVIEW_COPY, REVIEW_DONE } from './utteranceCopy'
import { expandHandler, hasSecond, isReviewable, resolveFailure, slotEntry, type ReviewEntry, type SlotMessage } from './utteranceReview'
import type { UtteranceReviews } from './useUtteranceReviews'

const DIFF_CLASS = 'underline decoration-accent decoration-2 underline-offset-[5px]'
const JA_CLASS = 'mt-1 whitespace-pre-wrap text-[17px] leading-[1.7] [overflow-wrap:anywhere]'

type Phase = 'idle' | 'saving' | 'done' | 'gone' | 'missing'

/** 카드 본문 id — 기록 화면의 [확인하기] 가 `aria-controls` 로 가리킨다(한 화면에 같은 발화는 하나). */
export const reviewBodyId = (utteranceId: string) => `urc-${utteranceId}`

function EarIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none text-accent">
      <path d="M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-5.5 1.6" />
      <path d="M10 10a2 2 0 0 1 4 0" />
    </svg>
  )
}

function radioCard(on: boolean): string {
  return `flex min-h-14 min-w-0 cursor-pointer gap-2.5 rounded-xl border p-3 ${
    on ? 'border-accent bg-surface shadow-[inset_0_0_0_1px_var(--color-accent)]' : 'border-line bg-surface'
  } has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent`
}

function Dot({ on }: { on: boolean }) {
  return <span aria-hidden="true" className={`mt-0.5 h-5 w-5 flex-none rounded-full ${on ? 'border-[6px] border-accent' : 'border-2 border-ink2'}`} />
}

function Choice({ head, sub, text, state, ranges }: { head: string; sub: string; text: string; state: AnnotationState; ranges?: TextRange[] }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-[12px] font-semibold text-ink">{head}</span>
      <span className="block text-[12px] text-ink2">{sub}</span>
      <JaText as="span" text={text} state={state} ranges={ranges} className={`block ${JA_CLASS}`} />
      <HangulLine as="span" state={state} size={13} />
    </span>
  )
}

export interface UtteranceReviewCardProps {
  item: UtteranceListItem
  variant: 'room' | 'log'
  /** 회화방 접힘/펼침(로그는 늘 펼침). */
  open: boolean
  onToggle?: () => void
  /** 이 방에서 이미 확정한 출처(방을 떠날 때까지 성공 줄). */
  resolved?: UtteranceFinalSource | null
  /** 펼치기 직전 — 목록이 바닥으로 따라가며 누른 줄을 밀지 않게(task-039 ⑧). */
  onExpand?: () => void
  onResolved: (view: UtteranceViewDto) => void
  /** 409·404 — 카드는 상태 줄로 남고, 다음 갱신 때 빠진다. */
  onSettled?: (phase: 'gone' | 'missing') => void
  /** 기록 중(갱신이 지우지 않게 붙잡기). */
  onBusy?: (busy: boolean) => void
}

export default function UtteranceReviewCard({ item, variant, open, onToggle, resolved = null, onExpand, onResolved, onSettled, onBusy }: UtteranceReviewCardProps) {
  const bodyId = reviewBodyId(item.id)
  const [sel, setSel] = useState<'REALTIME' | 'ANALYSIS' | null>(null)
  const [phase, setPhase] = useState<Phase>(resolved ? 'done' : 'idle')
  const [doneSource, setDoneSource] = useState<UtteranceFinalSource | null>(resolved)
  const [err, setErr] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetErr, setSheetErr] = useState<string | null>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const focusStatus = useRef(false)

  const two = hasSecond(item)
  const expanded = variant === 'log' || open
  const texts = useMemo(() => (expanded ? (two ? [item.realtimeText, item.analysisText ?? ''] : [item.realtimeText]) : []), [expanded, two, item.realtimeText, item.analysisText])
  const anns = useAnnotations(texts)
  const diff = useMemo(() => (two ? diffCodepoints(item.realtimeText, item.analysisText ?? '') : null), [two, item.realtimeText, item.analysisText])
  const rangesA = diff ? changedRanges(diff.a, DIFF_CLASS) : undefined
  const rangesB = diff ? changedRanges(diff.b, DIFF_CLASS) : undefined

  useEffect(() => {
    if (focusStatus.current && statusRef.current) {
      focusStatus.current = false
      statusRef.current.focus()
    }
  }, [phase])

  const saving = phase === 'saving'

  const submit = async (body: UtteranceResolveBody, fromSheet: boolean) => {
    if (saving) return
    setErr(null)
    setSheetErr(null)
    setPhase('saving')
    onBusy?.(true)
    try {
      const view = await apiPatch<UtteranceViewDto>(`/api/v1/speech/utterances/${encodeURIComponent(item.id)}`, body)
      focusStatus.current = true
      setDoneSource(view.finalSource)
      setPhase('done')
      setSheetOpen(false)
      onResolved(view)
    } catch (e) {
      const f = resolveFailure(toErr(e))
      if (f.phase === 'error') {
        setPhase('idle')
        if (fromSheet) setSheetErr(f.text)
        else setErr(f.text)
      } else {
        focusStatus.current = true
        setSheetOpen(false)
        setPhase(f.phase)
        onSettled?.(f.phase)
      }
    } finally {
      onBusy?.(false)
    }
  }

  if (phase === 'done' && doneSource) {
    return (
      <div className={variant === 'room' ? 'mt-1.5 w-full min-w-0' : 'mt-2 min-w-0'}>
        <p ref={statusRef} role="status" tabIndex={-1} className="rounded-xl bg-good-soft px-3 py-2 text-[13px] font-semibold text-good break-keep outline-none">
          {REVIEW_DONE[doneSource]}
        </p>
      </div>
    )
  }
  if (phase === 'gone' || phase === 'missing') {
    return (
      <div className={variant === 'room' ? 'mt-1.5 w-full min-w-0' : 'mt-2 min-w-0'}>
        <p ref={statusRef} role="status" tabIndex={-1} className="rounded-xl bg-surface2 px-3 py-2 text-[13px] text-ink2 break-keep outline-none">
          {phase === 'gone' ? REVIEW_COPY.already : REVIEW_COPY.missing}
        </p>
      </div>
    )
  }
  if (!isReviewable(item)) return null

  const onSave = () => {
    if (saving) return
    if (two && !sel) {
      setErr(REVIEW_COPY.pickFirst)
      return
    }
    void submit({ choice: two ? (sel ?? 'REALTIME') : 'REALTIME' }, false)
  }

  const body = (
    <div id={bodyId} className={`${variant === 'room' ? 'mt-1.5' : 'mt-2'} min-w-0 rounded-[14px] border border-line bg-surface p-3.5`}>
      <p className="text-[13px] text-ink2 break-keep">{REVIEW_COPY.intro}</p>
      {two ? (
        <fieldset className="mt-2.5 flex min-w-0 flex-col gap-2" aria-disabled={saving || undefined}>
          <legend className="sr-only">{REVIEW_COPY.legend}</legend>
          <p className="sr-only">{REVIEW_COPY.diffSr}</p>
          {(['REALTIME', 'ANALYSIS'] as const).map((v) => (
            <label key={v} className={radioCard(sel === v)}>
              <input
                type="radio"
                name={bodyId}
                value={v}
                checked={sel === v}
                onChange={() => {
                  if (saving) return
                  setSel(v)
                  setErr(null)
                }}
                aria-disabled={saving || undefined}
                className="sr-only"
              />
              <Dot on={sel === v} />
              {v === 'REALTIME' ? (
                <Choice head={REVIEW_COPY.realtimeHead} sub={REVIEW_COPY.realtimeSub} text={item.realtimeText} state={anns[0] ?? NONE} ranges={rangesA} />
              ) : (
                <Choice head={REVIEW_COPY.analysisHead} sub={REVIEW_COPY.analysisSub} text={item.analysisText ?? ''} state={anns[1] ?? NONE} ranges={rangesB} />
              )}
            </label>
          ))}
        </fieldset>
      ) : (
        <div className="mt-2.5 min-w-0">
          <div className="min-w-0 rounded-xl border border-line bg-surface p-3">
            <Choice head={REVIEW_COPY.realtimeHead} sub={REVIEW_COPY.realtimeSub} text={item.realtimeText} state={anns[0] ?? NONE} />
          </div>
          <p className="mt-2 text-[13px] text-ink2 break-keep">{REVIEW_COPY.noSecond}</p>
        </div>
      )}
      {item.audioAvailable && variant === 'room' ? <p className="mt-2 text-[12px] text-ink2 break-keep">{REVIEW_COPY.audioHint}</p> : null}
      <Btn className="mt-3 w-full" aria-disabled={(two && !sel) || saving || undefined} aria-busy={saving || undefined} onClick={onSave}>
        {saving ? REVIEW_COPY.saving : two ? REVIEW_COPY.save : REVIEW_COPY.keepAsIs}
      </Btn>
      {err ? (
        <p role="alert" className="mt-1.5 text-[12.5px] text-bad break-keep">
          {err}
        </p>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center gap-x-1">
        <button
          type="button"
          aria-disabled={saving || undefined}
          onClick={() => {
            if (saving) return
            setSheetErr(null)
            setSheetOpen(true)
          }}
          className="h-11 px-1.5 text-[14px] font-medium text-ink underline underline-offset-4"
        >
          {REVIEW_COPY.fix}
        </button>
        {variant === 'room' ? (
          <button type="button" aria-disabled={saving || undefined} onClick={() => !saving && onToggle?.()} className="ml-auto h-11 px-1.5 text-[14px] text-ink2">
            {REVIEW_COPY.later}
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-[12px] text-ink2 break-keep">{REVIEW_COPY.effect}</p>
      <UtteranceFixSheet
        open={sheetOpen}
        realtimeText={item.realtimeText}
        analysisText={item.analysisText}
        saving={saving}
        err={sheetErr}
        onSubmit={(b) => void submit(b, true)}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  )

  if (variant === 'log') return body

  return (
    <div className="mt-1.5 w-full min-w-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => {
          if (!open) onExpand?.()
          onToggle?.()
        }}
        className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <EarIcon />
        <span className="flex-none text-[14px] font-semibold text-ink">{REVIEW_COPY.title}</span>
        <span className="min-w-0 truncate text-[13px] text-ink2">{REVIEW_COPY.teaser}</span>
        <span aria-hidden="true" className={`ml-auto flex-none text-ink2 motion-safe:transition-transform ${open ? 'rotate-90' : ''}`}>
          ›
        </span>
      </button>
      {open ? body : null}
    </div>
  )
}

/**
 * 회화방 삽입 자리(가이드 §5 — `TalkRoom.renderUser` 의 `<UserBubble/>` 다음 한 줄). 그 메시지에 확인할 발화가 없으면 자리 0(R0).
 * 보내는 중(`localStatus='SENDING'`) 메시지·선생님 말풍선에는 붙이지 않는다.
 * 따라가기 멈춤은 TalkRoom 이 아니라 여기서 읽는다 — 이 자리는 `MessageList` 의 Provider 아래에서 그려진다.
 */
export function UtteranceReviewSlot({
  reviews,
  message,
  onExpand,
}: {
  reviews: UtteranceReviews
  message: SlotMessage
  onExpand?: () => void
}) {
  const hold = useContext(FollowHoldContext)
  const entry: ReviewEntry | null = slotEntry(message, reviews.entryFor)
  if (!entry) return null
  const id = entry.item.id
  return (
    <UtteranceReviewCard
      key={id}
      item={entry.item}
      variant="room"
      open={reviews.openId === id}
      onToggle={() => reviews.setOpen(reviews.openId === id ? null : id)}
      resolved={entry.resolved}
      onExpand={expandHandler(onExpand, hold)}
      onBusy={(b) => reviews.pin(id, b)}
      onResolved={(v) => {
        reviews.markResolved(message.id, v.finalSource)
        reviews.setOpen(null)
      }}
      onSettled={() => {
        reviews.release(id)
        reviews.setOpen(null)
      }}
    />
  )
}
