/**
 * 질문 탭 「말로 묻기」 문구(task-066 §26-10 B — 승인 데모 v2 원문, ★ = 가이드가 정한 것). 회화와 같은 상태(권한·파일·연결·짧음 …)는
 * `talkCopy`·`sttCopy` 를 그대로 쓰고 여기엔 다른 점만 둔다. 엔진·모델·호스트 이름, 티켓 용도 이름은 싣지 않는다.
 */
import { unsentText, type UnsentReason } from '@/components/talk/talkCopy'

const n = (v: number) => v.toLocaleString('ko-KR')

export const ASK_VOICE_COPY = {
  idle: '누르고 있는 동안 일본어로 말해요',
  pttLabel: '누르고 있는 동안 일본어로 말하기',
  waiting: '답을 받은 뒤 말할 수 있어요',
  unavailable: '지금은 말로 물어볼 수 없어요 · 글자로 물어보세요',
  daily: '오늘은 더 물어볼 수 없어요',
  out: '손을 떼면 보내지 않아요',
  cancelHint: '틀렸으면 손가락을 버튼 밖으로 빼서 떼세요',
  cancelledToast: '보내지 않았어요',
  toText: '글자로 묻기',
  toVoice: '말로 묻기',
  asked: '말로 물었어요',
  fix: '고쳐서 묻기',
  meSr: '나(말로 물음): ',
  unsent: {
    rate: (sec: number) => `질문을 너무 자주 보냈어요. ${n(sec)}초 뒤에 다시 보낼 수 있어요.`,
    rateMin: (min: number) => `질문을 너무 자주 보냈어요. ${n(min)}분 뒤에 다시 보낼 수 있어요.`,
    daily: '오늘은 더 물어볼 수 없어요 — 내일 다시 물어봐 주세요.',
    busy: (sec: number) => `지금 질문이 몰려 있어요. ${n(sec)}초 뒤에 다시 물어봐 주세요.`,
    busyNoSec: '지금 질문이 몰려 있어요. 잠시 뒤에 다시 물어봐 주세요.',
    other: '선생님이 다른 대화에 답하는 중이라 보내지 못했어요. 답이 끝나면 다시 보내 주세요.',
  },
} as const

/** 말로 물은 것이 못 간 이유 — 회화 이유 + `self409`(이 대화가 아직 답하는 중 — 손을 뗀 순간의 경합). */
export type AskUnsentReason = UnsentReason | 'self409'

/** 「보내지 못한 말」 띠 한 건. `askReason` = 429 `details.reason`(ASK_RATE·ASK_DAILY·ASK_BUSY), `retryAfterSec` = 처음 받은 남은 초. */
export interface AskUnsent {
  text: string
  reason: AskUnsentReason
  askReason?: string | null
  retryAfterSec?: number | null
  serverMessage?: string | null
}

/** #32 거절 status → 띠 이유. 0·-1(accepted 전 끊김) = 네트워크. */
export function askUnsentReasonOf(status: number): UnsentReason {
  if (status === 409 || status === 429 || status === 400 || status === 422) return status
  if (status === 0 || status === -1) return 0
  return 'other'
}

/** 하루 한도 — 서버 이유가 우선, 없거나 모르는 값이면 남은 초가 3,600 을 넘는지로 추정(`askNoticeText` 와 같은 경계). */
export function askUnsentDaily(u: Pick<AskUnsent, 'reason' | 'askReason' | 'retryAfterSec'>, remaining: number | null): boolean {
  if (u.reason !== 429) return false
  if (u.askReason === 'ASK_DAILY') return true
  if (u.askReason === 'ASK_RATE' || u.askReason === 'ASK_BUSY') return false
  return (u.retryAfterSec ?? 0) > 3600 || (remaining ?? 0) > 3600
}

/** 띠 문구(§26-7 G 표) — 남은 횟수·한도 숫자는 말하지 않는다(남은 시간만). `remaining` = 429 남은 초(첫 틱 전 null). */
export function askUnsentText(u: AskUnsent, remaining: number | null): string {
  if (u.reason === 429) {
    const left = remaining ?? u.retryAfterSec ?? null
    if (u.askReason === 'ASK_BUSY') return left && left > 0 ? ASK_VOICE_COPY.unsent.busy(left) : ASK_VOICE_COPY.unsent.busyNoSec
    if (askUnsentDaily(u, remaining)) return ASK_VOICE_COPY.unsent.daily
    const sec = Math.max(1, left ?? 1)
    return sec > 90 ? ASK_VOICE_COPY.unsent.rateMin(Math.ceil(sec / 60)) : ASK_VOICE_COPY.unsent.rate(sec)
  }
  if (u.reason === 409) return ASK_VOICE_COPY.unsent.other
  if (u.reason === 'self409') return unsentText(409)
  return unsentText(u.reason, { retrySec: remaining, serverMessage: u.serverMessage })
}

/** [다시 보내기] — 하루 한도·400 은 없다(회화 400 규칙 그대로). */
export function askUnsentCanResend(u: AskUnsent, remaining: number | null): boolean {
  return u.reason !== 400 && !askUnsentDaily(u, remaining)
}

/** 공용 `UnsentBar` 에 넘길 이유(429 카운트다운·기본 규칙용) — `self409` 는 409 로. */
export function askUnsentBarReason(u: AskUnsent): UnsentReason {
  return u.reason === 'self409' ? 409 : u.reason
}
