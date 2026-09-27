'use client'

/**
 * 음성 인식 오류 띠(screens §9-2 G ①) — §8-8 ⓐ 문구 그대로(1줄 무엇 + 2줄 어떻게). 막힘 계열·권한 거부·연결 실패엔 [글자로 대화하기],
 * 막힘이 아닌 것엔 ✕. 대화는 막히지 않는다(텍스트 폴백은 한 번의 탭 거리).
 */
import type { SttErrorCode } from '@/modules/speech/stt/client'
import { sttErrorCopy } from '@/components/speech/sttCopy'
import { TALK_ROOM } from './talkCopy'

const TEXT_OFFER: ReadonlySet<SttErrorCode> = new Set(['INSECURE', 'UNSUPPORTED', 'OFFLINE', 'SERVER_UNAVAILABLE', 'MIC_DENIED', 'CONNECT_FAILED'])

export default function SttAlert({
  code,
  retryAfterSec,
  mountCheck,
  native,
  textMode,
  onTextMode,
  onClose,
}: {
  code: SttErrorCode
  retryAfterSec?: number
  mountCheck?: boolean
  native: boolean
  /** 이미 글자 모드면 [글자로 대화하기]를 두지 않는다 */
  textMode: boolean
  onTextMode: () => void
  onClose: () => void
}) {
  const copy = sttErrorCopy(code, { native, retryAfterSec, mountCheck })
  const offerText = !textMode && TEXT_OFFER.has(code)
  return (
    <div role="alert" className="flex min-w-0 items-start gap-1 rounded-xl bg-bad-soft pl-3.5 text-[13px] text-bad break-keep">
      <div className="min-w-0 flex-1 py-2.5">
        <p className="font-semibold">{copy.title}</p>
        <p className="mt-0.5">{copy.action}</p>
        {offerText ? (
          <button type="button" onClick={onTextMode} className="inline-flex h-11 items-center font-semibold underline underline-offset-4">
            {TALK_ROOM.textInstead}
          </button>
        ) : null}
      </div>
      {!copy.blocking || textMode ? (
        <button type="button" aria-label={TALK_ROOM.closeAlert} onClick={onClose} className="grid h-11 w-11 flex-none place-items-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}
