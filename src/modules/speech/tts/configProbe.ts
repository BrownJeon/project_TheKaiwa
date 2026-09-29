/**
 * 설정 기능 테스트용 합성(task-012c #105 — AppSetting 미리듣기 문장·기본 목소리 후보를 **실제로** 합성해 본다).
 *
 * - 저장값을 바꾸지 않고 후보 문장·목소리로 한 문장을 합성한다. `TtsCache`(행·파일)·singleFlight·최근 오디오·연속 실패 판정·Trace 어디에도
 *   넣지 않는다(관리자 검증이 학습자 캐시·상태등을 흔들지 않게 — 발음 사전 미리듣기와 같은 규칙). 결과는 크기·길이·단계 ms 만, 오디오는 버린다.
 * - 목소리 수치는 중립값(스타일 AUTO·속도·피치·억양 1)·NATIVE 로 고정한다. 합성에 쓴 연결(= 그 FUNCTIONAL 행을 붙일 곳)을 돌려준다.
 * - Trace·EngineHealth 기록과 30초 슬롯은 호출자(admin 조합 → engine.functionalTest)가 한다.
 */
import { tts, type TraceStep } from '@/modules/engine'
import { TtsRequestError, TtsUnavailableError } from './errors'
import { stopwatch, synthSteps } from './metrics'
import { prepareSentence } from './synthesize'
import { wavInfo } from './wav'

const PROBE_TIMEOUT_MS = 15_000
const NEUTRAL = { style: 'AUTO', styleWeight: null, speed: 1, pitch: 1, intonation: 1 }

export interface TtsProbeInput {
  actorUserId: string
  text: string
  voiceId: string
}

export interface TtsProbeResult {
  ok: boolean
  connectionId: string | null
  connectionKey: string | null
  latencyMs: number
  audioBytes: number
  durationMs: number | null
  /** 실패 분류(짧은 식별자만): VOICE_NOT_AVAILABLE·TEXT_EMPTY·TEXT_TOO_LONG·NO_CONNECTION·TTS_<kind> … */
  errorCode: string | null
  steps: TraceStep[]
}

/** 지금 합성에 쓰이는 TTS 연결(첫 대상). 없으면 null — 호출자가 슬롯을 잡을 대상. */
export async function currentTtsConnection(): Promise<{ id: string; key: string } | null> {
  const t = (await tts.targets())[0]
  return t ? { id: t.id, key: t.key } : null
}

export async function probeTtsSynthesis(input: TtsProbeInput): Promise<TtsProbeResult> {
  const total = stopwatch()
  const fail = (errorCode: string, target: { id: string; key: string } | null = null, steps: TraceStep[] = []): TtsProbeResult => ({
    ok: false,
    connectionId: target?.id ?? null,
    connectionKey: target?.key ?? null,
    latencyMs: Math.round(total()),
    audioBytes: 0,
    durationMs: null,
    errorCode,
    steps,
  })
  let p: Awaited<ReturnType<typeof prepareSentence>>
  try {
    p = await prepareSentence({
      userId: input.actorUserId,
      text: input.text,
      voiceId: input.voiceId,
      speechProfile: 'NATIVE',
      draft: NEUTRAL,
      contextMode: 'PREVIEW',
      trace: { refType: 'configTest', record: false },
    })
  } catch (e) {
    if (e instanceof TtsRequestError) return fail(e.problem)
    if (e instanceof TtsUnavailableError) return fail('NO_CONNECTION')
    throw e
  }
  const target = p.target
  if (!target || !p.parts) return fail('NO_CONNECTION', null, p.steps)
  const t = stopwatch()
  try {
    const out = await tts.synthesize(
      target,
      { model: p.voice.voiceModelId, speakerId: p.voice.speakerId, modelVersion: p.parts.modelVersion },
      {
        text: p.parts.normalizedText,
        style: p.parts.style,
        styleWeight: p.parts.styleWeight,
        speed: p.parts.speed,
        pitch: p.parts.pitch,
        intonation: p.parts.intonation,
        lexiconHints: p.hints,
        dictionaryVersion: p.parts.dictionaryVersion,
        speechProfile: p.parts.speechProfile,
      },
      { traceId: `cfgt_${Date.now().toString(36)}`, timeoutMs: PROBE_TIMEOUT_MS },
    )
    const info = wavInfo(out.audio)
    if (!info) return fail('TTS_BAD_AUDIO', target, p.steps)
    const steps = [...p.steps, ...synthSteps(out, { connectionKey: target.key, modelVersion: p.voice.modelVersion, ms: t(), durationMs: info.durationMs, chunkIndex: 0 })]
    return { ok: true, connectionId: target.id, connectionKey: target.key, latencyMs: Math.round(total()), audioBytes: out.audio.length, durationMs: info.durationMs, errorCode: null, steps }
  } catch (e) {
    if (tts.isTtsEngineError(e)) return fail(`TTS_${e.kind}`, target, p.steps)
    throw e
  }
}
