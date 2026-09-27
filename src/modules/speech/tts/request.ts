/**
 * `POST /api/v1/speech/tts`(#23) 본문 검증 — 순수 함수. 화이트리스트 밖 키·엔진 파라미터는 400.
 * 클라이언트·LLM 은 엔진 수치(speed·pitch·styleWeight·speaker·model…)를 직접 줄 수 없다(§4.4) — 라벨(enum)과 쉼(ms)만 신뢰한다.
 */
import { ApiError, codePointLength, sanitizeText } from '@/modules/infra'
import { isSpeechProfile, type SpeechProfileName } from './profiles'
import type { RequestedLabels } from './renderingPlan'
import { LLM_SPEECH_STYLES, SEGMENT_SPEEDS, SEGMENT_STYLES, type LlmSpeechStyle, type SegmentSpeed, type SegmentStyle } from './types'

export const TTS_TEXT_MAX = 100

const TOP_KEYS = ['text', 'voiceId', 'speechProfile', 'renderingPlan', 'chatMessageId', 'context'] as const
const CONTEXT_KEYS = ['sentenceIdx', 'styleHint', 'lessonId', 'topicId'] as const
/** 요청 renderingPlan 에서 읽는 키 — 나머지(base·수치)는 서버가 다시 계산하므로 무시한다. */
const PLAN_KEYS = ['planVersion', 'voiceId', 'speechProfile', 'base', 'segments'] as const
const SEGMENT_KEYS = ['index', 'text', 'normalizedText', 'style', 'speed', 'pauseBeforeMs'] as const
/** 엔진 수치를 직접 주려는 시도 — 알아보기 쉽게 따로 거부한다. */
const ENGINE_KEYS = new Set(['speaker', 'speakerId', 'model', 'modelName', 'voiceModelId', 'pitch', 'pitchScale', 'intonation', 'intonationScale', 'styleWeight', 'style', 'speed', 'length', 'sdpRatio', 'noise', 'noiseW', 'connectionKey', 'connectionId'])

export interface TtsRequest {
  text: string
  voiceId: string | null
  speechProfile: SpeechProfileName | null
  requested: RequestedLabels | null
  styleHint: LlmSpeechStyle | null
  lessonId: string | null
  topicId: string | null
}

const bad = (field: string, reason: string, message: string): never => {
  throw new ApiError('VALIDATION', message, { field, reason })
}

function onlyKeys(o: Record<string, unknown>, allowed: readonly string[], where: string): void {
  for (const k of Object.keys(o)) {
    if (allowed.includes(k)) continue
    if (ENGINE_KEYS.has(k)) bad(`${where}${k}`, 'engine_param', '목소리 수치는 직접 지정할 수 없어요. 설정 화면에서 바꿔 주세요.')
    bad(`${where}${k}`, 'unknown_key', `지원하지 않는 항목입니다: ${k}`)
  }
}

function optionalId(v: unknown, field: string): string | null {
  if (v === undefined || v === null) return null
  if (typeof v !== 'string' || v.length === 0 || v.length > 80 || !/^[\w-]+$/.test(v)) return bad(field, 'id', `${field} 형식이 올바르지 않습니다.`)
  return v
}

function oneOf<T extends string>(v: unknown, field: string, values: readonly T[]): T | null {
  if (v === undefined || v === null) return null
  if (typeof v !== 'string' || !(values as readonly string[]).includes(v)) return bad(field, values.join('|'), `${field} 값이 올바르지 않습니다.`)
  return v as T
}

function obj(v: unknown, field: string): Record<string, unknown> | null {
  if (v === undefined || v === null) return null
  if (typeof v !== 'object' || Array.isArray(v)) return bad(field, 'object', `${field} 형식이 올바르지 않습니다.`)
  return v as Record<string, unknown>
}

function parseLabels(planRaw: unknown): RequestedLabels | null {
  const plan = obj(planRaw, 'renderingPlan')
  if (!plan) return null
  onlyKeys(plan, PLAN_KEYS, 'renderingPlan.')
  const segs = plan.segments
  if (segs === undefined || segs === null) return null
  if (!Array.isArray(segs) || segs.length > 1) return bad('renderingPlan.segments', 'single', '이 경로는 세그먼트 1개만 받아요.')
  if (segs.length === 0) return null
  const seg = obj(segs[0], 'renderingPlan.segments[0]')!
  onlyKeys(seg, SEGMENT_KEYS, 'renderingPlan.segments[0].')
  const style = oneOf<SegmentStyle>(seg.style, 'renderingPlan.segments[0].style', SEGMENT_STYLES)
  const speed = oneOf<SegmentSpeed>(seg.speed, 'renderingPlan.segments[0].speed', SEGMENT_SPEEDS)
  let pauseBeforeMs: number | undefined
  if (seg.pauseBeforeMs !== undefined && seg.pauseBeforeMs !== null) {
    const p = seg.pauseBeforeMs
    if (typeof p !== 'number' || !Number.isInteger(p) || p < 0 || p > 2000) bad('renderingPlan.segments[0].pauseBeforeMs', '0~2000', '쉼은 0~2000ms 정수여야 해요.')
    pauseBeforeMs = p as number
  }
  return { ...(style ? { style } : {}), ...(speed ? { speed } : {}), ...(pauseBeforeMs !== undefined ? { pauseBeforeMs } : {}) }
}

export function parseTtsRequest(body: Record<string, unknown>): TtsRequest {
  onlyKeys(body, TOP_KEYS, '')
  if (typeof body.text !== 'string') return bad('text', 'string', '읽을 문장을 보내 주세요.')
  const text = sanitizeText(body.text)
  const len = codePointLength(text)
  if (len === 0) bad('text', 'empty', '읽을 문장을 보내 주세요.')
  if (len > TTS_TEXT_MAX) bad('text', `length ≤${TTS_TEXT_MAX}`, `문장은 ${TTS_TEXT_MAX}자 이내로 나눠 보내 주세요.`)
  const speechProfile = body.speechProfile === undefined || body.speechProfile === null ? null : isSpeechProfile(body.speechProfile) ? body.speechProfile : bad('speechProfile', 'enum', 'speechProfile 값이 올바르지 않습니다.')
  optionalId(body.chatMessageId, 'chatMessageId')
  const ctx = obj(body.context, 'context')
  if (ctx) onlyKeys(ctx, CONTEXT_KEYS, 'context.')
  if (ctx?.sentenceIdx !== undefined && ctx.sentenceIdx !== null && (typeof ctx.sentenceIdx !== 'number' || !Number.isInteger(ctx.sentenceIdx) || ctx.sentenceIdx < 0 || ctx.sentenceIdx > 50)) bad('context.sentenceIdx', '0~50', 'sentenceIdx 값이 올바르지 않습니다.')
  return {
    text,
    voiceId: optionalId(body.voiceId, 'voiceId'),
    speechProfile,
    requested: parseLabels(body.renderingPlan),
    styleHint: oneOf<LlmSpeechStyle>(ctx?.styleHint, 'context.styleHint', LLM_SPEECH_STYLES),
    lessonId: optionalId(ctx?.lessonId, 'context.lessonId'),
    topicId: optionalId(ctx?.topicId, 'context.topicId'),
  }
}
