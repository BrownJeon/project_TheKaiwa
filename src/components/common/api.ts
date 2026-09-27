/**
 * 브라우저 → `/api/*` 호출 래퍼.
 *
 * 봉투(`{ success, data, message }`)를 푸는 곳을 **한 곳으로 모은다** — 화면마다
 * `res.json().data` 를 직접 파면 실패 응답(`success:false`)을 그냥 `undefined` 로
 * 받아 "빈 화면인데 오류 표시가 없는" 상태가 된다.
 *
 * TheMeal 에서 이식. 클라이언트 전용(서버 모듈을 import 하지 않는다).
 */
import type { ApiEnvelope, ApiErrorCode } from '@/types/api'
import { isNativeApp } from '@/modules/infra/native'

export class ApiError extends Error {
  readonly status: number
  /** 서버 봉투의 `data.code`(api-contract §0-5). 네트워크 오류·봉투 없음이면 null. */
  readonly code: ApiErrorCode | null
  /**
   * 봉투의 `data.details`(선택). 화면이 **같은 status 안에서** 갈라야 할 때 쓴다 —
   * 409 단어 중복 `existingId`·만료 제안 `status`·턴 충돌 `runningMessageId`(task-006 D6), 429 `retryAfterSec`.
   */
  readonly details: Record<string, unknown> | null
  /** 429 의 `Retry-After` 헤더(초). 헤더가 없으면 null — 화면은 `details.retryAfterSec` 를 먼저 본다. */
  readonly retryAfterSec: number | null

  constructor(
    message: string,
    status: number,
    code: ApiErrorCode | null = null,
    details: Record<string, unknown> | null = null,
    retryAfterSec: number | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.retryAfterSec = retryAfterSec
  }
}

/** 세션이 끊긴 채로 화면에 머무르면 모든 요청이 401 이 된다 — 로그인으로 한 번만 보낸다. */
let redirectingToLogin = false

function handleUnauthorized(): never {
  if (typeof window !== 'undefined' && !redirectingToLogin) {
    redirectingToLogin = true
    const back = `${window.location.pathname}${window.location.search}`
    // **전체 새로고침이 의도다.** `router.push()` 로 넘기면 죽은 세션으로 받아 둔 클라이언트
    // 상태(목록·폼 draft·폴링 타이머)가 그대로 살아남아, 로그인 뒤 남의 화면처럼 보인다.
    // 세션 쿠키가 이미 없는 상황이라 SPA 전환을 유지할 이유도 없다.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- 위 사유
    window.location.href = `/login?callbackUrl=${encodeURIComponent(back)}`
  }
  throw new ApiError('로그인이 필요합니다', 401)
}

/**
 * 호출별 선택 옵션 — **기존 호출부 30여 곳의 시그니처는 그대로 둔다**(전부 선택 인자).
 *
 * `signal`: 추천 3종은 동기 호출이고 서버 상한이 **180초**다(task-010 — 55초는 모델을 재기
 * 전에 잡은 값이었고, 실측 결과 기본값 말고는 전부 초과했다). 1~2분을 기다리는 화면에서
 * 취소가 없으면 사용자는 화면을 떠나는 수밖에 없다.
 *
 * `onMessage`: **성공(200) 봉투의 `message`** 를 받는다. `send()` 는 `data` 만 돌려주므로
 * 원래는 성공 메시지가 갈 곳이 없었는데, Phase 5 서버는 "요청보다 적게 나왔다"·"N개는
 * 재고 밖 재료를 써서 제외했다"·"기간을 14일로 줄였다"·"이미 먹은 칸은 두었다"를 전부
 * 이 칸으로 보낸다(서버 인계 메모 4·5). 특히 `budgetUnder10k` 로 카드가 전부 걸러진
 * 경우는 **화면이 그 이유를 재구성할 방법이 없다** — 화면이 문구를 따로 적으면 서버와
 * 조용히 갈라지므로 서버 문구를 그대로 받아 띄운다.
 */
export interface ApiOptions {
  signal?: AbortSignal
  onMessage?: (message: string | null) => void
}

function parseRetryAfter(res: Response): number | null {
  const raw = res.headers.get('Retry-After')
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? Math.ceil(n) : null
}

function clientHeaders(init?: HeadersInit): Headers {
  // 앱 WebView 는 플랫폼을 알린다 — 서버가 인식 모드(OFFLINE 허용 여부)·음성 경로를 해석할 때 쓴다(api-contract #16).
  const headers = new Headers(init)
  if (isNativeApp()) headers.set('X-Client-Platform', 'app')
  return headers
}

async function send<T>(
  method: string,
  path: string,
  init: RequestInit,
  opts?: ApiOptions,
): Promise<T> {
  let res: Response
  try {
    const headers = clientHeaders(init.headers)
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      ...init,
      headers,
      signal: opts?.signal,
    })
  } catch (e) {
    // **취소는 오류가 아니다** — 화면이 "연결하지 못했습니다"를 띄우면 사용자는 자기가
    // 누른 취소를 실패로 읽는다. 그대로 던져 호출부가 `AbortError` 로 구분하게 둔다.
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    // 네트워크 단절·앱 백그라운드 전환 — 서버 오류와 구분해서 안내한다.
    throw new ApiError('연결하지 못했습니다. 네트워크를 확인해 주세요.', 0)
  }

  if (res.status === 401) handleUnauthorized()

  let envelope: ApiEnvelope<T> | null = null
  try {
    envelope = (await res.json()) as ApiEnvelope<T>
  } catch {
    envelope = null
  }

  if (!res.ok || !envelope || envelope.success !== true) {
    const message =
      envelope && typeof envelope.message === 'string' && envelope.message
        ? envelope.message
        : `요청을 처리하지 못했습니다 (${res.status})`
    const code = envelope && envelope.success === false && envelope.data ? envelope.data.code : null
    const details = envelope && envelope.success === false && envelope.data?.details ? envelope.data.details : null
    throw new ApiError(message, res.status, code, details, parseRetryAfter(res))
  }

  opts?.onMessage?.(typeof envelope.message === 'string' ? envelope.message : null)
  return envelope.data
}

function request<T>(method: string, path: string, body?: unknown, opts?: ApiOptions): Promise<T> {
  return send<T>(
    method,
    path,
    {
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    opts,
  )
}

/**
 * 파일 업로드(`multipart/form-data`).
 *
 * **`Content-Type` 을 직접 넣지 않는다** — 브라우저가 경계 문자열(boundary)까지 붙여
 * 만들어야 한다. 손으로 넣으면 boundary 가 빠져 서버가 본문을 파싱하지 못한다.
 */
export const apiUpload = <T>(path: string, form: FormData, method = 'POST', opts?: ApiOptions) =>
  send<T>(method, path, { body: form }, opts)

export const apiGet = <T>(path: string, opts?: ApiOptions) => request<T>('GET', path, undefined, opts)
export const apiPost = <T>(path: string, body?: unknown, opts?: ApiOptions) =>
  request<T>('POST', path, body ?? {}, opts)
export const apiPut = <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {})
export const apiPatch = <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {})
export const apiDelete = <T>(path: string) => request<T>('DELETE', path)

/**
 * SSE 요청(api-contract §0-9, #32 턴). `EventSource` 는 POST 본문을 못 보내서 fetch 스트림을 쓴다.
 *
 * 헤더·401 로그인 이동·봉투 오류 해석은 위 `send()` 와 **같은 규칙**을 공유하고, 성공이면
 * `text/event-stream` 본문 스트림을 그대로 돌려준다(이벤트 파싱은 호출부 — 화면마다 이벤트가 다르다).
 * `Content-Type` 이 SSE 가 아니면 서버가 봉투로 거절한 것이다(409·429·400 …) → `ApiError`.
 *
 * 취소(`signal`)는 스트림만 끊는다 — 서버는 끝까지 처리·저장하므로(§0-9) 화면은 돌아와서 폴링으로 이어 붙인다.
 */
export async function apiStream(
  path: string,
  body: unknown,
  opts?: { signal?: AbortSignal },
): Promise<ReadableStream<Uint8Array>> {
  let res: Response
  try {
    const headers = clientHeaders({ 'Content-Type': 'application/json', Accept: 'text/event-stream' })
    res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers,
      body: JSON.stringify(body ?? {}),
      signal: opts?.signal,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new ApiError('연결하지 못했습니다. 네트워크를 확인해 주세요.', 0)
  }

  if (res.status === 401) handleUnauthorized()

  const contentType = res.headers.get('Content-Type') ?? ''
  if (res.ok && contentType.includes('text/event-stream') && res.body) return res.body
  throw await errorFromResponse(res)
}

/** 본문이 JSON 봉투가 아닌 성공 응답을 받는 경로(SSE·오디오)의 실패 해석 — 봉투의 message·code·details·Retry-After 를 그대로. */
async function errorFromResponse(res: Response): Promise<ApiError> {
  let envelope: ApiEnvelope<unknown> | null = null
  try {
    envelope = (await res.json()) as ApiEnvelope<unknown>
  } catch {
    envelope = null
  }
  const failed = envelope && envelope.success === false ? envelope : null
  const message = failed && typeof failed.message === 'string' && failed.message ? failed.message : `요청을 처리하지 못했습니다 (${res.status})`
  return new ApiError(message, res.status, failed?.data?.code ?? null, failed?.data?.details ?? null, parseRetryAfter(res))
}

/**
 * 오디오 응답 POST(#18 미리듣기·#23 합성) — 성공이면 `audio/wav` 본문과 `X-Tts-Cache`(HIT|MISS)만 돌려준다.
 * 실패는 `send()` 와 같은 규칙(401 로그인 이동·봉투 → ApiError·취소는 AbortError 그대로).
 */
export async function apiPostAudio(path: string, body: unknown, opts?: { signal?: AbortSignal }): Promise<{ data: ArrayBuffer; cache: 'HIT' | 'MISS' | null }> {
  let res: Response
  try {
    const headers = clientHeaders({ 'Content-Type': 'application/json', Accept: 'audio/wav' })
    res = await fetch(path, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers, body: JSON.stringify(body ?? {}), signal: opts?.signal })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new ApiError('연결하지 못했습니다. 네트워크를 확인해 주세요.', 0)
  }
  if (res.status === 401) handleUnauthorized()
  const contentType = res.headers.get('Content-Type') ?? ''
  if (!res.ok || !contentType.startsWith('audio/')) throw await errorFromResponse(res)
  const cache = res.headers.get('X-Tts-Cache')
  return { data: await res.arrayBuffer(), cache: cache === 'HIT' || cache === 'MISS' ? cache : null }
}

/** 사용자가 누른 취소인가. 오류 문구를 띄우면 안 되는 유일한 경우다. */
export function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error && e.message) return e.message
  return '알 수 없는 오류가 발생했습니다'
}
