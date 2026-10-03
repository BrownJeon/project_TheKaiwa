'use client'

/**
 * 기록 메뉴(⋯)와 지우기 확인(데모 `menuSheet`·`confirmSheet`). 하루 상세 시트 위에 한 겹 더 뜬다.
 *
 * 지우기는 되돌릴 수 없어서 확인 시트가 열리면 초점을 [취소]에 먼저 둔다(데모). 공용 `Sheet` 는 열릴 때 제목에 초점을 주므로
 * 그 뒤 한 틱 늦게 옮긴다. 지우는 중에는 두 버튼이 멈추고 바깥·Esc 로 닫히지 않는다(`dismissible=false`).
 */
import { useEffect, useRef } from 'react'
import Sheet from '@/components/common/Sheet'
import type { StudyLogItem } from '@/types/plan'
import { Chip, IconOpen, IconTrash, Spinner } from './parts'
import { dayLabel, DELETE_MAIN, displaySummary, linkState, timeLabel, TYPE_META } from './logic'

export function LogMenuSheet({
  log,
  onClose,
  onOpenSource,
  onDelete,
}: {
  log: StudyLogItem | null
  onClose: () => void
  onOpenSource: (log: StudyLogItem) => void
  onDelete: (log: StudyLogItem) => void
}) {
  const meta = log ? TYPE_META[log.type] : null
  const state = log ? linkState(log) : 'none'
  return (
    <Sheet open={log !== null} title={log && meta ? `${meta.label} · ${timeLabel(log.createdAt)}` : ''} onClose={onClose}>
      {log && meta ? (
        <ul className="-mx-2 mb-1">
          {state === 'open' ? (
            <li>
              <button type="button" onClick={() => onOpenSource(log)} className="flex min-h-[52px] w-full items-center gap-3 rounded-xl px-2 text-left text-[15px] text-ink">
                <IconOpen />
                <span>{meta.dest} 보기</span>
              </button>
            </li>
          ) : state === 'gone' ? (
            <li>
              <div className="flex min-h-[52px] w-full items-center gap-3 px-2 text-[15px] text-ink2">
                <IconOpen />
                <span>{meta.dest} 보기</span>
                <span className="ml-auto text-[12px]">원본이 삭제됐어요</span>
              </div>
            </li>
          ) : null}
          <li>
            <button type="button" onClick={() => onDelete(log)} className="flex min-h-[52px] w-full items-center gap-3 rounded-xl px-2 text-left text-[15px] font-semibold text-bad">
              <IconTrash />
              <span>이 기록 지우기</span>
            </button>
          </li>
        </ul>
      ) : null}
    </Sheet>
  )
}

export type DeleteState = 'idle' | 'busy' | 'fail'

export function DeleteConfirmSheet({
  log,
  detail,
  state,
  onCancel,
  onConfirm,
}: {
  log: StudyLogItem | null
  /** `deleteDetail()` — 원본은 남는다는 줄 + (그날 마지막 기록이면) 공부 일수 안내 + 되돌릴 수 없음. */
  detail: string
  state: DeleteState
  onCancel: () => void
  onConfirm: () => void
}) {
  const busy = state === 'busy'
  return (
    <Sheet open={log !== null} title="이 기록을 지울까요?" onClose={onCancel} dismissible={!busy}>
      {log ? <ConfirmBody log={log} detail={detail} state={state} onCancel={onCancel} onConfirm={onConfirm} /> : null}
    </Sheet>
  )
}

function ConfirmBody({ log, detail, state, onCancel, onConfirm }: { log: StudyLogItem; detail: string; state: DeleteState; onCancel: () => void; onConfirm: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const busy = state === 'busy'
  const meta = TYPE_META[log.type]

  useEffect(() => {
    const t = setTimeout(() => cancelRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl bg-surface2 px-3 py-2.5">
        <Chip mark={{ kind: 'type', type: log.type }} size="lg" soft />
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[12px] text-ink2">
            {meta.label} · {dayLabel(log.date)} {timeLabel(log.createdAt)}
          </span>
          <span className="text-[14.5px] leading-[1.45] break-keep [overflow-wrap:anywhere]">{displaySummary(log)}</span>
        </span>
      </div>
      <p className="mt-3.5 text-[15px] font-semibold break-keep">{DELETE_MAIN}</p>
      <p className="mt-1 text-[13px] text-ink2 break-keep">{detail}</p>
      {state === 'fail' ? (
        <div role="alert" className="mt-3 rounded-xl bg-bad-soft px-3.5 py-3 text-[13px] text-bad break-keep">
          <b className="font-bold">기록을 지우지 못했어요.</b> 인터넷 연결을 확인하고 다시 시도해 주세요.
        </div>
      ) : null}
      <div className="mt-4 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
        <button
          ref={cancelRef}
          type="button"
          aria-disabled={busy || undefined}
          onClick={() => {
            if (!busy) onCancel()
          }}
          className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold aria-disabled:opacity-45"
        >
          취소
        </button>
        <button
          type="button"
          aria-disabled={busy || undefined}
          aria-busy={busy || undefined}
          onClick={() => {
            if (!busy) onConfirm()
          }}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-bad px-4 text-[15px] font-semibold text-surface aria-busy:opacity-80"
        >
          {busy ? (
            <>
              <Spinner />
              지우는 중…
            </>
          ) : state === 'fail' ? (
            '다시 시도'
          ) : (
            '지우기'
          )}
        </button>
      </div>
    </>
  )
}
