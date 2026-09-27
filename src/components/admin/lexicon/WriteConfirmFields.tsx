'use client'

/**
 * 쓰기 확인 칸(항목 저장·끄기·켜기·가져오기·되돌리기 공용, screens.md §10-2 F): 변경 이유(필수) + 빠른 이유 칩 + (PRODUCTION) 확인 문구.
 * 빠른 이유: 칸이 비었으면 그 글로, 이미 글이 있으면 뒤에 " · {t}".
 */
import { useId } from 'react'
import { cpLength } from '@/components/common/format'
import { LEXICON_LIMITS, LEXICON_PRODUCTION_CONFIRM } from '@/types/lexicon'
import { autoGrow } from './autoGrow'
import { CONFIRM_ID, REASON_ID } from './focus'
import { FIELD_ERROR, INPUT, LABEL, TEXTAREA } from './lexiconStyles'

export function appendReason(current: string, quick: string): string {
  const t = current.trim()
  return t ? `${t} · ${quick}` : quick
}

export default function WriteConfirmFields({
  reason,
  onReason,
  confirm,
  onConfirm,
  needsConfirm,
  quick,
  errors,
}: {
  reason: string
  onReason: (v: string) => void
  confirm: string
  onConfirm: (v: string) => void
  needsConfirm: boolean
  quick: readonly string[]
  errors: { reason?: string; confirm?: string }
}) {
  const uid = useId()
  const reasonErrId = `${uid}-reason-err`
  const confirmErrId = `${uid}-confirm-err`
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={REASON_ID} className={LABEL}>
          변경 이유<span aria-hidden="true">*</span>
        </label>
        <span className="text-[12px] tabular-nums text-ink2">
          {cpLength(reason)}/{LEXICON_LIMITS.reasonMax}
        </span>
      </div>
      <textarea
        id={REASON_ID}
        rows={2}
        value={reason}
        aria-required="true"
        aria-invalid={errors.reason ? true : undefined}
        aria-describedby={errors.reason ? reasonErrId : undefined}
        placeholder="예: 日本橋 가 ニッポンバシ 로 읽혀서"
        onChange={(e) => {
          onReason(e.target.value)
          autoGrow(e.currentTarget, 5)
        }}
        className={`${TEXTAREA} mt-1.5`}
      />
      {errors.reason ? (
        <p id={reasonErrId} className={FIELD_ERROR}>
          {errors.reason}
        </p>
      ) : null}
      <div role="group" aria-label="빠른 이유" className="no-scrollbar -mx-4 mt-1.5 flex gap-1.5 overflow-x-auto px-4 py-1">
        {quick.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onReason(appendReason(reason, t))}
            className="h-11 flex-none rounded-full border border-line bg-surface px-3 text-[13px] text-ink"
          >
            {t}
          </button>
        ))}
      </div>
      {needsConfirm ? (
        <div className="mt-3 rounded-xl border border-bad bg-surface p-3">
          <p className="text-[13px] font-semibold text-bad">운영 환경(PRODUCTION) 사전을 바꿔요</p>
          <p className="mt-0.5 text-[13px] text-ink break-keep">
            모든 학습자의 선생님 목소리 읽기가 바뀌어요. 확인하려면 아래에 PRODUCTION 을 그대로 입력해 주세요.
          </p>
          <input
            id={CONFIRM_ID}
            aria-label="확인 문구"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder={LEXICON_PRODUCTION_CONFIRM}
            value={confirm}
            aria-invalid={errors.confirm ? true : undefined}
            aria-describedby={errors.confirm ? confirmErrId : undefined}
            onChange={(e) => onConfirm(e.target.value)}
            className={`${INPUT} mt-2 font-mono`}
          />
          {errors.confirm ? (
            <p id={confirmErrId} className={FIELD_ERROR}>
              {errors.confirm}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
