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
  /** 오프라인 방식인데 휴대폰 인식 파일이 없거나 손상됐다(서버로 바꾸지 않는다 — task-003f, screens §11-3 C). */
  | 'MODEL_REQUIRED'

export type SttEvent =
  | { type: 'level'; db: number }
  | { type: 'connecting'; slow: boolean }
  | { type: 'ready' }
  | { type: 'partial'; segIdx: number; text: string }
  | { type: 'final'; text: string; durationMs: number; utteranceId: string | null }
  /**
   * `switched` = 이 오류로 휴대폰 → 서버 전환이 일어났다(다음 누름부터 서버, 띠 2줄). `offlineMode` = 오프라인 방식이라 바꾸지 않는다.
   */
  | { type: 'error'; code: SttErrorCode; retryAfterSec?: number; switched?: boolean; offlineMode?: boolean }
  /** 휴대폰 인식 세션이 앱 전환으로 취소됐다(말 잃음, 오류 띠 아님 — 힌트 INTERRUPTED). */
  | { type: 'interrupted' }
  /** 다음 누름의 인식 경로(라우터). `switched` = 말을 잃지 않은 전환이 방금 일어났다(토스트 1회). */
  | { type: 'route'; route: SttRoute; switched: boolean }

/**
 * 경로와 그 이유(screens §11-3 C). 화면은 이 두 값으로만 문구를 고른다 — 엔진·주소는 모른다.
 *  WEB = 플러그인 없음(웹·플러그인 없는 셸) · READY = 휴대폰 준비됨 · MODEL_ABSENT/MODEL_DOWNLOADING = 파일 없음/받는 중이라 서버 ·
 *  MODE_ACCURATE/MODE_OFFLINE = 방식 때문 · ONDEVICE_FAILED = 오류 누적으로 전환(앱 실행 동안) · SERVER_DISABLED = 서버가 휴대폰 경로를 꺼 둠 ·
 *  UPDATE_REQUIRED = 강제 업데이트 상태라 휴대폰 경로를 쓰지 않음.
 */
export type SttRouteReason = 'WEB' | 'READY' | 'MODEL_ABSENT' | 'MODEL_DOWNLOADING' | 'MODE_ACCURATE' | 'MODE_OFFLINE' | 'ONDEVICE_FAILED' | 'SERVER_DISABLED' | 'UPDATE_REQUIRED'

export interface SttRoute {
  kind: SttKind
  reason: SttRouteReason
}

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
    /** 휴대폰 경로 실패의 플러그인 코드(라우터가 이어갈지·셀지 판단). 화면에는 쓰지 않는다. */
    readonly pluginCode?: string,
  ) {
    super(code)
    this.name = 'SttError'
  }
}

/**
 * #19 응답 중 클라이언트가 쓰는 부분. `onDevice.connectionKey` 는 불투명 id(#21 업로드에 그대로 돌려준다), 모델은 불투명 id·version 뿐 —
 * 엔진·모델 이름은 없다.
 */
export interface SttClientConfig {
  recognitionMode?: 'AUTO' | 'FAST' | 'ACCURATE' | 'OFFLINE'
  gateway?: { enabled: boolean; wsPath?: string; sampleRate?: number; frameMs?: number }
  onDevice?: {
    /** 경로 선택(사용자 방식·플랫폼 해석 결과)만 뜻한다. 모델 블록은 enabled 와 무관하게 온다(Leader ②). */
    enabled: boolean
    /** 서버에 휴대폰 인식 파일 배포본이 있는가. */
    available?: boolean
    connectionKey?: string
    runtime?: {
      numThreads?: number | null
      decodingMethod?: string | null
      vad?: { silenceMs?: number | null; threshold?: number | null }
      partial?: boolean
    }
    model?: { id?: string; version?: string | null; manifestUrl?: string; totalBytes?: number | null; wifiRecommended?: boolean }
  }
  fallback?: { onDeviceFailureThreshold?: number; toGateway?: boolean }
  upload?: { maxBytes?: number; maxDurationMs?: number }
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
