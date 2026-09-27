/**
 * `clientTimings`(screens §9-3 G, task-007 §9-11 ⑤) — 다음 턴 요청에 직전 턴 재생 계측을 싣는다. 순수.
 * 시각은 모두 같은 시계(`performance.now()`), 정수 ms, 0~120,000 밖이면 뺀다. 글자(발화·응답)는 싣지 않는다.
 */
import type { ClientTimings } from '@/types/chat'

export const TIMING_MAX_MS = 120_000

/** 이번에 보내는 말의 기준점 — 손 뗌(음성, 30초 자동 멈춤이면 그 시각) 또는 보내기 누름(글자). */
export interface TurnOrigin {
  origin: 'release' | 'send'
  originAt: number
  /** 음성 final 을 받은 시각(글자 턴은 없음) */
  finalAt?: number
}

/** 직전 턴 — accepted 에서 기록한 기준점과 재생 큐의 시각. */
export interface PrevTurn extends TurnOrigin {
  assistantMessageId: string
  queue: { firstAudioEventAt?: number; firstPlayAt?: number; autoplayed: boolean } | null
}

function ms(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined || b === undefined || !Number.isFinite(a) || !Number.isFinite(b)) return undefined
  const d = Math.round(b - a)
  return d >= 0 && d <= TIMING_MAX_MS ? d : undefined
}

export function buildClientTimings(prev: PrevTurn | null, current: TurnOrigin): ClientTimings | undefined {
  const out: ClientTimings = {}
  if (current.origin === 'release') {
    const stt = ms(current.originAt, current.finalAt)
    if (stt !== undefined) out.sttMs = stt
  }
  if (prev) {
    out.prevMessageId = prev.assistantMessageId
    const q = prev.queue
    if (q) {
      if (prev.origin === 'release') {
        const r = ms(prev.originAt, q.firstAudioEventAt)
        if (r !== undefined) out.releaseToFirstAudioEventMs = r
      }
      // 자동재생이 아니면(차단 뒤 탭·barge-in 이 먼저·자막만·폴링 복구) 재생 지연을 재지 않는다.
      if (q.autoplayed) {
        const first = ms(prev.originAt, q.firstPlayAt)
        if (first !== undefined) out.firstAudioAtMs = first
        const delay = ms(q.firstAudioEventAt, q.firstPlayAt)
        if (delay !== undefined) out.playbackStartDelayMs = delay
      }
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}
