'use client'

/**
 * 모아 둔 교정 시트(task-010c, 데모 v1 `fl-sheet`·`fl-done`·`fl-empty`·`fl-loading`·`fl-error`·`fl-deeplink`) — 유창성의 작은 실수(LATER)를
 * 대화 순서대로 기존 교정 카드로 보인다. 목록은 열 때 불러온다(예전에 한 말까지 모이니까). [채택]은 기존 채택 시트를 이 시트 위에 연다 —
 * 그동안 이 시트는 닫히지 않는다(Esc 가 두 시트를 함께 닫지 않게).
 */
import { useEffect, useRef } from 'react'
import Sheet from '@/components/common/Sheet'
import { Btn } from '@/components/common/ui'
import CorrectionCard from '@/components/chat/CorrectionCard'
import type { CorrectionDto } from '@/types/chat'
import { LATER_COPY } from './talkCopy'

export type LaterListState = { status: 'loading' } | { status: 'error' } | { status: 'ok'; items: CorrectionDto[] }

export default function LaterCorrectionsSheet({
  open,
  state,
  highlightId,
  busyId,
  dismissible,
  focusKey,
  onClose,
  onRetry,
  onAccept,
  onReject,
}: {
  open: boolean
  state: LaterListState
  /** 홈에서 이 교정을 눌러 들어왔을 때 — 그 카드로 스크롤하고 테두리로 강조. */
  highlightId: string | null
  busyId: string | null
  /** 채택 시트가 위에 떠 있으면 false. */
  dismissible: boolean
  /** 카드를 처리할 때마다 바뀐다 — 초점을 머리 문구(남은 것이 있으면)나 [대화로 돌아가기]로 옮긴다. */
  focusKey: number
  onClose: () => void
  onRetry: () => void
  onAccept: (c: CorrectionDto) => void
  onReject: (c: CorrectionDto) => void
}) {
  const items = state.status === 'ok' ? state.items : []
  const pending = items.filter((c) => c.status === 'PROPOSED').length
  const leadRef = useRef<HTMLParagraphElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open || focusKey === 0) return
    const t = setTimeout(() => (pending > 0 ? leadRef.current : backRef.current)?.focus(), 0)
    return () => clearTimeout(t)
  }, [open, focusKey, pending])

  useEffect(() => {
    if (!open || !highlightId || state.status !== 'ok') return
    const t = setTimeout(() => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      document.getElementById(`cr_${highlightId}`)?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
    }, 50)
    return () => clearTimeout(t)
  }, [open, highlightId, state.status])

  let body: React.ReactNode
  if (state.status === 'loading') {
    body = (
      <div className="flex flex-col gap-2 pb-2">
        <p role="status" className="sr-only">
          {LATER_COPY.loading}
        </p>
        <span aria-hidden="true" className="block h-[150px] rounded-[14px] bg-surface2" />
        <span aria-hidden="true" className="block h-[150px] rounded-[14px] bg-surface2" />
      </div>
    )
  } else if (state.status === 'error') {
    body = (
      <div role="alert" className="rounded-xl bg-bad-soft px-3.5 py-3 text-[13px] text-bad">
        <p className="break-keep">{LATER_COPY.error}</p>
        <button type="button" onClick={onRetry} className="inline-flex min-h-11 items-center text-[13px] font-semibold underline underline-offset-[3px]">
          {LATER_COPY.retry}
        </button>
      </div>
    )
  } else if (items.length === 0) {
    body = (
      <div className="flex flex-col items-center gap-1.5 px-2 pb-2 pt-7 text-center">
        <p className="text-[15px] font-semibold">{LATER_COPY.emptyTitle}</p>
        <p className="text-[13px] text-ink2 break-keep">{LATER_COPY.emptySub}</p>
        <Btn variant="ghost" className="mt-3 w-full" onClick={onClose}>
          {LATER_COPY.close}
        </Btn>
      </div>
    )
  } else {
    body = (
      <div className="pb-2">
        {pending > 0 ? (
          <>
            <p ref={leadRef} tabIndex={-1} className="text-[14px] break-keep outline-none">
              {LATER_COPY.intro}
            </p>
            <p role="status" className="mt-1 text-[12px] text-ink2">
              {LATER_COPY.remainingLead}
              <b className="font-semibold text-ink tabular-nums">{pending}</b>
              {LATER_COPY.remainingTail}
            </p>
          </>
        ) : (
          <>
            <div role="status" className="flex items-center gap-3 rounded-xl bg-good-soft p-3">
              <span aria-hidden="true" className="grid h-10 w-10 flex-none place-items-center rounded-full bg-surface text-[20px] font-bold text-good">
                ✓
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-ink break-keep">{LATER_COPY.doneTitle}</p>
                <p className="text-[13px] text-ink2 break-keep">{LATER_COPY.doneSub}</p>
              </div>
            </div>
            <button
              ref={backRef}
              type="button"
              onClick={onClose}
              className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-xl bg-accent px-4 text-[15px] font-semibold text-on-accent"
            >
              {LATER_COPY.back}
            </button>
          </>
        )}
        <ul className="mt-3 flex min-w-0 flex-col gap-2">
          {items.map((c) => (
            <CorrectionCard
              key={c.id}
              correction={c}
              index={1}
              total={1}
              showCounter={false}
              busy={busyId === c.id}
              highlighted={highlightId === c.id}
              onAccept={onAccept}
              onReject={onReject}
            />
          ))}
        </ul>
      </div>
    )
  }

  return (
    <Sheet open={open} title={LATER_COPY.title} onClose={onClose} dismissible={dismissible}>
      {body}
    </Sheet>
  )
}
