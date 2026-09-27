/**
 * `/ws/speech` 프로토콜 v1(api-contract §2-29 + 이력서 A 계약) — 순수 함수만(브라우저·테스트 공용).
 *
 * 서버 메시지는 **화이트리스트 필드만** 남긴다: `ready.sessionId`·`final.traceId/timings/segments` 등은 버린다(M2 — 화면·state 에
 * 엔진 식별값·추적값이 흘러가지 않게). 서버 `error.message`(개발용 영문)도 버리고 코드만 쓴다.
 * 오류·close 코드 → 화면 코드(`SttErrorCode`) 정규화는 docs/screens.md §8-8 ⓐ "원인" 열을 따른다.
 */
import type { SttErrorCode, SttTicket, TicketFailure } from './types'
import { SttError } from './types'

export const PROTOCOL_VERSION = 1
export const SAMPLE_RATE = 16_000
export const FRAME_SAMPLES = 640
export const FRAME_BYTES = FRAME_SAMPLES * 2

export type ServerMessage =
  | { type: 'ready' }
  | { type: 'vad'; state: 'SPEECH' | 'SILENCE' }
  | { type: 'partial'; segIdx: number; text: string }
  | { type: 'final'; text: string; durationMs: number; utteranceId: string | null }
  | { type: 'error'; code: string; fatal: boolean }
  | { type: 'pong' }

export function buildStartMessage(o: { ticket: string; chatId?: string; partial: boolean; clientPlatform: 'web' | 'android' }): string {
  return JSON.stringify({
    type: 'start',
    v: PROTOCOL_VERSION,
    ticket: o.ticket,
    sampleRate: SAMPLE_RATE,
    partial: o.partial,
    clientPlatform: o.clientPlatform,
    endpoint: 'manual',
    ...(o.chatId ? { chatId: o.chatId } : {}),
  })
}

function str(v: unknown, max = 4000): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}
function nonNegInt(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0
}

/** 텍스트 프레임 → 필요한 필드만. 모르는 type·깨진 JSON 은 null(무시). */
export function parseServerMessage(raw: unknown): ServerMessage | null {
  if (typeof raw !== 'string' || raw.length > 64 * 1024) return null
  let m: Record<string, unknown>
  try {
    const v: unknown = JSON.parse(raw)
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null
    m = v as Record<string, unknown>
  } catch {
    return null
  }
  switch (m.type) {
    case 'ready':
      return { type: 'ready' }
    case 'vad':
      return m.state === 'SPEECH' || m.state === 'SILENCE' ? { type: 'vad', state: m.state } : null
    case 'partial':
      return { type: 'partial', segIdx: nonNegInt(m.segIdx), text: str(m.text) }
    case 'final':
      return {
        type: 'final',
        text: str(m.text),
        durationMs: nonNegInt(m.durationMs),
        utteranceId: typeof m.utteranceId === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(m.utteranceId) ? m.utteranceId : null,
      }
    case 'error':
      // message 는 개발용 영문이라 버린다. 교체(4409)만 message 로 구분한다.
      return { type: 'error', code: m.message === 'replaced' ? 'REPLACED' : str(m.code, 40), fatal: m.fatal !== false }
    case 'pong':
      return { type: 'pong' }
    default:
      return null
  }
}

/** 서버 `error.code` → 화면 코드. null = 표시하지 않음(결과는 따로 옴). README 옛 코드도 받아 준다. */
export function mapServerError(code: string): SttErrorCode | null {
  switch (code) {
    case 'UNAUTHENTICATED':
    case 'TICKET_INVALID':
    case 'TICKET_USED':
      return 'TICKET'
    case 'ENGINE_UNAVAILABLE':
      return 'SERVER_UNAVAILABLE'
    case 'REPLACED':
      return 'REPLACED'
    case 'RATE_LIMITED':
    case 'SESSION_LIMIT':
      return 'BUSY'
    case 'SESSION_EXPIRED':
      return 'CONNECTION_LOST'
    case 'CALLBACK_FAILED':
      return null
    case 'VALIDATION':
    case 'AUDIO_FORMAT':
    case 'ENGINE_ERROR':
    default:
      return 'ENGINE_ERROR'
  }
}

/** 연결이 닫힐 때 어느 단계였는가 — 같은 close 코드도 단계에 따라 뜻이 다르다. */
export type ConnPhase = 'connecting' | 'active' | 'idle'

/**
 * close 코드 → 화면 코드. null = 조용히 넘어감(유휴 중 정상 종료·유휴 만료 — 다음 누름이 새로 연결한다).
 * 4401·4403 은 호출자가 새 티켓으로 1회 조용히 다시 시도한 뒤에만 TICKET 으로 표시한다.
 */
export function mapCloseCode(code: number, phase: ConnPhase): SttErrorCode | null {
  switch (code) {
    case 4401:
    case 4403:
      return 'TICKET'
    case 4409:
      return 'REPLACED'
    case 4422:
      return 'SERVER_UNAVAILABLE'
    case 4429:
      return 'BUSY'
    case 4400:
    case 4413:
      return 'ENGINE_ERROR'
    default:
      if (phase === 'idle') return null
      if (phase === 'connecting') return 'CONNECT_FAILED'
      return 'CONNECTION_LOST'
  }
}

/** #20 실패 → 화면 코드(422 서버 준비 중 · 429 잠시 후 · 그 밖 연결 실패). 401 은 api 래퍼가 로그인으로 보낸다. */
export function mapTicketFailure(e: unknown): SttError {
  if (e instanceof SttError) return e
  const f = (e ?? {}) as Partial<TicketFailure>
  if (f.status === 422 || f.code === 'ENGINE_UNAVAILABLE') return new SttError('SERVER_UNAVAILABLE')
  if (f.status === 429 || f.code === 'RATE_LIMITED') return new SttError('BUSY', typeof f.retryAfterSec === 'number' && f.retryAfterSec > 0 ? f.retryAfterSec : undefined)
  if (f.status === 401) return new SttError('TICKET')
  return new SttError('CONNECT_FAILED')
}

/** getUserMedia 예외 → 화면 코드(§8-8 ⓐ). */
export function mapMediaError(e: unknown): SttErrorCode {
  const name = (e as { name?: string })?.name ?? ''
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'MIC_DENIED'
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return 'MIC_NOT_FOUND'
  if (name === 'NotReadableError' || name === 'AbortError' || name === 'TrackStartError') return 'MIC_BUSY'
  if (name === 'TypeError') return 'UNSUPPORTED'
  return 'MIC_BUSY'
}

const DEV_WS = /^ws:\/\/(127\.0\.0\.1|localhost):\d{2,5}\/[A-Za-z0-9/_-]{1,60}$/
const WS_PATH = /^\/[A-Za-z0-9/_-]{1,60}$/

/**
 * 연결 주소 — 운영은 같은 호스트의 `wsPath`(https 면 wss). 개발 서버가 준 `wsUrl` 은 loopback ws:// 일 때만 쓴다
 * (서버 응답이 어떻든 다른 호스트로는 붙지 않는다).
 */
export function resolveWsUrl(t: Pick<SttTicket, 'wsPath' | 'wsUrl'>, loc: { protocol: string; host: string }): string {
  if (t.wsUrl && DEV_WS.test(t.wsUrl)) return t.wsUrl
  const path = WS_PATH.test(t.wsPath) ? t.wsPath : '/ws/speech'
  return `${loc.protocol === 'https:' ? 'wss:' : 'ws:'}//${loc.host}${path}`
}
