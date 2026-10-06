/**
 * Style-Bert-VITS2 HTTP 어댑터 — 맥 M4 `speech/tts-service`(style_bert_vits2 위 자체 FastAPI) `POST /synthesize` 호출.
 * 엔진 고유 값(모델·화자 id·sdpRatio/noise/noiseW)을 아는 **유일한 앱 코드**다(speech-platform/16 §1.1, module-dependency §11).
 *
 * 계약(developer A, task-003d `### A(M4 tts-service)`):
 *   → { text(≤100), voice{model, speaker, style, styleWeight}, controls{speed, pitch, intonation}, engine{sdpRatio, noise, noiseW}, profile, traceId }
 *     헤더 X-Internal-Secret(= 앱 env TTS_SERVICE_SECRET, 상수시간 비교; 없음·불일치 401)
 *   ← audio/wav + X-Kaiwa-{Queue,Synth,Encode,Audio}-Ms · X-Kaiwa-Style-Fallback · X-Trace-Id(echo)
 *     + (0.4.0, task-012b-4) X-Kaiwa-Timing 상태 · X-Tts-Timing(단어 timing, 보낸 글 코드포인트) · X-Kaiwa-Timing-Ms — `readTimingHeaders`.
 *       요청은 바꾸지 않는다(서비스가 모르는 키를 400 으로 거부). 헤더가 없거나 틀리면 timing=null, 합성은 그대로 성공.
 *     오류 JSON {error:{code,message}}: 400 TEXT_*·UNKNOWN_MODEL·UNKNOWN_SPEAKER / 401 / 413 / 503 NOT_READY·BUSY(+Retry-After) / 500 SYNTH_FAILED
 *
 * 발음 사전(방식 A): 이 래퍼는 사용자 사전 입력이 없어 **플랫폼 치환**으로 강등한다 — 매칭 표기를 가타카나 읽기로 바꿔 보낸다
 * (읽기 보존, 악센트는 엔진 g2p 에 맡김, speech-platform/16 §2.4). 치환 뒤 길이가 상한을 넘으면 보내지 않는다.
 *
 * 보안: 주소는 Effective 설정(DB·서버 env)에서만 온다(요청 본문 URL 없음). http(s)·자격증명 없는 URL 만, 리다이렉트 미추종,
 * 응답 상한 8MB, 오류 본문은 4KB 까지만 읽어 `error.code` 만 쓴다. 시크릿·문장은 예외 메시지·로그에 싣지 않는다.
 * **시크릿 전송 대상 고정(Codex C2 Finding 1)**: `TTS_SERVICE_SECRET` 은 서버 env `TTS_SERVICE_URL` 과 origin 이 정확히 같은 주소에만
 * 보낸다(`infra.readServiceSecretFor`). DB·Effective baseUrl 의 origin 이 다르거나 env 가 비면 **호출 자체를 하지 않고** MISCONFIGURED.
 */
import { readServiceSecretFor } from '@/modules/infra'
import type { ConnectionProfile, HealthDetail, TtsG2pOutput, TtsLexiconHint, TtsSegmentInput, TtsSynthOutput, TtsTimingOutput, TtsVoiceRef } from '../../registry/types'
import { TtsEngineError } from '../../tts/errors'
import { checkTimingWords, identityUnitMap, projectTimingWords, type TextUnitMap } from '../../tts/timing'
import { healthUrl, pickCommonDetail } from '../common/httpHealth'

const MAX_AUDIO_BYTES = 8 * 1024 * 1024
const MAX_ERROR_BYTES = 4 * 1024
export const DEFAULT_MAX_CHARS = 100

function numberValue(values: Record<string, unknown>, key: string, fallback: number): number {
  const v = values[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/** 합성 요청 한 건의 제한 시간 = min(호출자 예산, 연결 `connection.timeoutMs`) — 콘솔 값은 상한으로만 쓰인다(문장 1건은 8s fail-fast). */
export function requestTimeoutMs(values: Record<string, unknown>, budgetMs: number): number {
  return Math.min(budgetMs, numberValue(values, 'connection.timeoutMs', budgetMs))
}

export function maxCharsOf(values: Record<string, unknown>): number {
  return Math.min(DEFAULT_MAX_CHARS, Math.max(1, Math.trunc(numberValue(values, 'runtime.maxChars', DEFAULT_MAX_CHARS))))
}

/**
 * 표기 → 가타카나 읽기 치환(왼쪽부터 최장 일치 — L4 매칭과 같은 규칙) + 보낸 글의 코드 유닛별 원래 구간(timing 좌표 되돌리기용).
 * 읽기로 바뀐 글자는 그 표기 전체를 가리킨다.
 */
export function substituteReadingsMapped(text: string, hints: readonly TtsLexiconHint[]): TextUnitMap {
  if (hints.length === 0) return identityUnitMap(text)
  const sorted = [...new Map(hints.map((h) => [h.surface, h])).values()].sort((a, b) => b.surface.length - a.surface.length)
  let out = ''
  const start: number[] = []
  const end: number[] = []
  for (let i = 0; i < text.length; ) {
    const h = sorted.find((x) => x.surface.length > 0 && text.startsWith(x.surface, i))
    if (h) {
      out += h.reading
      for (let k = 0; k < h.reading.length; k++) {
        start.push(i)
        end.push(i + h.surface.length)
      }
      i += h.surface.length
    } else {
      out += text[i]
      start.push(i)
      end.push(i + 1)
      i++
    }
  }
  return { derived: out, source: text, start, end }
}

/** 표기 → 가타카나 읽기 치환(왼쪽부터 최장 일치 — L4 매칭과 같은 규칙). */
export function substituteReadings(text: string, hints: readonly TtsLexiconHint[]): string {
  return substituteReadingsMapped(text, hints).derived
}

function networkCode(e: unknown): string {
  const err = e as { name?: string; code?: string; cause?: { code?: string } }
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return 'ETIMEDOUT'
  const code = err?.cause?.code ?? err?.code
  return typeof code === 'string' && /^E[A-Z]{2,20}$/.test(code) ? code : 'NETWORK_ERROR'
}

async function readCapped(res: Response, cap: number): Promise<Buffer | null> {
  if (!res.body) return Buffer.alloc(0)
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > cap) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

async function errorCode(res: Response): Promise<string> {
  const buf = await readCapped(res, MAX_ERROR_BYTES).catch(() => null)
  if (!buf) return ''
  try {
    const j = JSON.parse(buf.toString('utf8')) as { error?: { code?: unknown }; code?: unknown }
    const code = j?.error?.code ?? j?.code
    return typeof code === 'string' && /^[A-Z][A-Z0-9_]{1,40}$/.test(code) ? code : ''
  } catch {
    return ''
  }
}

function headerMs(res: Response, ...names: string[]): number | null {
  for (const n of names) {
    const v = res.headers.get(n)
    if (v !== null && /^\d{1,9}$/.test(v.trim())) return Number(v.trim())
  }
  return null
}

function isWav(buf: Buffer): boolean {
  return buf.length >= 44 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE'
}

/** 서비스 timing 헤더 상한(서비스 README §2 `MAX_HEADER_BYTES`). */
export const TIMING_HEADER_MAX = 4096
const TIMING_METHODS = new Set(['ENGINE_DURATION', 'FORCED_ALIGN'])
const TIMING_VERSION = /^[\w.:-]{1,40}$/
/**
 * 서비스 `X-Kaiwa-Timing` 값(README §2, 0.4.0 — `too_long` 은 REV-130 L-1 로 추가). `ok` 밖은 전부 timing=null 이고 Trace 상태는 대문자로,
 * 이 목록에 없는 값은 `UNKNOWN`(Trace 값 종류를 닫아 둔다 — 서비스가 새 사유를 내면 여기에 더한다).
 */
const ENGINE_TIMING_STATES = new Set(['unavailable', 'token_mismatch', 'frame_mismatch', 'word_mismatch', 'text_mismatch', 'empty', 'too_large', 'too_long', 'error'])
const B64URL = /^[A-Za-z0-9_-]+$/

export interface TimingRead {
  timing: TtsTimingOutput | null
  status: string
  ms: number | null
}

/**
 * 서비스 0.4.0 응답 헤더(`X-Kaiwa-Timing` 상태 · `X-Tts-Timing` base64url JSON · `X-Kaiwa-Timing-Ms`) → 엔진 중립 timing.
 * 서비스 좌표는 **보낸 글**(사전 치환 뒤)의 코드포인트 — `sent` 지도로 받은 세그먼트 글 좌표로 되돌린다.
 * 상태가 ok 가 아니거나·헤더가 없거나(구 서비스)·형식/범위가 하나라도 틀리면 timing=null 이고 합성은 성공 그대로다(오류를 만들지 않는다).
 */
export function readTimingHeaders(headers: Headers, sent: TextUnitMap): TimingRead {
  const msRaw = headers.get('x-kaiwa-timing-ms')?.trim() ?? ''
  const ms = /^\d{1,6}(\.\d{1,3})?$/.test(msRaw) ? Number(msRaw) : null
  const state = headers.get('x-kaiwa-timing')?.trim().toLowerCase() ?? null
  if (state === null) return { timing: null, status: 'ABSENT', ms }
  if (state !== 'ok') return { timing: null, status: ENGINE_TIMING_STATES.has(state) ? state.toUpperCase() : 'UNKNOWN', ms }
  const invalid: TimingRead = { timing: null, status: 'INVALID', ms }
  const value = headers.get('x-tts-timing')?.trim() ?? ''
  if (!value || value.length > TIMING_HEADER_MAX || !B64URL.test(value)) return invalid
  let j: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return invalid
    j = parsed as Record<string, unknown>
  } catch {
    return invalid
  }
  const { v, method, alignerVersion, coord, durationMs } = j
  if (v !== 1 || coord !== 'codepoint' || typeof method !== 'string' || !TIMING_METHODS.has(method)) return invalid
  if (typeof alignerVersion !== 'string' || !TIMING_VERSION.test(alignerVersion)) return invalid
  if (typeof durationMs !== 'number' || !Number.isSafeInteger(durationMs) || durationMs <= 0) return invalid
  const words = checkTimingWords(j.words, { textCodePoints: [...sent.derived].length, durationMs })
  const back = words && projectTimingWords(words, sent)
  if (!back) return invalid
  return { timing: { method: method as TtsTimingOutput['method'], version: alignerVersion, durationMs, words: back }, status: 'OK', ms }
}

export async function synthesizeHttp(profile: ConnectionProfile, voice: TtsVoiceRef, seg: TtsSegmentInput, opts: { traceId: string; timeoutMs: number }): Promise<TtsSynthOutput> {
  const url = healthUrl(profile.values['connection.baseUrl'], '/synthesize')
  if (!url) throw new TtsEngineError('MISCONFIGURED', 'BAD_BASE_URL')
  const grant = readServiceSecretFor('TTS_SERVICE_SECRET', url)
  if (!grant.ok) throw new TtsEngineError('MISCONFIGURED', grant.reason)
  const secret = grant.secret
  const sent = substituteReadingsMapped(seg.text, seg.lexiconHints)
  const text = sent.derived
  if ([...text].length > maxCharsOf(profile.values)) throw new TtsEngineError('TEXT_TOO_LONG', 'TEXT_TOO_LONG')

  const body = {
    text,
    voice: { model: voice.model, speaker: voice.speakerId ?? 0, style: seg.style, styleWeight: seg.styleWeight },
    controls: { speed: seg.speed, pitch: seg.pitch, intonation: seg.intonation },
    engine: {
      sdpRatio: numberValue(profile.values, 'runtime.sdpRatio', 0.2),
      noise: numberValue(profile.values, 'runtime.noise', 0.6),
      noiseW: numberValue(profile.values, 'runtime.noiseW', 0.8),
    },
    profile: seg.speechProfile,
    traceId: opts.traceId,
  }
  const timeoutMs = requestTimeoutMs(profile.values, opts.timeoutMs)
  const startedAt = Date.now()
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'content-type': 'application/json', accept: 'audio/wav', 'x-internal-secret': secret },
      body: JSON.stringify(body),
    })
  } catch (e) {
    const code = networkCode(e)
    throw new TtsEngineError(code === 'ETIMEDOUT' ? 'TIMEOUT' : 'UNAVAILABLE', code)
  }

  if (res.status !== 200) {
    const code = await errorCode(res)
    const retry = Number(res.headers.get('retry-after'))
    const retryAfterSec = Number.isFinite(retry) && retry > 0 ? Math.min(60, Math.ceil(retry)) : undefined
    if (res.status === 401 || res.status === 403) throw new TtsEngineError('MISCONFIGURED', `HTTP_${res.status}`)
    if (res.status === 413 || code === 'TEXT_TOO_LONG') throw new TtsEngineError('TEXT_TOO_LONG', code || `HTTP_${res.status}`)
    if (res.status === 503 || res.status === 502 || res.status === 504) throw new TtsEngineError('UNAVAILABLE', code || `HTTP_${res.status}`, retryAfterSec)
    if (res.status >= 400 && res.status < 500) throw new TtsEngineError('REJECTED', code || `HTTP_${res.status}`)
    throw new TtsEngineError('ENGINE_ERROR', code || `HTTP_${res.status}`)
  }
  let audio: Buffer | null
  try {
    audio = await readCapped(res, MAX_AUDIO_BYTES)
  } catch (e) {
    const code = networkCode(e)
    throw new TtsEngineError(code === 'ETIMEDOUT' ? 'TIMEOUT' : 'UNAVAILABLE', code)
  }
  if (!audio || !isWav(audio)) throw new TtsEngineError('BAD_AUDIO', audio ? 'NOT_WAV' : 'TOO_LARGE')
  let t: TimingRead
  try {
    t = readTimingHeaders(res.headers, sent)
  } catch {
    t = { timing: null, status: 'INVALID', ms: null }
  }
  return {
    audio,
    timing: t.timing,
    metrics: {
      timingStatus: t.status,
      timingMs: t.ms,
      httpMs: Date.now() - startedAt,
      synthMs: headerMs(res, 'x-kaiwa-synth-ms', 'x-synth-ms'),
      queueMs: headerMs(res, 'x-kaiwa-queue-ms', 'x-queue-ms'),
      encodeMs: headerMs(res, 'x-kaiwa-encode-ms', 'x-encode-ms'),
      audioMs: headerMs(res, 'x-kaiwa-audio-ms', 'x-audio-ms'),
      modelLoadMs: headerMs(res, 'x-kaiwa-model-load-ms', 'x-model-load-ms'),
      modelLoaded: ((v) => (v === 'hit' || v === 'cold' ? v : null))(res.headers.get('x-model-loaded')),
      styleFallback: res.headers.get('x-kaiwa-style-fallback') === '1',
    },
  }
}

/** 서비스 `/g2p` 입력 상한(README §2) — 치환 뒤 길이 기준. */
export const G2P_MAX_CHARS = 200
const MAX_G2P_BYTES = 64 * 1024
const G2P_TEXT = /^[^\u0000-\u001f\u007f]{0,2000}$/

/**
 * 읽기 확인(`POST /g2p {text}` → `{normalizedText, reading, accent}`) — 발음 사전 미리듣기(task-003g). 합성과 같은 방식으로
 * 사전 힌트를 표기→가타카나 치환한 뒤 보낸다(엔진이 실제로 읽을 모양). 시크릿 전송·리다이렉트·응답 상한 규칙은 합성과 같다.
 * 응답 문자열은 제어문자 없는 2,000자 이하만 받는다(그 밖은 BAD_AUDIO 가 아니라 ENGINE_ERROR).
 */
export async function g2pHttp(profile: ConnectionProfile, text: string, hints: readonly TtsLexiconHint[], opts: { timeoutMs: number }): Promise<TtsG2pOutput> {
  const url = healthUrl(profile.values['connection.baseUrl'], '/g2p')
  if (!url) throw new TtsEngineError('MISCONFIGURED', 'BAD_BASE_URL')
  const grant = readServiceSecretFor('TTS_SERVICE_SECRET', url)
  if (!grant.ok) throw new TtsEngineError('MISCONFIGURED', grant.reason)
  const body = substituteReadings(text, hints)
  if ([...body].length > G2P_MAX_CHARS) throw new TtsEngineError('TEXT_TOO_LONG', 'TEXT_TOO_LONG')
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(opts.timeoutMs),
      headers: { 'content-type': 'application/json', accept: 'application/json', 'x-internal-secret': grant.secret },
      body: JSON.stringify({ text: body }),
    })
  } catch (e) {
    const code = networkCode(e)
    throw new TtsEngineError(code === 'ETIMEDOUT' ? 'TIMEOUT' : 'UNAVAILABLE', code)
  }
  if (res.status !== 200) {
    const code = await errorCode(res)
    if (res.status === 401 || res.status === 403) throw new TtsEngineError('MISCONFIGURED', `HTTP_${res.status}`)
    if (res.status === 413 || code === 'TEXT_TOO_LONG') throw new TtsEngineError('TEXT_TOO_LONG', code || `HTTP_${res.status}`)
    if (res.status === 503 || res.status === 502 || res.status === 504) throw new TtsEngineError('UNAVAILABLE', code || `HTTP_${res.status}`)
    if (res.status >= 400 && res.status < 500) throw new TtsEngineError('REJECTED', code || `HTTP_${res.status}`)
    throw new TtsEngineError('ENGINE_ERROR', code || `HTTP_${res.status}`)
  }
  let json: unknown
  try {
    const buf = await readCapped(res, MAX_G2P_BYTES)
    if (!buf) throw new TtsEngineError('ENGINE_ERROR', 'G2P_TOO_LARGE')
    json = JSON.parse(buf.toString('utf8'))
  } catch (e) {
    if (e instanceof TtsEngineError) throw e
    const code = networkCode(e)
    throw new TtsEngineError(code === 'ETIMEDOUT' ? 'TIMEOUT' : 'ENGINE_ERROR', code === 'NETWORK_ERROR' ? 'G2P_BAD_JSON' : code)
  }
  const j = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' && G2P_TEXT.test(v) ? v : null)
  const normalizedText = str(j.normalizedText)
  const reading = str(j.reading)
  const accent = str(j.accent)
  if (normalizedText === null || reading === null || accent === null) throw new TtsEngineError('ENGINE_ERROR', 'G2P_BAD_SHAPE')
  return { normalizedText, reading, accent }
}

/**
 * 관리자 Health 상세(`GET /health/detail`, 시크릿 필요) — device·모델 수·메모리·버전. 공개 `/health` 는 liveness 만 준다(Codex C2 Finding 3).
 * 시크릿 전송 규칙은 합성과 같다(허용 origin 만). 404(배포 전 서비스)·401·네트워크 오류는 null — 상세 없이 공개 판정만 쓴다.
 * 결과는 화이트리스트 필드(숫자·짧은 식별자)만.
 */
export async function fetchHealthDetail(profile: ConnectionProfile, timeoutMs = 3_000): Promise<HealthDetail | null> {
  const url = healthUrl(profile.values['connection.baseUrl'], '/health/detail')
  if (!url) return null
  const grant = readServiceSecretFor('TTS_SERVICE_SECRET', url)
  if (!grant.ok) return null
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json', 'x-internal-secret': grant.secret } })
    if (res.status !== 200) {
      await res.body?.cancel().catch(() => undefined)
      return null
    }
    const buf = await readCapped(res, 64 * 1024)
    if (!buf) return null
    const json = JSON.parse(buf.toString('utf8')) as unknown
    if (!json || typeof json !== 'object' || Array.isArray(json)) return null
    const j = json as Record<string, unknown>
    const d = pickCommonDetail(j)
    if (typeof j.modelsLoaded === 'number' && Number.isFinite(j.modelsLoaded)) d.models = Math.trunc(j.modelsLoaded)
    return d
  } catch {
    return null
  }
}
