/**
 * 음성 인식 화면 문구(docs/screens.md §8-8) — 마이크 테스트와 task-007 회화방이 같이 쓴다.
 * 엔진명·서버 주소·경로 이름을 싣지 않는다. 서버가 보낸 message 원문은 쓰지 않는다(코드만 → 이 표).
 */
import type { SttErrorCode, SttKind } from '@/modules/speech/stt/client'

export interface SttErrorCopy {
  title: string
  action: string
  /** 마운트 판정이면 버튼을 막는 종류. */
  blocking: boolean
}

export function sttErrorCopy(code: SttErrorCode, opts: { native: boolean; retryAfterSec?: number | null; mountCheck?: boolean } = { native: false }): SttErrorCopy {
  switch (code) {
    case 'INSECURE':
      return { title: '이 주소에서는 마이크를 쓸 수 없어요.', action: 'https:// 로 시작하는 주소로 열어 주세요.', blocking: true }
    case 'UNSUPPORTED':
      return { title: '이 브라우저에서는 음성 인식을 쓸 수 없어요.', action: '최신 Chrome 으로 열어 주세요.', blocking: true }
    case 'MIC_DENIED':
      return {
        title: '마이크 사용이 막혀 있어요.',
        action: opts.native
          ? '휴대폰 설정 → 애플리케이션 → 일본어교육 → 권한 → 마이크 → 허용으로 바꿔 주세요.'
          : '주소창 왼쪽 아이콘(사이트 정보) → 권한 → 마이크 → 허용으로 바꾼 뒤 다시 눌러 주세요.',
        blocking: false,
      }
    case 'MIC_NOT_FOUND':
      return { title: '마이크를 찾지 못했어요.', action: '마이크나 이어폰이 연결되어 있는지 확인해 주세요.', blocking: false }
    case 'MIC_BUSY':
      return { title: '다른 앱이 마이크를 쓰고 있어요.', action: '통화·녹음 앱을 닫고 다시 눌러 주세요.', blocking: false }
    case 'OFFLINE':
      return { title: '인터넷에 연결되어 있지 않아요.', action: '연결되면 바로 쓸 수 있어요.', blocking: true }
    case 'SERVER_UNAVAILABLE':
      return { title: '음성 인식 서버가 준비 중이에요.', action: '잠시 후 다시 시도해 주세요.', blocking: !!opts.mountCheck }
    case 'CONNECT_FAILED':
      return { title: '음성 인식 서버에 연결하지 못했어요.', action: '잠시 후 다시 눌러 주세요.', blocking: false }
    case 'CONNECTION_LOST':
      return { title: '연결이 끊겨 방금 한 말을 놓쳤어요.', action: '다시 눌러 말해 주세요.', blocking: false }
    case 'TICKET':
      return { title: '연결 준비에 실패했어요.', action: '화면을 새로 고친 뒤 다시 눌러 주세요.', blocking: false }
    case 'REPLACED':
      return { title: '다른 창에서 음성 인식을 시작해 이 창의 연결을 닫았어요.', action: '다시 누르면 이 창에서 쓸 수 있어요.', blocking: false }
    case 'BUSY':
      return { title: '지금은 음성 인식을 쓰기 어려워요.', action: opts.retryAfterSec ? `${opts.retryAfterSec}초 뒤에 다시 눌러 주세요.` : '잠시 후 다시 눌러 주세요.', blocking: false }
    case 'ENGINE_ERROR':
      return { title: '알아듣다가 문제가 생겼어요.', action: '다시 눌러 말해 주세요.', blocking: false }
    case 'TIMEOUT':
      return { title: '결과가 너무 늦어지고 있어요.', action: '다시 눌러 말해 주세요.', blocking: false }
  }
}

export type SttHint = 'SHORT_PRESS' | 'PERMISSION_GRANTED' | 'EMPTY_RESULT' | 'AUTO_STOPPED' | 'TOO_QUIET' | 'INTERRUPTED'

export const STT_HINT_COPY: Record<SttHint, string> = {
  SHORT_PRESS: '버튼을 누른 채로 말하고, 다 말하면 손을 떼세요.',
  PERMISSION_GRANTED: '마이크를 허용했어요. 이제 버튼을 누른 채로 말해 보세요.',
  EMPTY_RESULT: '말소리를 알아듣지 못했어요. 조금 더 크고 또렷하게 말해 보세요.',
  AUTO_STOPPED: '30초가 지나 자동으로 멈췄어요.',
  TOO_QUIET: '소리가 거의 들리지 않아요. 마이크 가까이에서 말해 보세요.',
  INTERRUPTED: '녹음이 중간에 멈췄어요. 다시 눌러 주세요.',
}

export const STT_STATUS_COPY = {
  idle: '누르고 있는 동안 말해요',
  idleAfterResult: '다시 해 보려면 또 누르고 말해요',
  askPermission: '마이크 사용을 허용해 주세요',
  finishing: '알아듣는 중…',
  unavailable: '지금은 쓸 수 없어요',
  slowConnect: '연결하는 중… 계속 말해도 돼요',
} as const

export function recordingStatus(elapsedSec: number): string {
  const m = Math.floor(elapsedSec / 60)
  const s = String(elapsedSec % 60).padStart(2, '0')
  return `듣고 있어요 · ${m}:${s} — 손을 떼면 끝나요`
}

export const MIC_TEST_COPY = {
  title: '마이크 테스트',
  desc: '버튼을 누른 채로 일본어로 말해 보세요. 알아들은 말이 바로 보여요.',
  placeholderLead: '여기에 알아들은 말이 나와요 · 예) ',
  placeholderJa: 'こんにちは',
  buttonLabel: '누르고 있는 동안 말하기',
  announcePrefix: '알아들은 말: ',
  /** Leader M1 — 점검 발화는 gateway 가 저장하지 않는다(MIC_TEST 티켓). */
  storage: '점검용이라 목소리와 알아들은 말을 저장하지 않아요.',
} as const

export function pathCaption(kind: SttKind): string {
  return kind === 'ONDEVICE' ? '지금은 휴대폰에서 바로 알아들어요.' : '지금은 서버에서 알아들어요.'
}
