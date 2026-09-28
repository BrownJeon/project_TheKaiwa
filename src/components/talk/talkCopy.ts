/**
 * 회화방 한국어 문구(screens §9-8). §3-8(채팅)·§7-8(표시등)·§8-8(음성 인식)에 있는 문구는 그 표(labels·ttsStatusCopy·sttCopy)를 쓰고,
 * 회화에만 있는 것만 여기 둔다. 엔진명·서버 주소·추적 값은 싣지 않는다.
 */

export const TALK_STATUS = {
  idle: '누르고 있는 동안 말해요',
  rateLimited: (sec: number) => `${sec}초 뒤에 말할 수 있어요`,
  unavailable: '지금은 말로 할 수 없어요 · 글자로 대화해 보세요',
  recording: (elapsedSec: number) => {
    const m = Math.floor(elapsedSec / 60)
    const s = String(elapsedSec % 60).padStart(2, '0')
    return `듣고 있어요 · ${m}:${s} — 손을 떼면 보내요`
  },
  askPermission: '마이크 사용을 허용해 주세요',
  slowConnect: '연결하는 중… 계속 말해도 돼요',
  recognizing: '알아듣는 중…',
  queued: '선생님 답이 끝나면 바로 보낼게요',
  thinking: '선생님이 생각하고 있어요',
  thinkingDetached: '연결을 다시 확인하고 있어요',
  speakingTurn: '선생님이 말하는 중 · 누르면 멈추고 말해요',
  speakingReplay: '다시 듣는 중 · 누르면 멈추고 말해요',
  speakingMine: '내 목소리를 듣는 중 · 누르면 멈추고 말해요',
} as const

export const TALK_HINT = {
  autoStopped: '30초가 지나 자동으로 멈추고 보냈어요.',
  tooShort: '너무 짧아서 보내지 않았어요. 한 번 더 말해 보세요.',
} as const

export const PTT_LABEL = {
  normal: '누르고 있는 동안 말하기',
  bargeIn: '누르면 선생님 말을 멈추고 말하기',
} as const

/** `utteranceUsed`·`utteranceExpired`·`utteranceOtherChat` = #32 409 `details.reason`(발화가 이미 다른 메시지에 연결됨·10분 지남·다른 방 녹음, task-018) — 다시 보내기는 글자 턴. */
export type UnsentReason = 409 | 429 | 0 | 422 | 400 | 'detached' | 'utteranceUsed' | 'utteranceExpired' | 'utteranceOtherChat' | 'other'

export function unsentText(reason: UnsentReason, opts: { retrySec?: number | null; serverMessage?: string | null } = {}): string {
  switch (reason) {
    case 409:
      return '선생님이 아직 답하는 중이라 보내지 못했어요.'
    case 429:
      return `너무 빨리 말했어요. ${Math.max(1, opts.retrySec ?? 1)}초 뒤에 다시 보낼 수 있어요.`
    case 0:
      return '보내지 못했어요. 네트워크를 확인해 주세요.'
    case 422:
      return '지금은 선생님이 답할 수 없어요. 잠시 후 다시 보내 주세요.'
    case 400:
      return opts.serverMessage || '보낼 수 없는 말이에요. 글자로 고쳐 보내 주세요.'
    case 'detached':
      return '선생님 답을 확인한 뒤 다시 보내 주세요.'
    case 'utteranceUsed':
      return '이 말은 이미 보낸 것 같아요. 대화를 확인하고, 다시 보내면 글자로 보내져요.'
    case 'utteranceExpired':
      return '녹음한 지 오래돼 목소리는 붙이지 못해요. 다시 보내면 글자로 보내져요.'
    case 'utteranceOtherChat':
      return '다른 대화에서 녹음한 말이라 목소리는 붙이지 못해요. 다시 보내면 글자로 보내져요.'
    default:
      return '보내지 못했어요. 다시 보내 주세요.'
  }
}

export const UNSENT_BUTTONS = {
  resend: '다시 보내기',
  resendIn: (sec: number) => `다시 보내기(${sec}초)`,
  edit: '글자로 고치기',
  discardLabel: '보내지 않고 버리기',
} as const

export const AUTOPLAY_COPY = {
  button: '▶ 눌러서 선생님 말 듣기',
  sub: '브라우저가 소리를 막았어요',
} as const

export const TOPIC_END_COPY = {
  text: '이 이야기는 여기까지 한 것 같아요. 새 회화로 넘어갈까요?',
  action: '새 회화',
  close: '닫기',
} as const

/** 다시 듣기·메뉴 토스트(§9-8 ⓔ) — HTTP status 로 가른다. */
export function replayErrorText(status: number | 'decode', retrySec?: number | null): string {
  switch (status) {
    case 422:
      return '지금은 선생님 목소리를 들을 수 없어요(자막만).'
    case 429:
      return `다시 듣기를 너무 자주 눌렀어요. ${Math.max(1, retrySec ?? 1)}초 뒤에 다시 눌러 주세요.`
    case 502:
      return '목소리를 만들다가 문제가 생겼어요. 다시 눌러 주세요.'
    case 504:
      return '목소리 서버 응답이 늦어요. 잠시 후 다시 눌러 주세요.'
    case 0:
      return '연결하지 못했어요. 네트워크를 확인해 주세요.'
    case 'decode':
      return '소리를 재생하지 못했어요. 다시 눌러 주세요.'
    case 404:
      return '녹음이 없어요. 내 목소리는 30일 동안만 보관해요.'
    default:
      return '소리를 불러오지 못했어요. 다시 눌러 주세요.'
  }
}

export const TALK_TOAST = {
  replayWhileRecording: '말하는 중에는 들을 수 없어요',
  modeWhileRecording: '말하는 중에는 바꿀 수 없어요',
  deleteWhileBusy: '답을 받는 중에는 지울 수 없어요',
  waitReply: '선생님 답을 기다리는 중이에요',
  profileSaved: (label: string) => `다음 대답부터 ${label}로 들려드려요`,
  profileFailed: '저장하지 못했어요. 다시 골라 주세요.',
} as const

export const TALK_HOME = {
  newTalk: '＋ 새 회화',
  section: '회화',
  more: '이전 회화 더 보기',
  emptyTitle: '아직 회화가 없어요',
  emptyBody: '버튼을 누른 채로 일본어로 말하면 선생님이 대답해요. 틀린 표현은 그 자리에서 고쳐 줘요.',
  emptyAction: '첫 회화 시작하기',
  pendingRowSuffix: '회화에서 보기 ›',
} as const

export const TALK_ROOM = {
  back: '회화 목록으로',
  menu: '회화 메뉴',
  srTitle: (title: string) => `, 회화: ${title}`,
  notFound: '이 회화를 찾을 수 없어요. 삭제되었을 수 있어요.',
  loadFailed: '회화를 불러오지 못했어요.',
  introLead: (name: string) => `${name}에게 일본어로 말을 걸어 보세요.`,
  introHow: '아래 버튼을 누른 채로 말하고, 다 말하면 손을 떼세요. 바로 보내져요.',
  introFix: '틀린 표현은 선생님이 그 자리에서 고쳐 줘요.',
  introTry: '이렇게 시작해 보세요:',
  introExamples: ['こんにちは。はじめまして。', '今日は何をしましたか。'],
  listening: '듣고 있어요…',
  queuedCaption: '선생님 말이 끝나면 바로 보낼게요',
  keyboard: '글자로 입력하기',
  voice: '말로 입력하기',
  stopTeacher: '선생님 말 멈추기',
  textPlaceholder: '일본어로 써 보세요 — 보내면 선생님이 말로 대답해요',
  speaking: '말하는 중',
  replayTutor: '▶ 다시 듣기',
  replayMine: '▶ 내 목소리',
  stop: '■ 멈춤',
  loading: '불러오는 중…',
  replayTutorAria: '선생님 말 다시 듣기',
  replayMineAria: '내 목소리 다시 듣기',
  stopAria: '멈추기',
  textInstead: '글자로 대화하기',
  /** 오프라인 방식 + 휴대폰 인식 파일 없음(MODEL_REQUIRED) — 설정의 휴대폰에서 알아듣기 카드로(§11-8 ⓕ). */
  openSettings: '설정 열기',
  closeAlert: '닫기',
  mismatch: '답을 정리하고 있어요',
} as const

export const SPEECH_PROFILE_DEFAULTS = [
  { id: 'NATIVE', label: '자연 속도' },
  { id: 'LEARNING_NORMAL', label: '학습 속도' },
  { id: 'LEARNING_SLOW', label: '천천히' },
] as const
