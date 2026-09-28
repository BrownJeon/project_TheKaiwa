'use client'

/**
 * 음성 인식 오류 띠(screens §9-2 G ①) — §8-8 ⓐ 문구 그대로(1줄 무엇 + 2줄 어떻게). 막힘 계열·권한 거부·연결 실패엔 [글자로 대화하기],
 * 막힘이 아닌 것엔 ✕. 대화는 막히지 않는다(텍스트 폴백은 한 번의 탭 거리).
 */
import Link from 'next/link'
import type { SttErrorCode } from '@/modules/speech/stt/client'
import { openAppSettings } from '@/modules/infra/native'
import { useCanOpenAppSettings } from '@/components/common/useNativeEnv'
import { OPEN_APP_SETTINGS, sttErrorCopy } from '@/components/speech/sttCopy'
import { TALK_ROOM } from './talkCopy'

const TEXT_OFFER: ReadonlySet<SttErrorCode> = new Set(['INSECURE', 'UNSUPPORTED', 'OFFLINE', 'SERVER_UNAVAILABLE', 'MIC_DENIED', 'CONNECT_FAILED', 'MODEL_REQUIRED'])

/**
 * task-003f(screens §11-2 D·F): 앱 권한 영구 거절이면 [앱 설정 열기](플러그인 v1.1), 오프라인 방식 + 파일 없음(MODEL_REQUIRED)이면
 * [설정 열기](→ 휴대폰에서 알아듣기 카드). ENGINE_ERROR 2줄은 전환(`switched`)·오프라인 방식(`offlineMode`)에 따라 바뀐다.
 */
export default function SttAlert({
  code,
  retryAfterSec,
  mountCheck,
  switched,
  offlineMode,
  native,
  textMode,
  onTextMode,
  onClose,
  textModeLabel,
}: {
  code: SttErrorCode
  retryAfterSec?: number
  mountCheck?: boolean
  switched?: boolean
  offlineMode?: boolean
  native: boolean
  /** 이미 글자 모드면 [글자로 대화하기]를 두지 않는다 */
  textMode: boolean
  onTextMode: () => void
  onClose: () => void
  /** [글자로 대화하기] 문구(기본) — 오늘의 회화 말하기는 "글자로 답하기"(screens §12-5). */
  textModeLabel?: string
}) {
  const canSettings = useCanOpenAppSettings()
  const copy = sttErrorCopy(code, { native, retryAfterSec, mountCheck, switched, offlineMode, canOpenSettings: canSettings, place: 'talk' })
  const offerText = !textMode && (TEXT_OFFER.has(code) || (code === 'ENGINE_ERROR' && !!offlineMode))
  return (
    <div role="alert" className="flex min-w-0 items-start gap-1 rounded-xl bg-bad-soft pl-3.5 text-[13px] text-bad break-keep">
      <div className="min-w-0 flex-1 py-2.5">
        <p className="font-semibold">{copy.title}</p>
        <p className="mt-0.5">{copy.action}</p>
        {native && canSettings && code === 'MIC_DENIED' ? (
          <button type="button" onClick={() => void openAppSettings()} className="mr-4 inline-flex h-11 items-center font-semibold underline underline-offset-4">
            {OPEN_APP_SETTINGS}
          </button>
        ) : null}
        {code === 'MODEL_REQUIRED' ? (
          <Link href="/settings#ondevice-card" className="mr-4 inline-flex h-11 items-center font-semibold underline underline-offset-4">
            {TALK_ROOM.openSettings}
          </Link>
        ) : null}
        {offerText ? (
          <button type="button" onClick={onTextMode} className="inline-flex h-11 items-center font-semibold underline underline-offset-4">
            {textModeLabel ?? TALK_ROOM.textInstead}
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
