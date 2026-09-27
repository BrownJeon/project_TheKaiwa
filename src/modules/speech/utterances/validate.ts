/**
 * 발화 입력 검증 — #21 multipart 업로드(온디바이스 경로)와 gateway internal 콜백 본문. 위반은 전부 400 VALIDATION.
 * 텍스트는 코드포인트 기준 ≤1,000자(제어문자 제거), segments ≤50, timings 는 허용 키의 숫자만.
 */
import { ApiError, codePointLength, sanitizeText } from '@/modules/infra'
import { UTTERANCE_MAX_BYTES, UTTERANCE_MAX_DURATION_MS, UTTERANCE_SEGMENTS_MAX, UTTERANCE_TEXT_MAX } from './limits'

export interface UtteranceSegment {
  segIdx?: number
  start: number
  end: number
  text: string
}
export type UtteranceTimings = Partial<Record<(typeof TIMING_KEYS)[number], number>>

export interface UploadInput {
  audio: Buffer
  text: string
  chatId: string | null
  realtimeConnectionKey: string
  durationMs: number | null
  segments: UtteranceSegment[] | null
  timings: UtteranceTimings | null
}

export interface GatewayUtteranceInput {
  userId: string
  chatId: string | null
  durationMs: number
  sampleRate: number
  audioBytes: number | null
  realtimeEngine: string
  realtimeText: string
  segments: UtteranceSegment[] | null
  timings: UtteranceTimings | null
  traceId: string | null
}

const TIMING_KEYS = ['vadMs', 'decodeMs', 'sttMs', 'uploadMs', 'storeMs', 'endpointMs'] as const
const ID = /^[A-Za-z0-9_-]{1,40}$/
/** 서버가 발급한 cuid 형식 — 저장 경로 조각으로 쓰이므로 엄격하게. */
const USER_ID = /^[a-z0-9]{20,40}$/
const CONNECTION_REF = /^[A-Za-z0-9_-]{1,80}$/
const TRACE_ID = /^t_[A-Za-z0-9]{8,40}$/

function bad(field: string, message: string, reason?: string): never {
  throw new ApiError('VALIDATION', message, { field, ...(reason ? { reason } : {}) })
}

function int(v: unknown, field: string, min: number, max: number): number {
  const n = typeof v === 'string' && /^-?\d+$/.test(v.trim()) ? Number(v) : v
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) bad(field, '숫자 범위가 올바르지 않아요.')
  return n
}

export function cleanText(v: unknown, field: string): string {
  if (typeof v !== 'string') bad(field, '텍스트가 필요해요.')
  const t = sanitizeText(v)
  if (codePointLength(t) > UTTERANCE_TEXT_MAX) bad(field, `${UTTERANCE_TEXT_MAX}자 이하로 보내 주세요.`)
  return t
}

function optionalId(v: unknown, field: string): string | null {
  if (v === undefined || v === null || v === '') return null
  if (typeof v !== 'string' || !ID.test(v)) bad(field, 'id 형식이 올바르지 않아요.')
  return v
}

function jsonField(v: unknown, field: string): unknown {
  if (v === undefined || v === null || v === '') return undefined
  if (typeof v !== 'string') return v
  if (v.length > 64 * 1024) bad(field, '값이 너무 커요.')
  try {
    return JSON.parse(v)
  } catch {
    bad(field, 'JSON 형식이 올바르지 않아요.')
  }
}

export function parseSegments(raw: unknown, field = 'segments'): UtteranceSegment[] | null {
  const v = jsonField(raw, field)
  if (v === undefined) return null
  if (!Array.isArray(v) || v.length > UTTERANCE_SEGMENTS_MAX) bad(field, `구간은 ${UTTERANCE_SEGMENTS_MAX}개 이하 배열이어야 해요.`)
  return v.map((s, i) => {
    if (!s || typeof s !== 'object' || Array.isArray(s)) bad(field, '구간 형식이 올바르지 않아요.')
    const o = s as Record<string, unknown>
    const start = int(o.start ?? o.startMs, `${field}[${i}].start`, 0, UTTERANCE_MAX_DURATION_MS * 2)
    const end = int(o.end ?? o.endMs, `${field}[${i}].end`, start, UTTERANCE_MAX_DURATION_MS * 2)
    const seg: UtteranceSegment = { start, end, text: cleanText(o.text ?? '', `${field}[${i}].text`) }
    if (o.segIdx !== undefined) seg.segIdx = int(o.segIdx, `${field}[${i}].segIdx`, 0, 1000)
    return seg
  })
}

export function parseTimings(raw: unknown, field = 'timings'): UtteranceTimings | null {
  const v = jsonField(raw, field)
  if (v === undefined) return null
  if (!v || typeof v !== 'object' || Array.isArray(v)) bad(field, '계측 값 형식이 올바르지 않아요.')
  const out: UtteranceTimings = {}
  for (const k of TIMING_KEYS) {
    const x = (v as Record<string, unknown>)[k]
    if (x === undefined || x === null) continue
    if (typeof x !== 'number' || !Number.isFinite(x) || x < 0 || x > 600_000) bad(`${field}.${k}`, '계측 값 범위가 올바르지 않아요.')
    out[k] = Math.round(x)
  }
  return out
}

/** #21 multipart. lessonId·evaluationItemId 는 Phase 2(레슨·평가) 전이라 받지 않는다(400 FEATURE_NOT_READY). */
export async function parseUploadForm(form: FormData): Promise<UploadInput> {
  for (const f of ['lessonId', 'evaluationItemId']) {
    const v = form.get(f)
    if (v !== null && v !== '') throw new ApiError('FEATURE_NOT_READY', '아직 지원하지 않는 항목이에요.', { field: f })
  }
  const audio = form.get('audio')
  if (!audio || typeof audio === 'string') bad('audio', '녹음 파일이 필요해요.')
  if (audio.size === 0) bad('audio', '녹음 파일이 비었어요.')
  if (audio.size > UTTERANCE_MAX_BYTES) bad('audio', '녹음 파일이 너무 커요.', 'TOO_LARGE')
  const key = form.get('realtimeConnectionKey')
  if (typeof key !== 'string' || !CONNECTION_REF.test(key)) bad('realtimeConnectionKey', '인식 경로 값이 올바르지 않아요.')
  const dur = form.get('durationMs')
  return {
    audio: Buffer.from(await audio.arrayBuffer()),
    text: cleanText(form.get('text') ?? '', 'text'),
    chatId: optionalId(form.get('chatId'), 'chatId'),
    realtimeConnectionKey: key,
    durationMs: dur === null || dur === '' ? null : int(dur, 'durationMs', 0, UTTERANCE_MAX_DURATION_MS * 2),
    segments: parseSegments(form.get('segments')),
    timings: parseTimings(form.get('timings')),
  }
}

/** gateway → 앱 internal 콜백 본문(JSON). 경로 필드(tmpPath 등)는 받아도 쓰지 않는다 — 저장 경로는 앱이 정한다. */
export function parseGatewayBody(b: Record<string, unknown>): GatewayUtteranceInput {
  if (typeof b.userId !== 'string' || !USER_ID.test(b.userId)) bad('userId', 'userId 형식이 올바르지 않아요.')
  if (typeof b.realtimeEngine !== 'string' || !CONNECTION_REF.test(b.realtimeEngine)) bad('realtimeEngine', '인식 경로 값이 올바르지 않아요.')
  const sampleRate = b.sampleRate === undefined ? 16_000 : int(b.sampleRate, 'sampleRate', 16_000, 16_000)
  const audioBytes = b.audioBytes === undefined || b.audioBytes === null ? null : int(b.audioBytes, 'audioBytes', 0, UTTERANCE_MAX_BYTES)
  const traceId = b.traceId === undefined || b.traceId === null ? null : typeof b.traceId === 'string' && TRACE_ID.test(b.traceId) ? b.traceId : bad('traceId', 'traceId 형식이 올바르지 않아요.')
  return {
    userId: b.userId,
    chatId: optionalId(b.chatId, 'chatId'),
    durationMs: int(b.durationMs, 'durationMs', 0, UTTERANCE_MAX_DURATION_MS + 5_000),
    sampleRate,
    audioBytes,
    realtimeEngine: b.realtimeEngine,
    realtimeText: cleanText(b.realtimeText ?? '', 'realtimeText'),
    segments: parseSegments(b.segments),
    timings: parseTimings(b.timings),
    traceId,
  }
}
