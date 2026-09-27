/**
 * 실시간 인식 클라이언트 계약(docs/screens.md §8-3 A · module-dependency L4 `RealtimeSttClient`).
 * 화면은 이 인터페이스만 본다 — 어느 경로(서버/휴대폰)인지는 `kind` 한 글자로만 알고 엔진·주소는 모른다.
 */
export type SttKind = 'GATEWAY' | 'ONDEVICE'

/** 티켓 용도(Leader M1) — MIC_TEST 는 gateway 가 저장·콜백을 건너뛴다. 회화 턴은 TURN. */
export type SttPurpose = 'TURN' | 'MIC_TEST'

export type SttErrorCode =
  | 'INSECURE'
  | 'UNSUPPORTED'
  | 'MIC_DENIED'
  | 'MIC_NOT_FOUND'
  | 'MIC_BUSY'
  | 'OFFLINE'
  | 'SERVER_UNAVAILABLE'
  | 'CONNECT_FAILED'
  | 'CONNECTION_LOST'
  | 'TICKET'
  | 'REPLACED'
  | 'BUSY'
  | 'ENGINE_ERROR'
  | 'TIMEOUT'

export type SttEvent =
  | { type: 'level'; db: number }
  | { type: 'connecting'; slow: boolean }
  | { type: 'ready' }
  | { type: 'partial'; segIdx: number; text: string }
  | { type: 'final'; text: string; durationMs: number; utteranceId: string | null }
  | { type: 'error'; code: SttErrorCode; retryAfterSec?: number }

export interface BeginOptions {
  purpose: SttPurpose
  chatId?: string
}

export interface RealtimeSttClient {
  readonly kind: SttKind
  /** 마이크 열기+캡처 시작에 resolve(연결은 병행, 그 사이 프레임은 최대 3초 버퍼). 실패는 SttError 로 reject. **누름 핸들러 안에서 동기로 호출.** */
  begin(o: BeginOptions): Promise<void>
  /** 발화 끝(푸시투토크 놓음) — 남은 소리를 보내고 `stop`. 결과는 `final` 이벤트로. */
  end(): void
  /** 현재 발화 폐기(final 없음). */
  cancel(): void
  /** 트랙·AudioContext·연결 정리. */
  dispose(): void
  subscribe(fn: (e: SttEvent) => void): () => void
}

export class SttError extends Error {
  constructor(
    readonly code: SttErrorCode,
    readonly retryAfterSec?: number,
  ) {
    super(code)
    this.name = 'SttError'
  }
}

/** #19 응답 중 클라이언트가 쓰는 부분(엔진 식별값은 읽지 않는다). */
export interface SttClientConfig {
  gateway?: { enabled: boolean; wsPath?: string; sampleRate?: number; frameMs?: number }
  onDevice?: { enabled: boolean }
}

/** #20 응답. `wsUrl` 은 개발 서버에서만 온다. */
export interface SttTicket {
  ticket: string
  expiresAt: string
  wsPath: string
  sampleRate: number
  frameMs: number
  wsUrl?: string
}

/** 티켓 요청 실패를 화면 코드로 바꾸기 위한 최소 모양(`components/common/api` ApiError 와 호환). */
export interface TicketFailure {
  status: number
  code?: string | null
  retryAfterSec?: number | null
}

export type TicketFetcher = (body: { purpose: SttPurpose; chatId?: string }) => Promise<SttTicket>
