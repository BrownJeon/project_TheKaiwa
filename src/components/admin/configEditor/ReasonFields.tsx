'use client'

/**
 * 변경 이유(필수) + 빠른 이유 칩 + (운영) PRODUCTION 입력 — 적용·되돌리기·비밀 참조·켜기/끄기 확인 창 공용(데모 v2 `reasonFields`).
 * 이유 규칙(Codex C1 CX-3): 1~200자(운영 10~200자) · 줄바꿈은 띄어쓰기로 저장 · 비밀처럼 보이는 글자는 서버가 거절(422, 원문 미반환).
 * 이 칸의 글은 상태에만 있고 저장소·로그에 남기지 않는다.
 */
import { useId } from 'react'
import { reasonLength, REASON_MAX, REASON_MIN_PRODUCTION, PRODUCTION_CONFIRM } from './flow'
import { FIELD_ERROR, FIELD_HELP, INPUT, LABEL, TEXTAREA } from './ui'

export const QUICK_REASONS_APPLY = ['응답이 느려서', '오류가 나서', '시험해 보려고', '원래대로 되돌림'] as const

export function appendReason(current: string, quick: string): string {
  const t = current.trim()
  return t ? `${t} · ${quick}` : quick
}

export default function ReasonFields({
  reason,
  onReason,
  reasonError,
  production,
  needsConfirm,
  confirm,
  onConfirm,
  confirmError,
  quick = QUICK_REASONS_APPLY,
  confirmTitle = '운영 환경(PRODUCTION) 설정을 바꿔요',
}: {
  reason: string
  onReason: (v: string) => void
  reasonError: string | null
  production: boolean
  needsConfirm: boolean
  confirm: string
  onConfirm: (v: string) => void
  confirmError: string | null
  quick?: readonly string[]
  confirmTitle?: string
}) {
  const uid = useId()
  const reasonId = `${uid}-reason`
  const confirmId = `${uid}-confirm`
  return (
    <div className="mt-4 min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={reasonId} className={LABEL}>
          변경 이유<span aria-hidden="true">*</span>
        </label>
        <span className="text-[12px] tabular-nums text-ink2">
          {reasonLength(reason)}/{REASON_MAX}
        </span>
      </div>
      <textarea
        id={reasonId}
        rows={2}
        value={reason}
        aria-required="true"
        aria-invalid={reasonError ? true : undefined}
        aria-describedby={reasonError ? `${reasonId}-e` : undefined}
        placeholder="예: 응답이 느려서 제한 시간을 늘림"
        onChange={(e) => onReason(e.target.value)}
        className={`${TEXTAREA} mt-1.5`}
      />
      {reasonError ? (
        <p id={`${reasonId}-e`} className={FIELD_ERROR}>
          {reasonError}
        </p>
      ) : (
        <p className={FIELD_HELP}>
          {production ? `${REASON_MIN_PRODUCTION}~${REASON_MAX}자` : `1~${REASON_MAX}자`} · 줄바꿈은 띄어쓰기로 저장돼요 · 키·토큰 같은 비밀은 적지 마세요(감사 기록에 남아요)
        </p>
      )}
      <div role="group" aria-label="빠른 이유" className="no-scrollbar -mx-4 mt-1.5 flex gap-1.5 overflow-x-auto px-4 py-1">
        {quick.map((t) => (
          <button key={t} type="button" onClick={() => onReason(appendReason(reason, t))} className="h-11 flex-none rounded-full border border-line bg-surface px-3 text-[13px] text-ink">
            {t}
          </button>
        ))}
      </div>
      {needsConfirm ? (
        <div className="mt-3 rounded-xl border border-bad bg-surface p-3">
          <p className="text-[13px] font-semibold text-bad">{confirmTitle}</p>
          <p className="mt-0.5 text-[13px] text-ink break-keep">
            확인하려면 아래에 <b className="font-mono">{PRODUCTION_CONFIRM}</b> 을 그대로 입력해 주세요.
          </p>
          <input
            id={confirmId}
            aria-label="확인 문구"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder={PRODUCTION_CONFIRM}
            value={confirm}
            aria-invalid={confirmError ? true : undefined}
            aria-describedby={confirmError ? `${confirmId}-e` : undefined}
            onChange={(e) => onConfirm(e.target.value)}
            className={`${INPUT} mt-2 font-mono`}
          />
          {confirmError ? (
            <p id={`${confirmId}-e`} className={FIELD_ERROR}>
              {confirmError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
