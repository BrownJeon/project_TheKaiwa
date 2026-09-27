/**
 * 문장 1개 합성(api-contract #23 · #18 미리듣기 공용) — speech-platform/16 §1.3 파이프라인:
 *   원문 → 사전 매칭(보호 구간) → 정규화 → Rendering Plan(Resolver base + 라벨·프로필 배율) → 캐시 키(12요소)
 *   → HIT: 파일 그대로 / MISS: 상태 확인(서킷) → engine.tts(어댑터가 엔진 파라미터로 변환) → WAV 검증 → 캐시 저장
 * 단일 세그먼트·동기 응답이다(여러 문장·청크 스트리밍은 task-007). LLM 호출 없음.
 * Trace 는 단계별 ms 와 허용 meta 만(본문·읽기·오디오 없음), 기록 실패가 응답을 막지 않는다.
 */
import type { SpeechProfile } from '@prisma/client'
import { currentEnvironment, newTraceId, recordTrace, tts, type TraceStep, type TtsFailureKind, type TtsLexiconHint, type TtsSynthOutput, type TtsTarget } from '@/modules/engine'
import { codePointLength } from '@/modules/infra'
import { getAppSetting, getVoiceSettingForTts } from '@/modules/preferences'
import { loadTtsVoice, type TtsVoice } from '../voices/registry'
import { isCacheKey, readCachedAudio, storeCachedAudio, TTS_TEXT_VERSION, ttsCacheKey, type CacheKeyParts, type CachedAudio } from './cache'
import { createSingleFlight } from './singleFlight'
import { TtsRequestError, TtsUnavailableError } from './errors'
import { lexiconDigest, loadActiveLexicon, selectEntries } from './lexicon'
import { stopwatch, synthSteps, ttsStep } from './metrics'
import { resolveTtsParameters, type UserVoiceInput } from './parameterResolver'
import { isSpeechProfile, PROFILE_POLICIES, type SpeechProfileName } from './profiles'
import { buildRenderingPlan, prepareSegments, type RequestedLabels } from './renderingPlan'
import { assessAvailability, breakerOpen, recordSynthFailure, recordSynthSuccess } from './status'
import { SEGMENT_STYLES, type LlmSpeechStyle, type SegmentStyle } from './types'
import { rememberRecentAudio } from './recentAudio'
import { wavInfo } from './wav'

/** 단일 합성 경로의 세그먼트 상한(서비스 상한과 같다). 연결 설정이 더 작으면 어댑터가 한 번 더 막는다. */
export const TTS_SEGMENT_MAX_CHARS = 100
/** 문장 1건 fail-fast(api-contract §0-5 "TTS 문장 8s"). */
export const TTS_SENTENCE_TIMEOUT_MS = 8_000

export interface SynthesizeInput {
  userId: string
  text: string
  /** 없으면 사용자 설정 → AppSetting voice.default.profileId. 명시했는데 선택 불가면 400. */
  voiceId?: string | null
  /** 화면 문맥 > 사용자 설정(§5). */
  speechProfile?: SpeechProfileName | null
  /** 미리듣기: 저장 전 draft 가 사용자 설정 층을 대신한다. */
  draft?: UserVoiceInput | null
  requested?: RequestedLabels | null
  styleHint?: LlmSpeechStyle | null
  scope?: { lessonId?: string | null; topicId?: string | null }
  textVersion?: number
  /** Resolver 4순위(대화 문맥). 없으면 미리듣기 PREVIEW·그 밖 TTS. 회화 턴은 TALK. */
  contextMode?: 'TALK' | 'LESSON_READ' | 'REVIEW' | 'PREVIEW' | 'EVAL' | 'TTS'
  /** 여러 청크 중 몇 번째인가(task-007 턴 청크). Trace 단계 첨자와 청크 앞 간격(`pauseBeforeMs`)에 쓴다. */
  chunk?: { index: number; previousDurationMs?: number | null }
  /** `record:false` 면 이 함수가 Trace 를 따로 남기지 않고 `steps` 만 돌려준다(턴 Trace 가 합친다). */
  trace: { refType: string; refId?: string | null; record?: boolean }
}

export interface SynthesizeResult {
  audio: Buffer
  cached: boolean
  durationMs: number | null
  ttfaMs: number
  traceId: string
  normalizedText: string
  dictionaryVersion: number
  modelVersion: string
  /** 12요소 캐시 키(#24 서명 URL 의 대상). */
  cacheKey: string
  /** 이 청크 앞 재생 간격(ms) — SpeechProfile 간격 정책 + Rendering Plan 세그먼트 쉼. 첫 청크는 0. */
  pauseBeforeMs: number
  /** 허용 meta 만 담은 단계(본문 없음). `trace.record:false` 인 호출자가 자기 Trace 에 합친다. */
  steps: TraceStep[]
}

// ── AppSetting(30초 캐시) ─────────────────────────────────────────────────

const SETTING_CACHE_MS = 30_000
const settingCache = new Map<string, { at: number; value: unknown }>()
async function cachedSetting<T>(key: string, fallback: T): Promise<T> {
  const hit = settingCache.get(key)
  if (hit && Date.now() - hit.at < SETTING_CACHE_MS) return hit.value as T
  const value = await getAppSetting<T>(key, fallback)
  settingCache.set(key, { at: Date.now(), value })
  return value
}

/** `tts.styleMap`(라벨 → voice 스타일 후보) — 형식이 틀린 항목은 버린다. */
export function parseStyleMap(raw: unknown): Partial<Record<SegmentStyle, string[]>> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const out: Partial<Record<SegmentStyle, string[]>> = {}
  for (const label of SEGMENT_STYLES) {
    const v = (raw as Record<string, unknown>)[label]
    if (Array.isArray(v)) out[label] = v.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 40).slice(0, 5)
  }
  return out
}

export async function previewSettings(): Promise<{ text: string; textVersion: number }> {
  const text = await cachedSetting<unknown>('voice.preview.defaultText', 'こんにちは。今日も一緒に楽しく日本語を勉強しましょう。')
  const version = await cachedSetting<unknown>('voice.preview.textVersion', 1)
  return {
    text: typeof text === 'string' && text.trim() ? text.trim() : 'こんにちは。今日も一緒に楽しく日本語を勉強しましょう。',
    textVersion: typeof version === 'number' && Number.isInteger(version) ? version : 1,
  }
}

async function pickVoice(explicit: string | null | undefined, saved: string | null | undefined): Promise<TtsVoice> {
  if (explicit) {
    const v = await loadTtsVoice(explicit)
    if (!v) throw new TtsRequestError('VOICE_NOT_AVAILABLE')
    return v
  }
  if (saved) {
    const v = await loadTtsVoice(saved)
    if (v) return v
  }
  // 저장된 목소리가 비활성·보관됐으면 기본 목소리(configuration-resolution §4 W_VOICE_FALLBACK).
  const def = await cachedSetting<unknown>('voice.default.profileId', null)
  const v = typeof def === 'string' ? await loadTtsVoice(def) : null
  if (!v) throw new TtsUnavailableError('SERVER_ERROR')
  return v
}

// ── 같은 키 합성은 하나로 합친다(출처: CACHE·SHARED·SYNTH — singleFlight) ──────────────

type Synthesized = { out: TtsSynthOutput; durationMs: number; parts: CacheKeyParts }

const flights = createSingleFlight<CachedAudio, Synthesized>({
  readCache: (key) => readCachedAudio(key),
  // 첫 오디오를 저장 I/O 만큼 늦추지 않는다 — 저장은 응답 뒤에 이어지고, 끝날 때까지 같은 키 요청은 합류한다.
  store: (key, r) => storeCachedAudio(key, r.parts, r.out.audio, r.durationMs),
  onStoreError: (e) => {
    if (!tts.isTtsEngineError(e)) console.warn('[tts] 캐시 저장 실패:', e instanceof Error ? e.name : 'unknown')
  },
})

function startSynthesis(target: TtsTarget, voice: TtsVoice, parts: CacheKeyParts, hints: readonly TtsLexiconHint[], traceId: string): Promise<Synthesized> {
  return tts
    .synthesize(
      target,
      { model: voice.voiceModelId, speakerId: voice.speakerId, modelVersion: parts.modelVersion },
      {
        text: parts.normalizedText,
        style: parts.style,
        styleWeight: parts.styleWeight,
        speed: parts.speed,
        pitch: parts.pitch,
        intonation: parts.intonation,
        lexiconHints: hints,
        dictionaryVersion: parts.dictionaryVersion,
        speechProfile: parts.speechProfile,
      },
      { traceId, timeoutMs: TTS_SENTENCE_TIMEOUT_MS },
    )
    .then((out) => {
      const info = wavInfo(out.audio)
      if (!info) throw new tts.TtsEngineError('BAD_AUDIO', 'NOT_WAV')
      // 캐시 저장(파일·행 커밋)은 응답 뒤에 이어진다 — 그 사이 #24 가 서명 URL 로 바로 받을 수 있게 먼저 메모리에 둔다(recentAudio).
      rememberRecentAudio(ttsCacheKey(parts), { audio: out.audio, durationMs: info.durationMs, modelVersion: parts.modelVersion, dictionaryVersion: parts.dictionaryVersion })
      return { out, durationMs: info.durationMs, parts }
    })
}

/** 캐시 키까지의 준비 결과(합성 전). 라이브 스모크가 같은 키를 계산할 때도 쓴다. */
export interface PreparedSentence {
  voice: TtsVoice
  profile: SpeechProfileName
  dictionaryVersion: number
  normalizedText: string
  hints: readonly TtsLexiconHint[]
  target: TtsTarget | null
  parts: CacheKeyParts | null
  key: string | null
  steps: TraceStep[]
  pauseBeforeMs: number
}

/** 청크 앞 간격 — 첫 청크 0, 이후는 프로필 간격(숫자 또는 직전 청크 길이)과 세그먼트 쉼 중 큰 값. */
export function chunkPauseMs(profile: SpeechProfileName, index: number, segmentPauseMs: number, previousDurationMs?: number | null): number {
  if (index <= 0) return 0
  const gap = PROFILE_POLICIES[profile].gapMs
  const g = gap === 'PREVIOUS_DURATION' ? Math.max(0, Math.round(previousDurationMs ?? 0)) : gap
  return Math.min(10_000, Math.max(g, segmentPauseMs))
}

/** 목소리·프로필 결정 → 사전 매칭 → 정규화 → Rendering Plan → (TTS 연결이 있으면) 캐시 키. 네트워크 호출 없음. */
export async function prepareSentence(input: SynthesizeInput): Promise<PreparedSentence> {
  const steps: TraceStep[] = []
  // draft(미리듣기)여도 저장된 learningSpeed 는 쓴다(LEARNING_SLOW 배속 — screens §7-11 ①).
  const setting = await getVoiceSettingForTts(input.userId)
  const voice = await pickVoice(input.voiceId, setting?.voiceProfileId)
  const profile: SpeechProfileName = input.speechProfile ?? (isSpeechProfile(setting?.speechProfile) ? setting!.speechProfile : 'NATIVE')

  let t = stopwatch()
  const lex = await loadActiveLexicon(currentEnvironment())
  const selected = selectEntries(lex.entries, { userId: input.userId, voiceId: voice.id, lessonId: input.scope?.lessonId ?? null, topicId: input.scope?.topicId ?? null })
  const lexMs = t()

  t = stopwatch()
  const [seg] = prepareSegments(input.text, { lexicon: selected, maxChars: TTS_SEGMENT_MAX_CHARS, single: true })
  const normMs = t()
  steps.push(ttsStep('TTS_LEXICON', lexMs, { dictionaryVersion: lex.dictionaryVersion, matches: seg.hints.length }))
  steps.push(ttsStep('TTS_NORMALIZE', normMs, { inputChars: codePointLength(input.text), outputChars: codePointLength(seg.normalizedText), rulesApplied: seg.rulesApplied }))
  if (!seg.normalizedText) throw new TtsRequestError('TEXT_EMPTY')
  if (codePointLength(seg.normalizedText) > TTS_SEGMENT_MAX_CHARS) throw new TtsRequestError('TEXT_TOO_LONG')

  t = stopwatch()
  const user: UserVoiceInput | null = input.draft ?? (setting ? { style: setting.style, styleWeight: setting.styleWeight, speed: setting.speed, pitch: setting.pitch, intonation: setting.intonation } : null)
  const base = resolveTtsParameters({ user, voiceDefaults: voice.defaults, voiceStyles: voice.styles, personaHint: null, context: { mode: input.contextMode ?? (input.trace.refType === 'voicePreview' ? 'PREVIEW' : 'TTS') }, llmStyle: input.styleHint ?? null })
  const plan = buildRenderingPlan({
    voiceId: voice.id,
    speechProfile: profile,
    base,
    segments: [seg],
    voiceStyles: voice.styles.map((s) => s.name),
    learningSpeed: setting?.learningSpeed ?? 0.8,
    llmStyle: input.styleHint ?? null,
    requested: input.requested ? [input.requested] : null,
    styleMap: parseStyleMap(await cachedSetting<unknown>('tts.styleMap', null)),
  })
  const eff = plan.segments[0].effective
  steps.push(ttsStep('TTS_PLAN', t(), { segments: plan.segments.length, styleSource: base.sourceByKey.style, speechProfile: profile }))

  const target = (await tts.targets())[0] ?? null
  const parts: CacheKeyParts | null = target
    ? {
        normalizedText: seg.normalizedText,
        voiceProfileId: voice.id,
        modelVersion: voice.modelVersion,
        dictionaryVersion: lex.dictionaryVersion,
        lexiconDigest: lexiconDigest(seg.hints),
        speechProfile: profile as SpeechProfile,
        style: eff.style,
        styleWeight: eff.styleWeight,
        speed: eff.speed,
        pitch: eff.pitch,
        intonation: eff.intonation,
        engineConnectionKey: target.key,
        textVersion: input.textVersion ?? TTS_TEXT_VERSION,
      }
    : null
  const pauseBeforeMs = chunkPauseMs(profile, input.chunk?.index ?? 0, plan.segments[0].pauseBeforeMs, input.chunk?.previousDurationMs)
  return { voice, profile, dictionaryVersion: lex.dictionaryVersion, normalizedText: seg.normalizedText, hints: seg.hints, target, parts, key: parts ? ttsCacheKey(parts) : null, steps, pauseBeforeMs }
}

export async function synthesizeSentence(input: SynthesizeInput): Promise<SynthesizeResult> {
  const traceId = newTraceId()
  const total = stopwatch()
  const p = await prepareSentence(input)
  const { voice, profile, steps } = p
  const meta = { profile, lex: p.dictionaryVersion, model: voice.modelVersion }
  if (!p.target || !p.parts || !p.key) {
    void finishTrace(traceId, steps, total(), 'ERROR', 'TTS_UNAVAILABLE', input, { ...meta, cacheHits: 0 })
    throw new TtsUnavailableError('NO_CONNECTION', traceId)
  }
  const { target, parts, key } = p
  const seg = { normalizedText: p.normalizedText, hints: p.hints }
  const lex = { dictionaryVersion: p.dictionaryVersion }

  const idx = input.chunk?.index ?? 0
  const synthName = `TTS_SYNTH[${idx}]`
  const base = { traceId, normalizedText: seg.normalizedText, dictionaryVersion: lex.dictionaryVersion, modelVersion: voice.modelVersion, cacheKey: key, pauseBeforeMs: p.pauseBeforeMs, steps }
  const fromCache = (hit: CachedAudio, ms: number): SynthesizeResult => {
    const ttfaMs = Math.round(total())
    steps.push(ttsStep(synthName, ms, { chunkIndex: idx, cacheHit: true, modelVersion: voice.modelVersion, connectionKey: target.key, audioMs: hit.durationMs, status: 'OK' }))
    void finishTrace(traceId, steps, ttfaMs, 'OK', null, input, { ...meta, cacheHits: 1, ttfaMs })
    return { ...base, audio: hit.audio, cached: true, durationMs: hit.durationMs ?? wavInfo(hit.audio)?.durationMs ?? null, ttfaMs }
  }

  const t = stopwatch()
  if (!isCacheKey(key)) throw new Error('캐시 키 형식 오류')
  const found = await flights.lookup(key)
  if (found.source === 'CACHE') return fromCache(found.value, t())

  let run: { source: 'SHARED' | 'SYNTH'; promise: Promise<Synthesized> }
  if (found.source === 'SHARED') run = found
  else {
    // 사용할 수 없는 연결에 매번 8초씩 기다리지 않는다 — 판정이 불가면(30초마다 재확인) 바로 자막만. 합류 요청은 엔진을 부르지 않으므로 건너뛴다.
    if (target.status === 'UNAVAILABLE' || target.status === 'MISCONFIGURED' || breakerOpen()) {
      const a = await assessAvailability({ allowProbe: true })
      if (a.health === 'UNAVAILABLE') {
        steps.push(ttsStep(synthName, t(), { chunkIndex: idx, cacheHit: false, connectionKey: target.key, status: 'SKIPPED', errorCode: 'TTS_UNAVAILABLE' }))
        void finishTrace(traceId, steps, total(), 'ERROR', 'TTS_UNAVAILABLE', input, { ...meta, cacheHits: 0 })
        throw new TtsUnavailableError(a.reason ?? 'SERVER_ERROR', traceId)
      }
    }
    const produced = await flights.produce(key, found.seq, () => startSynthesis(target, voice, parts, seg.hints, traceId))
    if (produced.source === 'CACHE') return fromCache(produced.value, t())
    run = produced
  }

  // SHARED = 진행 중·저장 중인 합성에 합류(엔진 호출 0) → 사용자에게는 캐시 적중(HIT). SYNTH 만 MISS·상태 판정 대상.
  const shared = run.source === 'SHARED'
  try {
    const { out, durationMs } = await run.promise
    const ttfaMs = Math.round(total())
    if (shared) {
      steps.push(ttsStep(synthName, t(), { chunkIndex: idx, cacheHit: true, modelVersion: voice.modelVersion, connectionKey: target.key, audioMs: durationMs, status: 'OK' }))
      void finishTrace(traceId, steps, ttfaMs, 'OK', null, input, { ...meta, cacheHits: 1, ttfaMs })
      return { ...base, audio: out.audio, cached: true, durationMs, ttfaMs }
    }
    recordSynthSuccess()
    steps.push(...synthSteps(out, { connectionKey: target.key, modelVersion: voice.modelVersion, ms: t(), durationMs, chunkIndex: idx }))
    void finishTrace(traceId, steps, ttfaMs, 'OK', null, input, { ...meta, cacheHits: 0, ttfaMs })
    return { ...base, audio: out.audio, cached: false, durationMs, ttfaMs }
  } catch (e) {
    // 엔진 호출 실패만 상태 판정(연속 실패)에 넣는다 — 합류 요청은 원 요청이 이미 셌으므로 세지 않는다. 그 밖의 예외(DB 등)는 그대로(500).
    if (!tts.isTtsEngineError(e)) throw e
    const kind: TtsFailureKind = e.kind
    if (!shared) recordSynthFailure(kind, e.code)
    steps.push(ttsStep(synthName, t(), { chunkIndex: idx, cacheHit: false, connectionKey: target.key, status: kind === 'TIMEOUT' ? 'TIMEOUT' : 'FAILED', errorCode: e.code }))
    void finishTrace(traceId, steps, total(), 'ERROR', `TTS_${kind}`, input, { ...meta, cacheHits: 0 })
    if (kind === 'TEXT_TOO_LONG') throw new TtsRequestError('TEXT_TOO_LONG')
    // 같은 오류 객체를 합류 요청들이 나눠 받는다 — traceId 는 복사본에 붙인다(TtsEngineError 에는 kind·code 만, 문장·주소·시크릿 없음).
    throw Object.assign(new tts.TtsEngineError(kind, e.code, e.retryAfterSec), { traceId, steps })
  }
}

async function finishTrace(
  traceId: string,
  steps: TraceStep[],
  totalMs: number,
  status: 'OK' | 'ERROR',
  errorCode: string | null,
  input: SynthesizeInput,
  m: { profile: string; lex: number; model: string; cacheHits: number; ttfaMs?: number },
): Promise<void> {
  if (input.trace.record === false) return
  const parent = ttsStep('TTS', totalMs, { sentences: 1, chunks: 1, ttfaMs: m.ttfaMs ?? null, speechProfile: m.profile, cacheHits: m.cacheHits, modelVersion: m.model, dictionaryVersion: m.lex, status })
  await recordTrace({
    traceId,
    // TraceKind 에 TTS 가 없다(스키마 변경 금지) — 사용자 합성·미리듣기 모두 PREVIEW 로 남기고 refType 으로 가른다.
    kind: 'PREVIEW',
    userId: input.userId,
    status,
    steps: [parent, ...steps],
    totalMs: Math.round(totalMs),
    errorCode,
    refType: input.trace.refType,
    refId: input.trace.refId ?? null,
  })
}
