/**
 * 음성 인식 화면 문구(docs/screens.md §8-8) — 마이크 테스트와 task-007 회화방이 같이 쓴다.
 * 엔진명·서버 주소·경로 이름을 싣지 않는다. 서버가 보낸 message 원문은 쓰지 않는다(코드만 → 이 표).
 */
import type { SttErrorCode, SttRoute } from '@/modules/speech/stt/client'

/**
 * 안드로이드 설정에 보이는 앱 이름 = 런처 라벨(`strings.xml app_name`)과 같아야 한다(task-003f Leader ⑤ — "TheKaiwa").
 * 이름을 바꾸면 이 상수와 developer A 의 `app_name` 을 함께 바꾼다.
 */
export const APP_LABEL = 'TheKaiwa'

export interface SttErrorCopy {
  title: string
  action: string
  /** 마운트 판정이면 버튼을 막는 종류. */
  blocking: boolean
}

export interface SttErrorCopyOpts {
  native: boolean
  retryAfterSec?: number | null
  mountCheck?: boolean
  /** 이 오류로 휴대폰 → 서버 전환이 일어났다(§11-8 ⓕ). */
  switched?: boolean
  /** 오프라인 방식이라 서버로 바꾸지 않는다. */
  offlineMode?: boolean
  /** [앱 설정 열기] 버튼이 있다(플러그인 v1.1 `openAppSettings`). 없으면 경로형 문구. */
  canOpenSettings?: boolean
  /** MODEL_REQUIRED 2줄이 자리마다 다르다(마이크 테스트는 카드가 바로 위). */
  place?: 'talk' | 'micTest'
}

export function sttErrorCopy(code: SttErrorCode, opts: SttErrorCopyOpts = { native: false }): SttErrorCopy {
  switch (code) {
    case 'INSECURE':
      return { title: '이 주소에서는 마이크를 쓸 수 없어요.', action: 'https:// 로 시작하는 주소로 열어 주세요.', blocking: true }
    case 'UNSUPPORTED':
      return { title: '이 브라우저에서는 음성 인식을 쓸 수 없어요.', action: '최신 Chrome 으로 열어 주세요.', blocking: true }
    case 'MIC_DENIED':
      return {
        title: '마이크 사용이 막혀 있어요.',
        action: !opts.native
          ? '주소창 왼쪽 아이콘(사이트 정보) → 권한 → 마이크 → 허용으로 바꾼 뒤 다시 눌러 주세요.'
          : opts.canOpenSettings
            ? '앱 설정 → 권한 → 마이크 → ‘앱 사용 중에만 허용’을 골라 주세요.'
            : `휴대폰 설정 → 애플리케이션 → ${APP_LABEL} → 권한 → 마이크 → ‘앱 사용 중에만 허용’을 골라 주세요.`,
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
      return {
        title: '알아듣다가 문제가 생겼어요.',
        action: opts.offlineMode
          ? '오프라인 방식이라 서버로 바꾸지 않아요. 다시 말하거나 글자로 대화해 주세요.'
          : opts.switched
            ? '다음부터는 서버에서 알아들어요. 다시 눌러 말해 주세요.'
            : '다시 눌러 말해 주세요.',
        blocking: false,
      }
    case 'TIMEOUT':
      return { title: '결과가 너무 늦어지고 있어요.', action: '다시 눌러 말해 주세요.', blocking: false }
    case 'MODEL_REQUIRED':
      return {
        title: '휴대폰 인식 파일이 없어요.',
        action: opts.place === 'micTest' ? '위에서 파일을 받거나 다른 방식을 골라 주세요.' : '설정 → 음성 인식에서 받거나 다른 방식을 골라 주세요.',
        blocking: true,
      }
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
  /** 앱에서 권한을 한 번 거절한 뒤(누르기 전 상태 줄 — §11-8 ⓖ). */
  rationale: '말을 알아들으려면 마이크가 필요해요. 누르면 다시 물어봐요.',
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

/** 마이크 테스트 경로 한 줄(§11-8 ⓔ). 파일 없음처럼 사용자가 바꿀 수 있는 이유면 "위에서 받을 수 있어요"까지. */
export function pathCaption(route: SttRoute): string {
  switch (route.reason) {
    case 'READY':
      return '지금은 휴대폰에서 알아들어요.'
    case 'MODE_OFFLINE':
      return '지금은 휴대폰에서만 알아들어요(오프라인 방식).'
    case 'MODEL_ABSENT':
      return '지금은 서버에서 알아들어요. 휴대폰 인식 파일을 받으면 휴대폰에서 알아들어요 — 위에서 받을 수 있어요.'
    case 'MODEL_DOWNLOADING':
      return '지금은 서버에서 알아들어요. 휴대폰 인식 파일을 받는 중이에요.'
    case 'MODE_ACCURATE':
      return '지금은 서버에서 알아들어요(정확하게 방식).'
    case 'ONDEVICE_FAILED':
      return '휴대폰 인식이 잘 안 돼서 이번에는 서버에서 알아들어요. 앱을 다시 켜면 휴대폰부터 써요.'
    case 'UPDATE_REQUIRED':
      return '지금은 서버에서 알아들어요. 앱을 업데이트하면 휴대폰에서 알아들어요.'
    case 'WEB':
    case 'SERVER_DISABLED':
    default:
      return '지금은 서버에서 알아들어요.'
  }
}

/** 회화방 ⋯ 메뉴 "알아듣는 곳" 이유 줄(짧은 꼴, §11-8 ⓔ 오른쪽 열). 없으면 null. */
export function routeReasonShort(route: SttRoute): string | null {
  switch (route.reason) {
    case 'MODE_OFFLINE':
      return '오프라인 방식'
    case 'MODEL_ABSENT':
      return '휴대폰 인식 파일을 받기 전이에요'
    case 'MODEL_DOWNLOADING':
      return '휴대폰 인식 파일을 받는 중이에요'
    case 'MODE_ACCURATE':
      return '정확하게 방식'
    case 'ONDEVICE_FAILED':
      return '휴대폰 인식이 잘 안 돼서 바꿨어요'
    case 'UPDATE_REQUIRED':
      return '앱 업데이트가 필요해요'
    default:
      return null
  }
}

/** 말을 잃지 않은 전환 안내(토스트 1회, §11-8 ⓕ). */
export const STT_SWITCH_TOAST = '휴대폰 인식이 잘 안 돼서 서버에서 알아들을게요.'
/** 메뉴 줄 라벨·값·링크(§11-8 ⓕ). */
export const STT_ROUTE_ROW = { label: '알아듣는 곳', onDevice: '휴대폰에서', server: '서버에서', link: '음성 인식 설정 ›' } as const
/** [앱 설정 열기](§11-8 ⓖ). */
export const OPEN_APP_SETTINGS = '앱 설정 열기'
