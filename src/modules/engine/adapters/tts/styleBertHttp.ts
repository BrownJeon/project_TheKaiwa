/**
 * Style-Bert-VITS2 HTTP 어댑터 — 맥 M4 `speech/tts-service`(style_bert_vits2 위 자체 FastAPI) `POST /synthesize` 호출.
 * 엔진 고유 값(모델·화자 id·sdpRatio/noise/noiseW)을 아는 **유일한 앱 코드**다(speech-platform/16 §1.1, module-dependency §11).
 *
 * 계약(developer A, task-003d `### A(M4 tts-service)`):
 *   → { text(≤100), voice{model, speaker, style, styleWeight}, controls{speed, pitch, intonation}, engine{sdpRatio, noise, noiseW}, profile, traceId }
 *     헤더 X-Internal-Secret(= 앱 env TTS_SERVICE_SECRET, 상수시간 비교; 없음·불일치 401)
 *   ← audio/wav + X-Kaiwa-{Queue,Synth,Encode,Audio}-Ms · X-Kaiwa-Style-Fallback · X-Trace-Id(echo)
 *     오류 JSON {error:{code,message}}: 400 TEXT_*·UNKNOWN_MODEL·UNKNOWN_SPEAKER / 401 / 413 / 503 NOT_READY·BUSY(+Retry-After) / 500 SYNTH_FAILED
 *
 * 발음 사전(방식 A): 이 래퍼는 사용자 사전 입력이 없어 **플랫폼 치환**으로 강등한다 — 매칭 표기를 가타카나 읽기로 바꿔 보낸다
 * (읽기 보존, 악센트는 엔진 g2p 에 맡김, speech-platform/16 §2.4). 치환 뒤 길이가 상한을 넘으면 보내지 않는다.
 *
 * 보안: 주소는 Effective 설정(DB·서버 env)에서만 온다(요청 본문 URL 없음). http(s)·자격증명 없는 URL 만, 리다이렉트 미추종,
 * 응답 상한 8MB, 오류 본문은 4KB 까지만 읽어 `error.code` 만 쓴다. 시크릿·문장은 예외 메시지·로그에 싣지 않는다.
 */
import { readServiceSecret } from '@/modules/infra'
import type { ConnectionProfile, TtsLexiconHint, TtsSegmentInput, TtsSynthOutput, TtsVoiceRef } from '../../registry/types'
import { TtsEngineError } from '../../tts/errors'
import { healthUrl } from '../common/httpHealth'

const MAX_AUDIO_BYTES = 8 * 1024 * 1024
const MAX_ERROR_BYTES = 4 * 1024
export const DEFAULT_MAX_CHARS = 100

function numberValue(values: Record<string, unknown>, key: string, fallback: number): number {
  const v = values[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

export function maxCharsOf(values: Record<string, unknown>): number {
  return Math.min(DEFAULT_MAX_CHARS, Math.max(1, Math.trunc(numberValue(values, 'runtime.maxChars', DEFAULT_MAX_CHARS))))
}

/** 표기 → 가타카나 읽기 치환(왼쪽부터 최장 일치 — L4 매칭과 같은 규칙). */
export function substituteReadings(text: string, hints: readonly TtsLexiconHint[]): string {
  if (hints.length === 0) return text
  const sorted = [...new Map(hints.map((h) => [h.surface, h])).values()].sort((a, b) => b.surface.length - a.surface.length)
  let out = ''
  for (let i = 0; i < text.length; ) {
    const h = sorted.find((x) => x.surface.length > 0 && text.startsWith(x.surface, i))
    if (h) {
      out += h.reading
      i += h.surface.length
    } else out += text[i++]
  }
  return out
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

export async function synthesizeHttp(profile: ConnectionProfile, voice: TtsVoiceRef, seg: TtsSegmentInput, opts: { traceId: string; timeoutMs: number }): Promise<TtsSynthOutput> {
  const url = healthUrl(profile.values['connection.baseUrl'], '/synthesize')
  if (!url) throw new TtsEngineError('MISCONFIGURED', 'BAD_BASE_URL')
  const secret = readServiceSecret('TTS_SERVICE_SECRET')
  if (!secret) throw new TtsEngineError('MISCONFIGURED', 'SECRET_MISSING')
  const text = substituteReadings(seg.text, seg.lexiconHints)
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
  const timeoutMs = Math.min(opts.timeoutMs, numberValue(profile.values, 'connection.timeoutMs', opts.timeoutMs))
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
  return {
    audio,
    metrics: {
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
