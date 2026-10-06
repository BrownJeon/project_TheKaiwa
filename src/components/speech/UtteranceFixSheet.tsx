'use client'

/**
 * 직접 고치기 시트(task-012b-2 가이드 §2-B, R9) — 공용 `Sheet`(포털·제목 초점·닫을 때 초점 복귀·Esc). 입력칸엔 루비·한글 줄을 달지 않는다.
 * 보내기 규칙(`fixChoice`): 빈칸·1,000자 초과는 요청 없이 안내, 처음 들린 글·다시 들어 본 글과 같으면 그 출처로, 그 밖은 USER.
 * 입력칸이 키보드에 가리지 않게 초점 때 `scrollIntoView({block:'nearest'})`(AcceptCorrectionSheet 와 같은 조건).
 */
import { useId, useState } from 'react'
import { cpLength } from '@/components/common/format'
import Sheet from '@/components/common/Sheet'
import { Btn, BtnRow } from '@/components/common/ui'
import type { UtteranceResolveBody } from '@/types/speech'
import { FIX_COPY } from './utteranceCopy'
import { FIX_TEXT_MAX, fixChoice } from './utteranceReview'

export default function UtteranceFixSheet({
  open,
  realtimeText,
  analysisText,
  saving,
  err,
  onSubmit,
  onClose,
}: {
  open: boolean
  realtimeText: string
  analysisText: string | null
  saving: boolean
  /** 서버 실패(재시도 가능) 안내 — 카드가 넘긴다. */
  err: string | null
  onSubmit: (body: UtteranceResolveBody) => void
  onClose: () => void
}) {
  return (
    <Sheet open={open} title={FIX_COPY.title} dismissible={!saving} onClose={onClose}>
      {open ? <FixForm realtimeText={realtimeText} analysisText={analysisText} saving={saving} err={err} onSubmit={onSubmit} onClose={onClose} /> : null}
    </Sheet>
  )
}

function FixForm({
  realtimeText,
  analysisText,
  saving,
  err,
  onSubmit,
  onClose,
}: {
  realtimeText: string
  analysisText: string | null
  saving: boolean
  err: string | null
  onSubmit: (body: UtteranceResolveBody) => void
  onClose: () => void
}) {
  const tid = useId()
  const [text, setText] = useState(realtimeText)
  const [localErr, setLocalErr] = useState<string | null>(null)
  const shown = localErr ?? err
  const n = cpLength(text.trim())

  const send = () => {
    if (saving) return
    const r = fixChoice(text, realtimeText, analysisText)
    if (!r.ok) {
      setLocalErr(r.error === 'empty' ? FIX_COPY.empty : FIX_COPY.tooLong)
      return
    }
    setLocalErr(null)
    onSubmit(r.body)
  }

  return (
    <div className="pb-1">
      <p className="text-[13px] text-ink2 break-keep">{FIX_COPY.intro}</p>
      <label htmlFor={tid} className="mt-3 block text-[13px] font-semibold">
        {FIX_COPY.label}
      </label>
      <textarea
        id={tid}
        lang="ja"
        rows={3}
        maxLength={FIX_TEXT_MAX}
        enterKeyHint="done"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          if (localErr) setLocalErr(null)
        }}
        aria-invalid={!!shown || undefined}
        aria-describedby={`${tid}-count${shown ? ` ${tid}-err` : ''}`}
        onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'nearest' })}
        className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[16px] leading-[1.6] text-ink"
      />
      <p id={`${tid}-count`} className={`mt-1 text-right text-[12px] tabular-nums ${n > FIX_TEXT_MAX ? 'text-bad' : 'text-ink2'}`}>
        {FIX_COPY.count(n)}
      </p>
      {shown ? (
        <p id={`${tid}-err`} role="alert" className="text-[12.5px] text-bad break-keep">
          {shown}
        </p>
      ) : null}
      <BtnRow>
        <Btn aria-busy={saving || undefined} aria-disabled={saving || undefined} onClick={send}>
          {saving ? FIX_COPY.saving : FIX_COPY.save}
        </Btn>
        <Btn variant="ghost" aria-disabled={saving || undefined} onClick={() => !saving && onClose()}>
          {FIX_COPY.cancel}
        </Btn>
      </BtnRow>
    </div>
  )
}
