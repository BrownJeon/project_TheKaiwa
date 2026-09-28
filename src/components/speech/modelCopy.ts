/**
 * 휴대폰에서 알아듣기 카드·지우기 시트·인식 방식 설명 문구(docs/screens.md §11-8 ⓐ~ⓓ).
 * 사용자 말은 "휴대폰 인식 파일"·"휴대폰에서 / 서버에서"뿐 — 모델·엔진 이름·버전 문자열을 싣지 않는다.
 * "목소리가 서버로 가지 않아요"는 쓰지 않는다(회화에서 다 말한 문장은 #21 로 저장된다 — §11-0 ⑤).
 */
import type { ModelErrorCode, SttRoute } from '@/modules/speech/stt/client'

export type RecognitionMode = 'AUTO' | 'FAST' | 'ACCURATE' | 'OFFLINE'

export const MODEL_COPY = {
  title: '휴대폰에서 알아듣기',
  badge: { absent: '받지 않음', downloading: '받는 중', paused: '멈춤', installed: '준비됨', off: '쓸 수 없음', error: '문제 있음' },
  desc: '휴대폰 안에서 바로 알아들어요. 말하는 동안 소리를 서버로 보내지 않아서 인터넷이 느려도 빨라요.',
  beforeDownload: '받기 전에도 회화는 서버에서 알아들어요.',
  meta: (size: string) => `약 ${size} · Wi-Fi 에서 받아요`,
  download: (size: string | null) => (size ? `휴대폰에 받기 (약 ${size})` : '휴대폰에 받기'),
  useData: '데이터로 받기',
  later: '나중에',
  pause: '일시정지',
  resume: '이어받기',
  discardPartial: '받은 것 지우기',
  update: '새 버전 받기',
  remove: '지우기',
  consentTitle: '지금은 Wi-Fi 가 아니에요.',
  consentBody: (size: string | null) => `모바일 데이터로 약 ${size ?? '170MB'} 를 쓰게 돼요. Wi-Fi 에 연결한 뒤 다시 누르거나, 지금 받을 수 있어요.`,
  progress: (p: number) => `받는 중… ${p}%`,
  progressUpdate: (p: number) => `새 버전 받는 중… ${p}%`,
  progressBytes: (got: string, size: string) => `${got} / ${size}`,
  etaMinutes: (n: number) => `남은 시간 약 ${n}분`,
  etaUnderMinute: '1분 안에 끝나요',
  slow: '받는 속도가 느려요. Wi-Fi 연결을 확인해 주세요.',
  downloadingNote: '받는 동안에도 회화는 서버에서 알아들어요. 다른 화면으로 가도 계속 받아요.',
  verifying: '받은 파일을 확인하는 중…',
  paused: (got: string, size: string) => `멈춤 · ${got} / ${size} 받음`,
  offlineNote: '인터넷에 연결되면 받을 수 있어요.',
  installedMeta: (size: string) => `${size} 사용 중`,
  updateNote: (size: string | null) => `새 버전이 있어요(약 ${size ?? '170MB'}). 받는 동안에도 지금 버전으로 알아들어요.`,
  off: '지금은 휴대폰에서 알아듣기를 쓸 수 없어요. 서버에서 알아들어요.',
  knowThis: '회화에서 다 말한 문장은 대화 기록과 ‘내 목소리 다시 듣기’를 위해 서버에 저장돼요(30일 뒤 자동 삭제). 마이크 테스트는 저장하지 않아요.',
  offlineCannotRemove: '오프라인 방식에서는 지울 수 없어요 — 먼저 다른 방식을 골라 주세요.',
  progressAria: '휴대폰 인식 파일 받기',
  progressValueText: (got: string, size: string) => `${size} 중 ${got} 받음`,
  milestone: { 25: '4분의 1 받았어요', 50: '절반 받았어요', 75: '4분의 3 받았어요', 100: '다 받았어요. 확인하는 중이에요' } as Record<25 | 50 | 75 | 100, string>,
  ready: '준비됐어요. 이제 휴대폰에서 알아들어요.',
  removedToast: '휴대폰 인식 파일을 지웠어요',
  updatedToast: '새 버전으로 바꿨어요',
  checking: '확인하는 중…',
} as const

/** installed 상태 경로 줄(§11-8 ⓐ) — 방식·전환·강제 업데이트·서버 꺼 둠. */
export function installedRouteLine(mode: RecognitionMode | null, route: SttRoute | null): string {
  if (route?.reason === 'UPDATE_REQUIRED') return '앱을 업데이트하면 다시 휴대폰에서 알아들어요. 그동안은 서버에서 알아들어요.'
  if (route?.reason === 'ONDEVICE_FAILED') return '이번에는 휴대폰 인식이 잘 안 돼서 서버에서 알아듣고 있어요. 앱을 다시 켜면 휴대폰부터 써요.'
  if (route?.reason === 'SERVER_DISABLED') return '지금은 서버에서 알아들어요.'
  if (mode === 'ACCURATE') return '휴대폰에 받아 두었어요. 지금 방식(정확하게)에서는 서버에서 알아들어요.'
  if (mode === 'OFFLINE') return '휴대폰에 받아 두었어요. 서버로 바꾸지 않고 휴대폰에서만 알아들어요.'
  return '휴대폰에 받아 두었어요. 회화와 마이크 테스트에서 휴대폰으로 알아들어요.'
}

/** 카드 오류(§11-8 ⓑ) — 1줄 무엇 · 2줄 어떻게 · 버튼 1개. */
export function modelErrorCopy(code: ModelErrorCode, need: string | null): { title: string; action: string; button: string } {
  switch (code) {
    case 'INSUFFICIENT_STORAGE':
      return { title: '휴대폰 저장 공간이 부족해요.', action: `여유 공간이 약 ${need ?? '430MB'} 필요해요. 사진이나 앱을 정리한 뒤 다시 눌러 주세요.`, button: '다시 받기' }
    case 'OFFLINE':
      return { title: '인터넷에 연결되어 있지 않아요.', action: '받은 부분은 남아 있어요. 연결되면 이어서 받을 수 있어요.', button: '이어받기' }
    case 'DOWNLOAD_FAILED':
      return { title: '파일을 다 받지 못했어요.', action: '다시 누르면 받을 수 있는 곳부터 이어서 받아요. 계속 안 되면 잠시 뒤에 해 보세요.', button: '이어받기' }
    case 'SERVER':
      return { title: '지금은 파일을 받을 수 없어요.', action: '잠시 후 다시 시도해 주세요. 그동안은 서버에서 알아들어요.', button: '다시 시도' }
    case 'APP_UPDATE_REQUIRED':
      return { title: '새 앱에서만 받을 수 있는 버전이에요.', action: '앱을 업데이트한 뒤 받아 주세요.', button: '설치 방법' }
    case 'MODEL_CORRUPT':
      return { title: '휴대폰 인식 파일이 손상됐어요.', action: '다시 받아 주세요. 그동안은 서버에서 알아들어요.', button: '다시 받기' }
    default:
      return { title: '파일을 받지 못했어요.', action: '다시 눌러 주세요.', button: '다시 시도' }
  }
}

export const MODEL_DELETE_COPY = {
  title: '휴대폰 인식 파일 지우기',
  body: (size: string | null) => `지우면 저장 공간 약 ${size ?? '170MB'} 가 비어요. 회화는 서버에서 알아들어요.`,
  sub: (size: string | null) => `다시 쓰려면 약 ${size ?? '170MB'} 를 또 받아야 해요.`,
  confirm: '지우기',
  deleting: '지우는 중…',
  cancel: '취소',
  failed: '지우지 못했어요. 다시 눌러 주세요.',
  busy: '지금은 지울 수 없어요. 녹음이나 받기가 끝난 뒤 다시 눌러 주세요.',
} as const

/**
 * 인식 방식 설명(§11-8 ⓓ, Leader ⑭). 라벨은 그대로 두고 설명만 앱/웹·파일 유무로 고른다.
 * `disabled` 문구가 있으면 그 방식은 고를 수 없다(웹 오프라인, 앱 + 파일 없음 오프라인).
 */
export function modeDescription(mode: RecognitionMode, env: { native: boolean; onDevice: boolean; installed: boolean }): { desc: string; disabled: boolean } {
  const app = env.native && env.onDevice
  switch (mode) {
    case 'AUTO':
      if (!app) return { desc: '서버에서 알아들어요(앱에서는 휴대폰에서도 알아들어요)', disabled: false }
      return { desc: env.installed ? '휴대폰에서 알아듣고, 안 되면 서버에서 알아들어요' : '파일을 받기 전에는 서버에서 알아들어요', disabled: false }
    case 'FAST':
      if (!app) return { desc: '웹에서는 서버에서 알아들어요(앱에서는 휴대폰에서)', disabled: false }
      return { desc: env.installed ? '휴대폰에서 바로 알아들어요' : '파일을 받기 전에는 서버에서 알아들어요', disabled: false }
    case 'ACCURATE':
      return { desc: '서버에서 한 번 더 확인해요(조금 느려요)', disabled: false }
    case 'OFFLINE':
      if (!app) return { desc: '앱에서만 쓸 수 있어요', disabled: true }
      if (!env.installed) return { desc: '휴대폰 인식 파일을 받은 뒤 고를 수 있어요', disabled: true }
      return { desc: '서버로 바꾸지 않고 휴대폰에서만 알아들어요(선생님 대답에는 인터넷이 필요해요)', disabled: false }
  }
}
