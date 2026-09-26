/**
 * home-m4-api `/v1/chat` 어댑터 — TheKaiwa 에서는 **보조 작업 전용**(connection `runtime.allowedTasks`:
 * 단어 보강·보기 생성·점검 폴백 후보)이며 회화·채팅·질문에는 router 가 배정하지 않는다. TheMeal `src/lib/ai/llmClient.ts`
 * 이식본이라 아래 실측 기록은 TheMeal 때의 것이다(게이트웨이 계약은 같다). 라우트에서 직접 부르지 않고 `engine.llm` 파사드만 쓴다.
 *
 * ── 실측으로 확정된 게이트웨이 계약 (2026-09-10 · 재확인 2026-09-11) ─────────
 * - 인증 헤더는 **`X-API-Key`**. `Authorization: Bearer`로 보내면 401이다(재확인: 401).
 * - `/v1/chat`·`/v1/generate`만 인증이 걸려 있고 `/v1/models`는 인증이 없다.
 * - 잘못된 키 → `401 {"detail":"invalid or disabled api key"}`, rate limit → `429` + `Retry-After`.
 * - 응답은 OpenAI 형식이 **아니다**: `{model, message:{role,content}, eval_count,
 *   total_duration_ms, kb_used}` — 본문은 `message.content`에서 꺼낸다.
 *   (재확인 호출: qwen2.5:14b-instruct, 2.4초, `{"ingredients":[...]}` 정상 수신)
 * - **system 메시지를 항상 첫 번째로** 보낸다. 없으면 게이트웨이가 주식분석가 프롬프트를
 *   자동 주입한다(VoiceVault 2026-08-27 실측). 이 모듈은 그걸 **런타임에 강제**한다
 *   (`assertSystemFirst`) — 규약을 주석으로만 남기면 호출부가 늘면서 반드시 새어나간다.
 * - `kb_collections`는 사용하지 않는다(TheMeal은 RAG를 쓰지 않는다). 게이트웨이의 KB
 *   자동주입 경로는 collection scope 검사를 우회하는 것으로 알려져 있어 아예 보내지 않는다.
 *
 * ── 왜 전역 `fetch`가 아니라 `node:http`인가 (VoiceVault task-021 4라운드 이식) ──
 * Node 전역 `fetch`(undici)에는 `AbortSignal`과 **무관한** `headersTimeout`(기본 300초)이 있다.
 * `/v1/chat`은 스트리밍이 아니라 생성이 끝나야 응답 헤더가 나오므로, 한 호출이 300초를 넘기면
 * 우리 예산이 얼마든 `UND_ERR_HEADERS_TIMEOUT`으로 끊긴다. 더 나쁜 건 그게
 * `signal.aborted`가 아니라서 `LlmTimeoutError`로 감싸지지 않는다는 점 — 사용자에게는
 * `TypeError: fetch failed` 한 줄만 남는다(Node v20에서 300,898ms로 실측된 사례).
 * `node:http`에는 그런 암묵적 타임아웃이 없다. 단 `http.globalAgent`의 `timeout: 5000`
 * (Node 19+ 기본)이 소켓 유휴 타이머를 걸므로 **`timeout: 0` 전용 Agent**를 쓴다.
 * 결과적으로 이 모듈의 유일한 시간 상한은 아래 예산이다.
 *
 * ⚠️ 서버 전용 모듈이다. 클라이언트 컴포넌트에서 import하면 `node:http`가 브라우저 번들에
 *    들어가려다 빌드가 깨진다.
 */
import { Agent as HttpAgent, request as httpRequest, type IncomingMessage, type RequestOptions } from 'node:http'
import { Agent as HttpsAgent, request as httpsRequest } from 'node:https'

// ── 타임아웃 예산 ─────────────────────────────────────────────────────────────
//
// VoiceVault `llmBudget.ts`가 실측 회귀로 산출한 계수를 그대로 가져왔다(같은 M4 · 같은 모델
// `qwen2.5:14b-instruct`를 공유하므로 새로 재는 것보다 검증된 값을 쓰는 편이 안전하다).
//
//     예산(c) = min(천장, 90초 + 16.5초 × ceil(c/1000자))
//
// 90초 바닥값은 "회귀 절편 × 여유 2.0 = 60초"가 아니라 **관측된 최대 소요 80.8초를 바닥값
// 하나로 덮도록** 올린 값이다. 16.5초/1k자 = 회귀 기울기 8.26초 × 여유 2.0.
// 여유 2.0의 근거는 같은 프롬프트가 M4 부하에 따라 0.28~1.62배로 흔들린 실측이다.

/** meal.미라클펭귄.com vhost의 `proxy_read_timeout`(설계안 §9 — 600s로 설정). */
export const NGINX_PROXY_READ_TIMEOUT_MS = 600_000
/** 프롬프트 길이와 무관한 몫(관측 최대 소요 80.8초를 바닥값만으로 덮는다). */
export const LLM_BASE_TIMEOUT_MS = 90_000
/** 프롬프트 1,000자당 추가 예산(회귀 기울기 8.26초 × 여유 2.0). */
export const LLM_MS_PER_1K_PROMPT_CHARS = 16_500
/** 동기(요청 수명 안) 경로의 천장 — nginx 600초에서 30초(DB·커넥션 몫)를 뺀 값.
 *  이 아래에 있는 한 초과는 항상 우리 `LlmTimeoutError`로 뜬다(nginx 504가 아니라). */
export const LLM_MAX_TIMEOUT_MS = NGINX_PROXY_READ_TIMEOUT_MS - 30_000
/**
 * 백그라운드 경로가 **"내 앞의 한 건"을 기다릴 수 있는 몫**. 발명값이 아니라 유도값이다 —
 * 모든 호출자가 자기 예산에서 스스로 중단하고 어떤 예산도 `LLM_MAX_TIMEOUT_MS`를 넘지
 * 않으므로, 앞선 한 건이 M4를 점유할 수 있는 시간의 상한이 정확히 그 값이다.
 * (M4는 `OLLAMA_NUM_PARALLEL` 미설정 = 완전 직렬이고 6개 프로젝트가 공유한다.)
 */
export const LLM_QUEUE_ALLOWANCE_MS = LLM_MAX_TIMEOUT_MS
/** 백그라운드(잡 러너) 천장 = 생성 상한 + 대기 1건분. **동기 경로에서 쓰지 마라** —
 *  거기서 쓰면 사용자는 우리 안내 대신 nginx 504를 본다. */
export const LLM_BACKGROUND_MAX_TIMEOUT_MS = LLM_MAX_TIMEOUT_MS + LLM_QUEUE_ALLOWANCE_MS

/** 예산 산정에 쓰는 작업량 지표 — 보낼 messages의 content 총 길이(자). */
export function countPromptChars(messages: LlmMessage[]): number {
  if (!Array.isArray(messages)) return 0
  let total = 0
  for (const m of messages) {
    if (typeof m?.content === 'string') total += m.content.length
  }
  return total
}

/**
 * 동기 경로 예산. `promptChars`가 유한한 양수가 아니면 바닥값으로 떨어진다 —
 * `setTimeout(NaN)`이 즉시 발화해 "상한이 사실상 0"이 되는 함정을 막는다.
 */
export function resolveLlmTimeoutMs(promptChars: number): number {
  if (!Number.isFinite(promptChars) || promptChars <= 0) return LLM_BASE_TIMEOUT_MS
  const scaled = Math.ceil(promptChars / 1000) * LLM_MS_PER_1K_PROMPT_CHARS
  return Math.min(LLM_MAX_TIMEOUT_MS, LLM_BASE_TIMEOUT_MS + scaled)
}

/** 백그라운드 잡(URL 인제스트·사진 칼로리·식단계획) 예산 = 동기 예산 + 대기 1건분. */
export function resolveBackgroundLlmTimeoutMs(promptChars: number): number {
  return Math.min(LLM_BACKGROUND_MAX_TIMEOUT_MS, resolveLlmTimeoutMs(promptChars) + LLM_QUEUE_ALLOWANCE_MS)
}

// ── 타입 ─────────────────────────────────────────────────────────────────────

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmCallOptions {
  /**
   * 호출 타임아웃(ms) override. 생략하면 프롬프트 길이에서 유도한다.
   *
   * 동기 경로는 원칙적으로 넘기지 않는다 — 호출부마다 손으로 고른 상수가 갈라지는 것이
   * VoiceVault에서 실제 장애의 원인이었다. **백그라운드 잡만** `resolveBackgroundLlmTimeoutMs`로
   * 유도한 값을 명시적으로 넘긴다(그 경로만 nginx 600초 밖에 있다).
   */
  timeoutMs?: number
  /** 모델 override. 미지정 시 `AI_API_MODEL`. **추론(thinking) 모델을 넣지 마라** — 이 코드는
   *  `message.content`만 읽으므로 thinking에 쓴 시간이 전부 버려진다(VoiceVault task-034). */
  model?: string
  /** temperature override. 미지정 시 `AI_API_TEMPERATURE`(기본 0.3). */
  temperature?: number
  /** 429(rate limit) 재시도 횟수. 기본 1회. `Retry-After`를 존중하며, 대기가 남은 예산을
   *  넘으면 기다리지 않고 즉시 실패한다(예산이 곧 사용자와의 약속이다). */
  rateLimitRetries?: number
}

// ── 오류 (사용자 문구와 서버 로그 원문을 분리한다) ─────────────────────────────

/**
 * 이 모듈이 던지는 오류의 공통 조상. `message`(+`cause`)는 **서버 로그용 원문**이고,
 * `userMessage`는 화면에 그대로 띄워도 되는 한국어 문장이다. 둘을 한 문자열로 합치면
 * 내부 주소·상태코드가 사용자에게 새거나(보안) 사용자가 못 읽는 로그가 화면에 뜬다.
 */
export class LlmError extends Error {
  readonly userMessage: string

  constructor(message: string, userMessage: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'LlmError'
    this.userMessage = userMessage
  }
}

/** 우리 예산 상한을 넘겨 중단된 호출. 숫자를 붙여 남기지 않으면 사후에 계수를 교정할 수 없다. */
export class LlmTimeoutError extends LlmError {
  readonly timeoutMs: number
  readonly elapsedMs: number
  readonly promptChars: number

  constructor(timeoutMs: number, elapsedMs: number, promptChars: number, cause?: unknown) {
    const sec = Math.round(timeoutMs / 1000)
    // 120초 미만은 초, 그 이상은 분으로 읽힌다("상한(693초)"은 사용자가 한 번에 못 읽는다).
    const label = sec >= 120 ? `${Math.round(sec / 60)}분` : `${sec}초`
    super(
      `home-m4-api /v1/chat ${timeoutMs}ms 상한 초과로 중단 — elapsed=${elapsedMs}ms promptChars=${promptChars}`,
      `AI 응답이 시간 상한(${label})을 넘겨 중단됐습니다. 잠시 후 다시 시도해 주세요.`,
      { cause },
    )
    this.name = 'LlmTimeoutError'
    this.timeoutMs = timeoutMs
    this.elapsedMs = elapsedMs
    this.promptChars = promptChars
  }
}

/** 2xx가 아닌 응답. 상태코드별로 사용자 문구를 가른다(설계안 §8 "실패 처리"). */
export class LlmHttpError extends LlmError {
  readonly status: number
  readonly retryAfterMs: number | null

  constructor(status: number, bodySnippet: string, retryAfterMs: number | null = null) {
    super(`home-m4-api /v1/chat HTTP ${status}: ${bodySnippet}`, userMessageForStatus(status), {})
    this.name = 'LlmHttpError'
    this.status = status
    this.retryAfterMs = retryAfterMs
  }
}

/** 호출 규약 위반(system 메시지 누락 등) — 사용자 입력이 아니라 코드 결함이다. */
export class LlmContractError extends LlmError {
  constructor(message: string) {
    super(message, 'AI 요청을 구성하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    this.name = 'LlmContractError'
  }
}

function userMessageForStatus(status: number): string {
  if (status === 401 || status === 403) return 'AI 서버 인증에 실패했습니다. 관리자에게 문의해 주세요.'
  if (status === 429) return 'AI 서버가 혼잡합니다. 잠시 후 다시 시도해 주세요.'
  if (status >= 500) return 'AI 서버가 일시적으로 응답하지 못했습니다. 잠시 후 다시 시도해 주세요.'
  return 'AI 요청이 거부됐습니다. 잠시 후 다시 시도해 주세요.'
}

/**
 * 어떤 오류든 화면에 띄울 한국어 한 줄로 바꾼다. **원문은 절대 여기서 반환하지 않는다** —
 * 내부 주소·스택·게이트웨이 응답이 사용자에게 새지 않도록 알 수 없는 오류는 일반 문구로
 * 뭉갠다(원문은 호출부가 `console.error`로 따로 남긴다).
 */
export function toUserMessage(err: unknown, fallback = 'AI 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'): string {
  if (err instanceof LlmError) return err.userMessage
  return fallback
}

// ── 환경 변수 ────────────────────────────────────────────────────────────────

function readBase(): string {
  const base = process.env.AI_API_BASE?.trim()
  if (!base) throw new LlmContractError('AI_API_BASE environment variable is not set')
  return base.replace(/\/+$/, '')
}

/**
 * TheKaiwa 는 키 값을 connection 의 `credentialRef`(`env:HOME_M4_API_KEY`)로만 가리킨다 — 값은 env 에만 있다.
 * facade(`engine/llm`)가 credentialRef 를 풀어 생성자로 넘기고, 이 기본값은 단독 호출(측정 스크립트)용이다.
 */
function readApiKey(): string {
  const key = process.env.HOME_M4_API_KEY?.trim()
  if (!key) throw new LlmContractError('HOME_M4_API_KEY environment variable is not set')
  return key
}

/** `AI_API_MODEL` 기본값. **추론(thinking) 모델로 바꾸지 마라** — 본문 전에 사고 과정을
 *  생성하는데 이 코드가 읽는 것은 `message.content`뿐이라 그 시간이 전부 버려진다.
 *  M4는 24GB 공유 자원이라 다른 프로젝트와 같은 상주 모델(qwen2.5:14b-instruct)로 정렬한다. */
function readDefaultModel(): string {
  return process.env.AI_API_MODEL?.trim() || 'qwen2.5:14b-instruct'
}

function readDefaultTemperature(): number {
  const raw = process.env.AI_API_TEMPERATURE
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) ? n : 0.3
}

// ── HTTP ─────────────────────────────────────────────────────────────────────

// `timeout: 0` = 소켓 유휴 타임아웃을 걸지 않는다(모듈 헤더 참고). keepAlive도 끈다 —
// LLM 호출은 간격이 길고 요청 하나가 수 분짜리라 커넥션 재사용 이득이 없다.
const httpAgent = new HttpAgent({ keepAlive: false, timeout: 0 })
const httpsAgent = new HttpsAgent({ keepAlive: false, timeout: 0 })

interface RawResponse {
  statusCode: number
  headers: Record<string, string | string[] | undefined>
  body: string
}

function sendJson(url: URL, options: RequestOptions, body: Buffer): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    let settled = false
    const fail = (e: Error) => {
      if (settled) return
      settled = true
      reject(e)
    }

    const onResponse = (res: IncomingMessage) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('error', fail)
      res.on('end', () => {
        if (settled) return
        settled = true
        resolve({
          statusCode: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        })
      })
    }

    try {
      const req = url.protocol === 'https:' ? httpsRequest(url, options, onResponse) : httpRequest(url, options, onResponse)
      req.on('error', fail)
      req.end(body)
    } catch (e) {
      fail(e as Error)
    }
  })
}

/** `Retry-After`(초 또는 HTTP-date) → ms. 해석 불가·음수면 null. 60초에서 자른다 —
 *  그보다 긴 대기는 요청 수명 안에서 의미가 없고, 잘못된 헤더 하나가 요청을 붙잡는 걸 막는다. */
export function parseRetryAfterMs(value: string | string[] | undefined, now = Date.now()): number | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return null
  const trimmed = raw.trim()
  if (/^\d+$/.test(trimmed)) {
    const ms = Number(trimmed) * 1000
    return Number.isFinite(ms) ? Math.min(Math.max(ms, 0), 60_000) : null
  }
  const at = Date.parse(trimmed)
  if (!Number.isFinite(at)) return null
  return Math.min(Math.max(at - now, 0), 60_000)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * system 메시지가 **첫 번째**인지 강제한다.
 *
 * 없으면 게이트웨이가 주식분석가 프롬프트를 자동 주입하고, 그러면 식단 프롬프트가 조용히
 * 엉뚱한 페르소나로 실행된다(VoiceVault 2026-08-27 실측). 조용히 기본 system을 끼워 넣는 대신
 * 던지는 이유는, 자동 보정이 "이 호출부는 system을 안 준다"는 사실을 감춰 프롬프트 품질
 * 문제를 영원히 못 찾게 만들기 때문이다. 호출부는 `prompts/*` 모듈에서 system을 반드시 준다.
 */
function assertSystemFirst(messages: LlmMessage[]): void {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new LlmContractError('messages가 비어 있습니다')
  }
  if (messages[0].role !== 'system') {
    throw new LlmContractError(
      'system 메시지가 첫 번째가 아닙니다 — 게이트웨이가 기본 페르소나(주식분석가)를 자동 주입한다',
    )
  }
  for (let i = 1; i < messages.length; i++) {
    if (messages[i].role === 'system') {
      throw new LlmContractError(`system 메시지는 하나여야 합니다(index ${i}에 중복)`)
    }
  }
}

// ── 클라이언트 ───────────────────────────────────────────────────────────────

export class HomeM4ApiCaller {
  constructor(
    private readonly base: string = readBase(),
    private readonly apiKey: string = readApiKey(),
    private readonly defaultModel: string = readDefaultModel(),
    private readonly defaultTemperature: number = readDefaultTemperature(),
  ) {}

  async chat(messages: LlmMessage[], opts?: LlmCallOptions): Promise<string> {
    assertSystemFirst(messages)

    const promptChars = countPromptChars(messages)
    const timeoutMs = opts?.timeoutMs ?? resolveLlmTimeoutMs(promptChars)
    const model = opts?.model ?? this.defaultModel
    const url = new URL(`${this.base}/v1/chat`)
    // `kb_collections`는 넣지 않는다(모듈 헤더 참고).
    const payload = Buffer.from(
      JSON.stringify({
        model,
        messages,
        options: { temperature: opts?.temperature ?? this.defaultTemperature },
      }),
      'utf8',
    )

    const startedAt = Date.now()
    // 예산은 재시도까지 포함한 **전체** 시간이다 — 429를 만나 기다리느라 상한을 넘기면
    // 사용자는 우리 안내 대신 nginx 504를 본다. 그래서 데드라인을 한 번만 잡는다.
    const deadline = startedAt + timeoutMs
    const maxRateLimitRetries = opts?.rateLimitRetries ?? 1

    for (let attempt = 0; ; attempt++) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) {
        throw new LlmTimeoutError(timeoutMs, Date.now() - startedAt, promptChars)
      }

      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), remaining)
      let res: RawResponse
      try {
        res = await sendJson(
          url,
          {
            method: 'POST',
            signal: ctrl.signal,
            agent: url.protocol === 'https:' ? httpsAgent : httpAgent,
            headers: {
              'content-type': 'application/json',
              'content-length': String(payload.length),
              // 실측 확정: Bearer가 아니라 X-API-Key다(Bearer → 401 missing X-API-Key header).
              'x-api-key': this.apiKey,
              accept: 'application/json',
            },
          },
          payload,
        )
      } catch (e) {
        clearTimeout(timer)
        // 우리 상한에 걸린 중단만 감싼다. 그 밖의 실패(네트워크 등)는 원본 메시지가 진단의
        // 유일한 근거라 가리지 않는다 — 사용자 문구는 `toUserMessage`가 일반 문구로 덮는다.
        if (ctrl.signal.aborted) {
          throw new LlmTimeoutError(timeoutMs, Date.now() - startedAt, promptChars, e)
        }
        throw e
      }
      clearTimeout(timer)

      if (res.statusCode === 429 && attempt < maxRateLimitRetries) {
        const retryAfterMs = parseRetryAfterMs(res.headers['retry-after'])
        // 헤더가 없으면 지수 백오프(2s, 4s). 있으면 그 값을 존중한다.
        const waitMs = retryAfterMs ?? Math.min(2000 * 2 ** attempt, 10_000)
        if (Date.now() + waitMs >= deadline) {
          throw new LlmHttpError(429, res.body.slice(0, 200), retryAfterMs)
        }
        console.warn(`[llmClient] 429 rate limit — ${waitMs}ms 대기 후 재시도(attempt=${attempt + 1})`)
        await sleep(waitMs)
        continue
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new LlmHttpError(
          res.statusCode,
          res.body.slice(0, 200),
          res.statusCode === 429 ? parseRetryAfterMs(res.headers['retry-after']) : null,
        )
      }

      let data: { message?: { content?: string } }
      try {
        data = JSON.parse(res.body) as { message?: { content?: string } }
      } catch {
        throw new LlmError(
          `home-m4-api /v1/chat 응답 JSON 파싱 실패: ${res.body.slice(0, 200)}`,
          'AI 응답을 해석하지 못했습니다. 다시 시도해 주세요.',
        )
      }

      // OpenAI 형식(`choices[0].message`)이 아니다 — 실측 응답은 최상위 `message`다.
      const content = data?.message?.content ?? ''
      if (!content) {
        throw new LlmError('empty content from home-m4-api', 'AI가 빈 응답을 보냈습니다. 다시 시도해 주세요.')
      }

      // 이 한 줄이 예산 계수를 교정할 유일한 근거다(promptChars/elapsed 쌍). 지우면 다음
      // 라운드가 다시 추측으로 돌아간다. 호출 간격이 초 단위라 호출당 한 줄은 무시할 만하다.
      console.info(
        `[llmClient] /v1/chat 완료 — model=${model} promptChars=${promptChars} ` +
          `elapsed=${Date.now() - startedAt}ms budget=${timeoutMs}ms`,
      )
      return content
    }
  }

  /** system + user 두 개짜리 단발 호출 — TheMeal의 프롬프트 모듈이 쓰는 기본형. */
  async call(system: string, user: string, opts?: LlmCallOptions): Promise<string> {
    return this.chat(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      opts,
    )
  }
}

let cachedCaller: HomeM4ApiCaller | null = null

/** 모듈 전역에서 재사용할 기본 caller — 요청마다 env를 다시 읽지 않도록 lazy 캐싱. */
function getDefaultCaller(): HomeM4ApiCaller {
  if (!cachedCaller) cachedCaller = new HomeM4ApiCaller()
  return cachedCaller
}

/** 테스트에서 env를 바꾼 뒤 캐시된 caller를 버리기 위한 훅. */
export function resetLlmClientCache(): void {
  cachedCaller = null
}

/** system + user 단발 호출. */
export function chatCompletion(system: string, user: string, opts?: LlmCallOptions): Promise<string> {
  return getDefaultCaller().call(system, user, opts)
}

/** 멀티턴 messages 호출(재시도 흐름이 assistant/user를 덧붙일 때 쓴다). */
export function chatMessages(messages: LlmMessage[], opts?: LlmCallOptions): Promise<string> {
  return getDefaultCaller().chat(messages, opts)
}
