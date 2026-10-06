/**
 * TTS Trace 하위 단계(speech-platform/16 §7.2) — 단계 이름과 **허용 meta 키만**(숫자·짧은 식별자). 본문·표기·읽기·오디오는 없다.
 * `RequestTrace.steps[]` 에 그대로 들어간다. `connectionKey` 는 관리자 Trace 전용(사용자 응답에는 싣지 않는다).
 */
import type { TraceStep } from '@/modules/engine'

type Meta = Record<string, string | number | boolean | null>

const ALLOWED: Record<string, readonly string[]> = {
  TTS: ['sentences', 'chunks', 'ttfaMs', 'speechProfile', 'cacheHits', 'modelVersion', 'dictionaryVersion', 'styleSource', 'status'],
  TTS_NORMALIZE: ['inputChars', 'outputChars', 'rulesApplied'],
  TTS_LEXICON: ['dictionaryVersion', 'matches'],
  TTS_PLAN: ['segments', 'styleSource', 'speechProfile'],
  TTS_QUEUE: ['waitMs', 'position'],
  // `voiceId`(task-012b-3, Leader 승인 2026-10-06): 관리자 TTS 지표의 목소리별 집계(EngineMetricsDaily.byVoice, 16 §7.1 "Voice 별 요청 수")
  // 원천. 값은 엔진 독립 Voice Profile id(예: teacher_haruka)뿐 — 엔진 speaker id·모델 id·모델 파일명은 싣지 않는다.
  TTS_SYNTH: ['chunkIndex', 'synthMs', 'audioMs', 'rtf', 'modelLoaded', 'modelVersion', 'cacheHit', 'connectionKey', 'voiceId', 'status', 'errorCode'],
  TTS_ENCODE: ['bytes', 'format'],
}

const SAFE_STRING = /^[\w.:\-]{1,60}$/

/** 허용 키·안전한 값만 남긴 단계 1개. `TTS_SYNTH[0]` 처럼 첨자가 붙은 이름은 앞부분으로 화이트리스트를 찾는다. */
export function ttsStep(name: string, ms: number, meta: Meta = {}): TraceStep {
  const base = name.replace(/\[\d+\]$/, '')
  const allowed = ALLOWED[base] ?? []
  const step: TraceStep = { name, ms: Math.max(0, Math.round(ms)) }
  for (const k of allowed) {
    const v = meta[k]
    if (v === undefined) continue
    if (typeof v === 'number') step[k] = Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null
    else if (typeof v === 'boolean' || v === null) step[k] = v
    else if (SAFE_STRING.test(v)) step[k] = v
  }
  return step
}

/** 단계 경과 측정 도우미. */
export function stopwatch(): () => number {
  const t0 = performance.now()
  return () => performance.now() - t0
}

/** MISS 합성 결과 → TTS_QUEUE·TTS_SYNTH[0]·TTS_ENCODE 단계(엔진이 준 헤더 계측값, 없으면 생략). */
export function synthSteps(
  out: { audio: Buffer; metrics: { httpMs: number; synthMs: number | null; queueMs: number | null; encodeMs: number | null; audioMs: number | null; modelLoaded: 'hit' | 'cold' | null } },
  m: { connectionKey: string; modelVersion: string; ms: number; durationMs: number; chunkIndex?: number; voiceId?: string },
): TraceStep[] {
  const idx = m.chunkIndex ?? 0
  const steps: TraceStep[] = []
  if (out.metrics.queueMs !== null) steps.push(ttsStep('TTS_QUEUE', out.metrics.queueMs, { waitMs: out.metrics.queueMs, position: 0 }))
  const synthMs = out.metrics.synthMs ?? out.metrics.httpMs
  const audioMs = out.metrics.audioMs ?? m.durationMs
  steps.push(
    ttsStep(`TTS_SYNTH[${idx}]`, m.ms, {
      chunkIndex: idx,
      synthMs,
      audioMs,
      rtf: audioMs > 0 ? synthMs / audioMs : null,
      modelLoaded: out.metrics.modelLoaded,
      modelVersion: m.modelVersion,
      cacheHit: false,
      connectionKey: m.connectionKey,
      ...(m.voiceId ? { voiceId: m.voiceId } : {}),
      status: 'OK',
    }),
  )
  steps.push(ttsStep('TTS_ENCODE', out.metrics.encodeMs ?? 0, { bytes: out.audio.length, format: 'wav' }))
  return steps
}
