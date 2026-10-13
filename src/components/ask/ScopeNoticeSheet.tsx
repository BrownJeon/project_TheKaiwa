'use client'

/**
 * 보내는 범위 시트 — **정보용 하나**(task-066 §26-8 C, D2 A). 확인 단추·확인 저장 없이 [닫기]만 있다(사용자 요청 「알림창 컨펌 없이 바로」).
 * 문구 = 승인 데모 v2 `scopeSheet()` 원문(동의 문구라 바꾸지 않는다 — Leader L-5). 열기: 범위 줄 · ⋯ 「보내는 범위 보기」.
 */
import { useId } from 'react'
import Sheet from '@/components/common/Sheet'
import { Btn } from '@/components/common/ui'
import { ASK_COPY } from './askCopy'
import { AskMicIcon } from './AskGreeting'

const C = ASK_COPY.scope
const ROW = 'grid grid-cols-[18px_minmax(0,1fr)] items-start gap-1.5'

export function ScopeNoticeBody({ leadId, onClose }: { leadId: string; onClose: () => void }) {
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
        {C.noSend.map((t, i) =>
          i === C.voiceIndex ? (
            <li key={t} className={`${ROW} -mx-1 rounded-lg bg-accent-soft px-1`}>
              <span aria-hidden="true" className="text-center font-bold text-bad">×</span>
              <span className="min-w-0">
                <b className="font-bold">{C.voiceBold}</b>
                {t.slice(C.voiceBold.length)}
              </span>
            </li>
          ) : (
            <li key={t} className={ROW}>
              <span aria-hidden="true" className="text-center font-bold text-bad">×</span>
              <span className="min-w-0">{t}</span>
            </li>
          ),
        )}
      </ul>
      <div className="grid grid-cols-[22px_minmax(0,1fr)] gap-x-2 gap-y-1 rounded-xl bg-surface2 px-3 py-2.5 text-[13px]">
        <span aria-hidden="true" className="grid h-5 place-items-center text-ink2">
          <AskMicIcon size={14} />
        </span>
        <span className="min-w-0">
          <b className="font-bold">{C.voiceBandBold}</b>
          {C.voiceBandTail}
        </span>
      </div>
      <p className="text-[12.5px] text-ink2">{C.note}</p>
      <Btn className="mt-3 w-full" onClick={onClose}>
        {C.close}
      </Btn>
    </div>
  )
}

/** 배경·Esc·✕·[닫기] = `onClose`. 보내기와 아무 관계가 없다(질문 전송의 관문이 아니다 — §26-13 ①). */
export default function ScopeNoticeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const leadId = useId()
  return (
    <Sheet open={open} title={C.title} onClose={onClose} describedBy={leadId}>
      <ScopeNoticeBody leadId={leadId} onClose={onClose} />
    </Sheet>
  )
}
