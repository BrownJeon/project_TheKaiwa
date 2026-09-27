/**
 * 발음 사전 미리듣기(task-003g, api-contract §7-2 `POST /api/admin/v1/lexicon/preview`) — **저장하지 않고** 초안 항목을 적용해 본다.
 *
 *   before = 지금 사전(ACTIVE) · after(compare) = ACTIVE + 초안(초안이 같은 키의 저장 항목을 대신하고, 범위 문맥과 무관하게 적용·우선)
 *   읽기 확인(JSON) = 각 쪽을 엔진 읽기 확인(`tts.g2p`)으로 가나·악센트 문자열 + 적용된 항목(matches).
 *   소리(`Accept: audio/wav` + side) = 그 쪽을 합성한 WAV 하나(여러 문장이면 이어 붙임). 서명 URL·메모리 보관 없음.
 *
 * 긴 예문: 원문을 문장 단위로 60자 이하 조각으로 묶어 조각마다 읽기 확인·합성(서비스 상한: 합성 100자·읽기 확인 200자 — 사전 치환·정규화로
 * 늘어날 여유). 그래도 넘으면 PreviewTextTooLongError(→ 422 E_PREVIEW_TEXT_TOO_LONG).
 * 캐시 우회(bypassCache): 합성 결과를 `TtsCache`(행·파일)·singleFlight·recentAudio 어디에도 넣지 않는다 — 초안 읽기가 실제 캐시 키로 섞이지 않게.
 * 목소리 수치는 관리자 개인 설정이 아니라 중립값(스타일 AUTO·속도·피치·억양 1)과 NATIVE 프로필로 고정한다(발음 확인용).
 * 서버 상태 판정(연속 실패·서킷)에는 넣지 않는다 — 관리자 미리듣기 실패가 학습자 상태등을 흔들지 않게.
 * Trace = `PLAYGROUND`(refType `lexiconPreview`), 단계 ms·허용 meta 만(문장·읽기 없음).
 */
import { currentEnvironment, newTraceId, recordTrace, tts, type TraceStep } from '@/modules/engine'
import type { LexiconEntryFields, LexiconPreviewDto, LexiconPreviewMatchDto, LexiconPreviewSideDto } from '@/types/lexicon'
import { TtsRequestError, TtsUnavailableError } from './errors'
import { loadActiveLexicon, selectEntries, type LexiconEntryData } from './lexicon'
import { entryKey } from './lexiconRules'
import { stopwatch, synthSteps, ttsStep } from './metrics'
import { splitSentences } from './sentences'
import { prepareSentence, TTS_SENTENCE_TIMEOUT_MS, type PreparedSentence } from './synthesize'
import { toWorkingText } from './text'
import { concatWav, wavInfo } from './wav'

/** 한 번의 합성·읽기 확인 조각 상한(원문 글자 수). */
const CHUNK_MAX = 60
const MAX_CHUNKS = 8
const G2P_TIMEOUT_MS = 5_000
const GAP_MS = 200
const MATCHES_MAX = 50
const NEUTRAL = { style: 'AUTO', styleWeight: null, speed: 1, pitch: 1, intonation: 1 }

export class PreviewTextTooLongError extends Error {
  constructor() {
    super('미리듣기 예문이 합성·읽기 확인 상한을 넘음')
    this.name = 'PreviewTextTooLongError'
  }
}

export interface LexiconPreviewInput {
  actorUserId: string
  text: string
  voiceId?: string | null
  /** 검증을 마친 초안(저장 안 함). compare 가 아니면 쓰지 않는다. */
  drafts: readonly LexiconEntryFields[]
  compare: boolean
}

/** 문장 조각을 앞에서부터 CHUNK_MAX 이하로 묶는다(조각 하나가 넘으면 문장 감지기가 이미 、·글자 수로 자른 조각이다). */
export function packChunks(text: string): string[] {
  const out: string[] = []
  let cur = ''
  for (const p of splitSentences(text, { maxChars: CHUNK_MAX })) {
    if (cur && [...cur].length + [...p.text].length > CHUNK_MAX) {
      out.push(cur)
      cur = ''
    }
    cur += p.text
  }
  if (cur.trim()) out.push(cur)
  return out
}

const toData = (d: LexiconEntryFields): LexiconEntryData => ({ surface: d.surface, reading: d.reading, accentType: d.accentType, priority: d.priority, scope: d.scope, scopeRefId: d.scopeRefId, wordType: d.wordType, enabled: d.enabled })

interface PreparedSide {
  prepared: PreparedSentence[]
  /** 매칭 출처를 되짚는 선택 결과(working 표기 → 항목). */
  selected: Map<string, LexiconEntryData>
  forced: ReadonlySet<LexiconEntryData>
}

interface PreviewContext {
  traceId: string
  dictionaryVersion: number
  before: PreparedSide
  after: PreparedSide | null
  steps: TraceStep[]
}

async function prepare(input: LexiconPreviewInput, withAfter: boolean): Promise<PreviewContext> {
  const traceId = newTraceId()
  const active = await loadActiveLexicon(currentEnvironment())
  const chunks = packChunks(input.text)
  if (chunks.length === 0) throw new TtsRequestError('TEXT_EMPTY')
  if (chunks.length > MAX_CHUNKS) throw new PreviewTextTooLongError()
  const base = { userId: input.actorUserId, voiceId: input.voiceId ?? null, speechProfile: 'NATIVE' as const, draft: NEUTRAL, contextMode: 'PREVIEW' as const, trace: { refType: 'lexiconPreview', record: false } }
  const run = async (lexicon: { entries: readonly LexiconEntryData[]; forced?: ReadonlySet<LexiconEntryData> }): Promise<PreparedSentence[]> => {
    const out: PreparedSentence[] = []
    for (const text of chunks) {
      try {
        out.push(await prepareSentence({ ...base, text, lexicon }))
      } catch (e) {
        if (e instanceof TtsRequestError && e.problem === 'TEXT_TOO_LONG') throw new PreviewTextTooLongError()
        throw e
      }
    }
    return out
  }
  const beforePrepared = await run({ entries: active.entries })
  if (!beforePrepared[0].target) throw new TtsUnavailableError('NO_CONNECTION')
  const voice = beforePrepared[0].voice
  const ctx = { userId: input.actorUserId, voiceId: voice.id }
  const before: PreparedSide = { prepared: beforePrepared, selected: selectEntries(active.entries, ctx), forced: new Set() }
  let after: PreparedSide | null = null
  if (withAfter) {
    const drafts = input.drafts.map(toData)
    const draftKeys = new Set(drafts.map((d) => entryKey(d)))
    const merged = [...active.entries.filter((e) => !draftKeys.has(entryKey(e))), ...drafts]
    const forced = new Set(drafts)
    after = { prepared: await run({ entries: merged, forced }), selected: selectEntries(merged, ctx, forced), forced }
  }
  return { traceId, dictionaryVersion: active.dictionaryVersion, before, after, steps: [...beforePrepared[0].steps] }
}

function matchesOf(side: PreparedSide): LexiconPreviewMatchDto[] {
  const out: LexiconPreviewMatchDto[] = []
  for (const p of side.prepared) {
    for (const h of p.hints) {
      const e = side.selected.get(toWorkingText(h.surface))
      if (!e || out.length >= MATCHES_MAX) continue
      out.push({ surface: h.surface, reading: h.reading, accentType: h.accentType, scope: e.scope, source: side.forced.has(e) ? 'DRAFT' : 'ACTIVE' })
    }
  }
  return out
}

function rethrowEngine(e: unknown): never {
  if (tts.isTtsEngineError(e) && e.kind === 'TEXT_TOO_LONG') throw new PreviewTextTooLongError()
  throw e
}

async function readSide(side: PreparedSide): Promise<LexiconPreviewSideDto> {
  const target = side.prepared[0].target!
  const readings: string[] = []
  const accents: string[] = []
  for (const p of side.prepared) {
    try {
      const r = await tts.g2p(target, p.normalizedText, p.hints, { timeoutMs: G2P_TIMEOUT_MS })
      readings.push(r.reading)
      accents.push(r.accent)
    } catch (e) {
      rethrowEngine(e)
    }
  }
  return { normalizedText: side.prepared.map((p) => p.normalizedText).join(''), reading: readings.join(' '), accent: accents.join(' '), matches: matchesOf(side), audioUrl: null }
}

function finish(ctx: PreviewContext, input: LexiconPreviewInput, totalMs: number, status: 'OK' | 'ERROR', errorCode: string | null, chunks: number, modelVersion: string): void {
  void recordTrace({
    traceId: ctx.traceId,
    kind: 'PLAYGROUND',
    userId: input.actorUserId,
    status,
    steps: [ttsStep('TTS', totalMs, { sentences: chunks, chunks, speechProfile: 'NATIVE', cacheHits: 0, modelVersion, dictionaryVersion: ctx.dictionaryVersion, status }), ...ctx.steps],
    totalMs: Math.round(totalMs),
    errorCode,
    refType: 'lexiconPreview',
  })
}

const errorCodeOf = (e: unknown) => (e instanceof PreviewTextTooLongError ? 'TEXT_TOO_LONG' : tts.isTtsEngineError(e) ? `TTS_${e.kind}` : 'ERROR')

/** 읽기 확인(JSON) — 저장·캐시 변화 없음. */
export async function previewLexiconReadings(input: LexiconPreviewInput): Promise<LexiconPreviewDto> {
  const total = stopwatch()
  const ctx = await prepare(input, input.compare)
  const voice = ctx.before.prepared[0].voice
  const t = stopwatch()
  try {
    const before = await readSide(ctx.before)
    const after = ctx.after ? await readSide(ctx.after) : null
    ctx.steps.push(ttsStep('TTS_G2P', t()))
    finish(ctx, input, total(), 'OK', null, ctx.before.prepared.length, voice.modelVersion)
    return { dictionaryVersion: ctx.dictionaryVersion, voiceId: voice.id, before, after, traceId: ctx.traceId }
  } catch (e) {
    ctx.steps.push(ttsStep('TTS_G2P', t()))
    finish(ctx, input, total(), 'ERROR', errorCodeOf(e), ctx.before.prepared.length, voice.modelVersion)
    throw Object.assign(e as object, { traceId: ctx.traceId })
  }
}

export interface LexiconPreviewAudio {
  audio: Buffer
  durationMs: number | null
  dictionaryVersion: number
  traceId: string
}

/** 소리 — 한 쪽(before|after)을 합성해 WAV 하나로. after 는 compare 와 같은 초안 적용. */
export async function previewLexiconAudio(input: LexiconPreviewInput & { side: 'before' | 'after' }): Promise<LexiconPreviewAudio> {
  const total = stopwatch()
  const ctx = await prepare(input, input.side === 'after')
  const side = input.side === 'after' ? ctx.after! : ctx.before
  const voice = side.prepared[0].voice
  const target = side.prepared[0].target!
  const wavs: Buffer[] = []
  try {
    for (const [i, p] of side.prepared.entries()) {
      if (!p.parts) throw new TtsUnavailableError('NO_CONNECTION')
      const t = stopwatch()
      let out: Awaited<ReturnType<typeof tts.synthesize>>
      try {
        out = await tts.synthesize(
          target,
          { model: voice.voiceModelId, speakerId: voice.speakerId, modelVersion: p.parts.modelVersion },
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
          { traceId: ctx.traceId, timeoutMs: TTS_SENTENCE_TIMEOUT_MS },
        )
      } catch (e) {
        rethrowEngine(e)
      }
      const info = wavInfo(out.audio)
      if (!info) throw new tts.TtsEngineError('BAD_AUDIO', 'NOT_WAV')
      ctx.steps.push(...synthSteps(out, { connectionKey: target.key, modelVersion: voice.modelVersion, ms: t(), durationMs: info.durationMs, chunkIndex: i }))
      wavs.push(out.audio)
    }
    const joined = concatWav(wavs, GAP_MS)
    if (!joined) throw new tts.TtsEngineError('BAD_AUDIO', 'CONCAT_FAILED')
    finish(ctx, input, total(), 'OK', null, side.prepared.length, voice.modelVersion)
    return { audio: joined, durationMs: wavInfo(joined)?.durationMs ?? null, dictionaryVersion: ctx.dictionaryVersion, traceId: ctx.traceId }
  } catch (e) {
    finish(ctx, input, total(), 'ERROR', errorCodeOf(e), side.prepared.length, voice.modelVersion)
    throw Object.assign(e as object, { traceId: ctx.traceId })
  }
}
