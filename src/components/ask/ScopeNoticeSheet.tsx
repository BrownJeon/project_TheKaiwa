'use client'

/**
 * 보내는 범위 시트(task-064 §25-5 I — 승인 데모 v2 C, 문구 = Leader L-5 「데모 문구 그대로」).
 * `first` = 첫 질문을 보내기 전 한 번([알겠어요, 보내기][취소]) · `again` = 메뉴·링크에서 다시 보기([닫기]).
 * 시트는 문구만 그린다 — 키 저장은 부르는 쪽이 `useScopeNoticeGate().ack()` 로. 음성 줄은 2단계(키 v2 와 함께).
 */
import { useId } from 'react'
import Sheet from '@/components/common/Sheet'
import { Btn, BtnRow } from '@/components/common/ui'
import { ASK_COPY } from './askCopy'

export type ScopeNoticeMode = 'first' | 'again'

const C = ASK_COPY.scope
const ROW = 'grid grid-cols-[18px_minmax(0,1fr)] items-start gap-1.5'

export function ScopeNoticeBody({
  mode,
  leadId,
  onConfirm,
  onClose,
}: {
  mode: ScopeNoticeMode
  leadId: string
  onConfirm?: () => void
  onClose: () => void
}) {
  return (
    <div className="flex flex-col gap-2.5 text-[14px]">
      <p id={leadId}>
        {C.leadHead}
        <b className="font-bold">{C.leadBold}</b>
        {C.leadTail}
      </p>
      <p className="mt-0.5 text-[13px] font-bold">{C.sendHead}</p>
      <ul className="flex flex-col gap-1.5">
        {C.send.map((t) => (
          <li key={t} className={ROW}>
            <span aria-hidden="true" className="text-center font-bold text-ink">✓</span>
            <span className="min-w-0">{t}</span>
          </li>
        ))}
      </ul>
      <p className="mt-0.5 text-[13px] font-bold">{C.noSendHead}</p>
      <ul className="flex flex-col gap-1.5">
        {C.noSend.map((t) => (
          <li key={t} className={ROW}>
            <span aria-hidden="true" className="text-center font-bold text-bad">×</span>
            <span className="min-w-0">{t}</span>
          </li>
        ))}
      </ul>
      <p className="text-[12.5px] text-ink2">
        {C.note}
        {mode === 'first' ? C.noteFirstTail : null}
      </p>
      {mode === 'first' ? (
        <BtnRow>
          <Btn onClick={onConfirm}>{C.ok}</Btn>
          <Btn variant="ghost" onClick={onClose}>
            {C.cancel}
          </Btn>
        </BtnRow>
      ) : (
        <Btn className="mt-3 w-full" onClick={onClose}>
          {C.close}
        </Btn>
      )}
    </div>
  )
}

/** `first` 의 [취소]·배경·Esc·✕ = `onClose`(보내지 않음). `again` 은 `onConfirm` 을 쓰지 않는다. */
export default function ScopeNoticeSheet({
  open,
  mode,
  onConfirm,
  onClose,
}: {
  open: boolean
  mode: ScopeNoticeMode
  onConfirm?: () => void
  onClose: () => void
}) {
  const leadId = useId()
  return (
    <Sheet open={open} title={C.title} onClose={onClose} describedBy={leadId}>
      <ScopeNoticeBody mode={mode} leadId={leadId} onConfirm={onConfirm} onClose={onClose} />
    </Sheet>
  )
}
