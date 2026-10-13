'use client'

/**
 * 보내지 못한 말(screens §9-2 G ②) — 음성 모드엔 되돌릴 입력창이 없으므로 인식한 문장을 여기 남긴다.
 * [다시 보내기](같은 발화 id) · [글자로 고치기] · ✕ 버리기. 429 면 다시 보내기가 남은 초 동안 막힌다. 400 은 다시 보내기 없음.
 */
import { useCountdown } from '@/components/common/useNow'
import { unsentText, UNSENT_BUTTONS, type UnsentReason } from './talkCopy'

export interface UnsentView {
  text: string
  reason: UnsentReason
  serverMessage?: string | null
}

export default function UnsentBar({
  unsent,
  blockedUntil,
  onResend,
  onEdit,
  onDiscard,
  textOf,
  canResend: canResendProp,
}: {
  unsent: UnsentView
  blockedUntil: number | null
  onResend: () => void
  onEdit: () => void
  onDiscard: () => void
  /** 문구를 화면이 고른다(질문 탭 `askUnsentText`, task-066 §26-7 G). `retrySec` = 429 남은 초. 없으면 회화 `unsentText`. */
  textOf?: (reason: UnsentReason, opts: { retrySec: number | null; serverMessage?: string | null }) => string
  /** [다시 보내기]를 둘지(질문 하루 한도 = false). 없으면 회화 규칙(400 만 없음). */
  canResend?: boolean
}) {
  const remaining = useCountdown(unsent.reason === 429 ? blockedUntil : null)
  const waiting = unsent.reason === 429 && remaining !== 0
  const canResend = canResendProp ?? unsent.reason !== 400
  const opts = { retrySec: remaining, serverMessage: unsent.serverMessage }
  return (
    <div role="alert" className="min-w-0 rounded-xl border border-line bg-surface p-3">
      <div className="flex min-w-0 items-start gap-1">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-ink2 break-keep">{textOf ? textOf(unsent.reason, opts) : unsentText(unsent.reason, opts)}</p>
          <p lang="ja" className="mt-1 line-clamp-2 text-[15px] text-ink [overflow-wrap:anywhere]">
            「{unsent.text}」
          </p>
        </div>
        <button type="button" aria-label={UNSENT_BUTTONS.discardLabel} onClick={onDiscard} className="-mr-1 -mt-1 grid h-11 w-11 flex-none place-items-center text-ink2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="mt-2 flex min-w-0 gap-2 [&>*]:min-w-0 [&>*]:flex-1">
        {canResend ? (
          <button
            type="button"
            aria-disabled={waiting || undefined}
            onClick={() => {
              if (!waiting) onResend()
            }}
            className={`h-11 truncate rounded-xl bg-accent px-3 text-[14px] font-semibold text-on-accent ${waiting ? 'opacity-40' : ''}`}
          >
            {waiting && remaining ? UNSENT_BUTTONS.resendIn(remaining) : UNSENT_BUTTONS.resend}
          </button>
        ) : null}
        <button type="button" onClick={onEdit} className="h-11 truncate rounded-xl border border-line bg-surface px-3 text-[14px] font-semibold text-ink">
          {UNSENT_BUTTONS.edit}
        </button>
      </div>
    </div>
  )
}
